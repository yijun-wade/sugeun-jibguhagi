// 외부 API 키 건강검진. 실제로 호출해서 살아 있는지 본다.
// 사용법: node scripts/check-keys.mjs   (.env.local을 자동으로 읽는다)
//
// 왜 만드나: 파이프라인이 외부 키 4종에 얹혀 있는데, 키가 죽어도 아무도 모른다.
// 실제로 MOLIT 키가 죽은 채 apt-prices.json이 202605에 멈춰 있었고, 프로덕션
// /api/kapt는 인증 실패를 null로 삼켜 744세대 단지에도 빈 값을 돌려주고 있었다.
// 데이터가 "없는 것"과 "못 받는 것"은 다른데, 구분이 없으면 조용히 썩는다.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// .env.local 로더 — 값 끝의 공백·개행·따옴표를 반드시 턴다.
// MOLIT_API_KEY에 실제로 개행이 붙어 있어 같은 키인데도 인증에 실패했다.
function loadEnv() {
  const p = join(process.cwd(), '.env.local')
  if (!existsSync(p)) return {}
  const out = {}
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '').replace(/\\n$/, '')
  }
  return out
}

const env = { ...loadEnv(), ...process.env }
const get = (k) => (env[k] || '').trim().replace(/\\n$/, '')

const dataGoKr = (name, url) => async (key) => {
  const r = await fetch(url.replace('__KEY__', key), { signal: AbortSignal.timeout(15000) })
  const t = await r.text()
  const err = (t.match(/errMsg"?\s*:?\s*"?([A-Z_]+)/) || [])[1]
  if (err) return { ok: false, why: err }
  // 공공데이터포털은 인증 실패도 200으로 주므로 본문을 봐야 한다
  if (/SERVICE_KEY|등록되지 않은/.test(t)) return { ok: false, why: '인증 실패' }
  let n = null
  try {
    const d = JSON.parse(t)
    // 응답 구조가 서비스마다 다르다. K-APT는 body.item(단수), 나머지는 body.items.item.
    // 하나만 보고 판단하면 멀쩡한 API를 "0건"으로 오판한다(실제로 그랬다).
    const items = d?.response?.body?.items?.item ?? d?.response?.body?.item
    n = items ? (Array.isArray(items) ? items.length : 1) : 0
  } catch { return { ok: false, why: '비JSON 응답' } }
  return { ok: true, note: `${n}건` }
}

const CHECKS = [
  {
    name: '국토부 아파트 매매 실거래가',
    keys: ['MOLIT_API_KEY'],
    run: dataGoKr('rtms', 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=__KEY__&LAWD_CD=11350&DEAL_YMD=202607&numOfRows=3&pageNo=1&_type=json'),
    impact: 'apt-prices.json 갱신 · 실거래가 분석/임장가이드 글 · 서비스 가격 표시',
  },
  {
    name: '공동주택 기본정보(K-APT)',
    keys: ['MOLIT_API_KEY'],
    run: dataGoKr('kapt', 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5?serviceKey=__KEY__&kaptCode=A11005401&_type=json'),
    impact: '상세페이지 세대수·난방·건축연도 (/api/kapt)',
  },
  {
    name: '건축물대장',
    keys: ['BUILDING_API_KEY', 'MOLIT_API_KEY'],
    run: dataGoKr('bld', 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo?serviceKey=__KEY__&sigunguCd=11350&bjdongCd=10300&numOfRows=3&pageNo=1&_type=json'),
    impact: '건축물 정보 (/api/building)',
  },
  {
    name: '네이버 검색 (뉴스·블로그)',
    keys: ['NAVER_CLIENT_ID'],
    run: async () => {
      const r = await fetch('https://openapi.naver.com/v1/search/blog.json?query=부동산&display=1', {
        headers: {
          'X-Naver-Client-Id': get('NAVER_CLIENT_ID'),
          'X-Naver-Client-Secret': get('NAVER_CLIENT_SECRET'),
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) return { ok: false, why: `HTTP ${r.status}` }
      const d = await r.json()
      return { ok: true, note: `총 ${d.total}건` }
    },
    impact: '브리핑 생성 · 정책 수집 · 색인/순위 추적',
  },
  {
    name: 'Anthropic',
    keys: ['ANTHROPIC_API_KEY'],
    run: async (key) => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4, messages: [{ role: 'user', content: 'hi' }] }),
        signal: AbortSignal.timeout(20000),
      })
      if (!r.ok) return { ok: false, why: `HTTP ${r.status}` }
      return { ok: true, note: '응답 정상' }
    },
    impact: '모든 초안 생성',
  },
]

async function main() {
  console.log('\n■ 외부 API 키 점검\n')
  let bad = 0

  for (const c of CHECKS) {
    const keyName = c.keys.find((k) => get(k))
    if (!keyName) {
      console.log(`  ❌ ${c.name}\n       키 없음 (${c.keys.join(' 또는 ')})\n       영향: ${c.impact}\n`)
      bad++
      continue
    }
    let res
    try { res = await c.run(get(keyName)) }
    catch (e) { res = { ok: false, why: e.message.slice(0, 50) } }

    if (res.ok) {
      console.log(`  ✅ ${c.name.padEnd(24)} ${res.note}`)
    } else {
      bad++
      console.log(`  ❌ ${c.name}`)
      console.log(`       ${res.why}  (${keyName})`)
      console.log(`       영향: ${c.impact}\n`)
    }
  }

  console.log(`\n${bad ? `⚠ ${bad}건 실패 — 위 영향 범위를 확인할 것` : '전부 정상'}\n`)
  process.exitCode = bad ? 1 : 0
}

main().catch((e) => { console.error(e.message); process.exit(1) })
