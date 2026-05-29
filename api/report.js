// /api/report — 살까말까 보고서 생성
//   query: kaptCode, price (만원), years (3|5), savings (만원), force (캐시 무효화)
//   response: { sections: { 정체성, 요약, ... 결론 }, scenarioMatrix, cacheHit }

// maxDuration 60 — Hobby plan 한계. Sonnet 4.6 + max_tokens 5000은 보통 30~50초로 끝남.
// 캐시 hit 케이스는 즉시 응답. Pro plan 업그레이드 시 90으로 올릴 수 있음.
export const config = { maxDuration: 60, regions: ['icn1'] }

import { setCors } from './_utils.js'
import { buildScenarioMatrix, DEFAULT_WEIGHTS } from './_scenario-math.js'
import { buildReportPrompt } from './_report-prompt.js'
import { parseReportSections } from './_report-parser.js'
import { buildReportCacheKey } from './_report-cache-key.js'
import { kvGet, kvSet, kvDel } from './_report-kv.js'

// 단지 정보 fetch — apt-list.json, apt-discovery.json, 그리고 기존 API 활용
async function fetchAptContext(kaptCode, origin) {
  // 1) apt-list.json에서 기본 정보 검색
  const listRes = await fetch(`${origin}/apt-list.json`).then(r => r.json()).catch(() => [])
  const aptListItem = listRes.find(a => a.kaptCode === kaptCode)

  if (!aptListItem) {
    throw new Error(`단지를 찾을 수 없습니다: ${kaptCode}`)
  }

  // 2) 병렬 fetch — kapt(세대수·입주), apt-discovery(주변 비교용)
  const [kaptInfo, discovery] = await Promise.allSettled([
    fetch(`${origin}/api/kapt?kaptCode=${encodeURIComponent(kaptCode)}`).then(r => r.json()).catch(() => null),
    fetch(`${origin}/apt-discovery.json`).then(r => r.json()).catch(() => []),
  ])

  const kapt = kaptInfo.status === 'fulfilled' ? kaptInfo.value : null
  const disc = discovery.status === 'fulfilled' ? discovery.value : []

  // 3) 같은 구의 다른 단지 3~5개를 주변 비교로 자동 선정
  const addrParts = (aptListItem.addr || '').split(' ')
  const gu = addrParts.find(p => p.endsWith('구')) || ''
  const nearbyApts = disc
    .filter(a => a.gu === gu && a.code !== kaptCode)
    .sort((a, b) => Math.abs((a.avg || 0) - (aptListItem.avgPrice || 0)) - Math.abs((b.avg || 0) - (aptListItem.avgPrice || 0)))
    .slice(0, 5)
    .map(a => ({ name: a.name, avgPrice: a.avg, perPy: a.perPy, units: a.units }))

  // 4) 최근 실거래 — V1에서는 빈 배열로 시작
  // TODO(V2): /api/trade?lawdCd=&dealYmd= 통합해서 최근 3개월 실거래 추가
  // V1은 AI가 avgPrice·주변 비교만으로 추세 추론 (입력 토큰 절약)
  const recentTrades = []

  return {
    apt: {
      name: aptListItem.kaptName,
      address: aptListItem.addr,
      completionYear: kapt?.건축연도 || (aptListItem.useAprDay ? parseInt(aptListItem.useAprDay.slice(0,4)) : null),
      totalUnits: kapt?.세대수 || aptListItem.kaptdaCnt || null,
      supplyArea: aptListItem.supplyArea || null,
      exclusiveArea: aptListItem.exclusiveArea || null,
      roomCount: aptListItem.roomCount || 3,
      bathroomCount: aptListItem.bathroomCount || 1,
    },
    location: {
      nearestStation: aptListItem.nearestStation || '정보 없음',
      stationLine: aptListItem.stationLine || '',
      walkingMinutes: aptListItem.walkingMinutes || null,
      businessAreas: aptListItem.businessAreas || [],
      amenities: aptListItem.amenities || [],
    },
    nearbyApts,
    recentTrades,
  }
}

async function callClaude(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY 없음')
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    }),
  })

  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(`Claude API ${r.status}: ${JSON.stringify(err)}`)
  }

  const data = await r.json()
  return data?.content?.[0]?.text || ''
}

export default async function handler(req, res) {
  if (setCors(req, res)) return

  const { kaptCode, price, years, savings, force } = req.query

  if (!kaptCode) return res.status(400).json({ error: 'kaptCode 필요' })
  const priceManwon = parseInt(price, 10)
  const yearsNum    = parseInt(years, 10)
  const savingsManwon = Math.max(0, parseInt(savings, 10) || 0)

  if (!priceManwon || priceManwon < 1000) {
    return res.status(400).json({ error: 'price (만원 단위) 필요' })
  }
  if (![3, 5].includes(yearsNum)) {
    return res.status(400).json({ error: 'years는 3 또는 5만 허용' })
  }

  const cacheKey = buildReportCacheKey({ kaptCode, priceManwon, years: yearsNum, savingsManwon })

  // 1) 캐시 조회 (force=1이면 스킵)
  if (force !== '1') {
    const cached = await kvGet(cacheKey)
    if (cached) {
      return res.json({ ...cached, cacheHit: true })
    }
  }

  try {
    // 2) 단지 정보 fetch
    const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
    const ctx = await fetchAptContext(kaptCode, origin)

    // 3) 시나리오 매트릭스 계산 — 일단 기본 가중치 사용
    //    V1.1에서 AI가 추론한 가중치로 교체 가능 (현재는 결정론적)
    const scenarioMatrix = buildScenarioMatrix(priceManwon, DEFAULT_WEIGHTS)

    // 4) 프롬프트 빌드 + Claude 호출
    const prompt = buildReportPrompt({
      ...ctx,
      userInput: { priceManwon, years: yearsNum, savingsManwon },
      scenarioMatrix,
    })
    const text = await callClaude(prompt)

    // 5) 12 섹션 파싱
    const sections = parseReportSections(text)

    const payload = {
      sections,
      scenarioMatrix,
      meta: {
        kaptCode,
        aptName: ctx.apt.name,
        priceManwon,
        years: yearsNum,
        savingsManwon,
        generatedAt: new Date().toISOString(),
      },
    }

    // 6) 캐시 저장 (실패해도 응답 영향 없음)
    await kvSet(cacheKey, payload)

    return res.json({ ...payload, cacheHit: false })
  } catch (e) {
    console.error('[api/report] error:', e)
    return res.status(500).json({ error: e.message })
  }
}
