// 사주 지역 궁합 — 만세력 계산 후 AI 해석
export const config = { maxDuration: 60, regions: ['icn1'] }

import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'
import { calculateFourPillars } from 'manseryeok'

const YONGSHIN_GU = {
  水: ['마포구', '용산구', '영등포구', '노원구', '도봉구'],
  木: ['성동구', '광진구', '동대문구', '중랑구', '강동구'],
  火: ['강남구', '서초구', '송파구', '동작구', '관악구'],
  金: ['강서구', '양천구', '구로구', '서대문구', '금천구'],
  土: ['중구', '종로구', '은평구', '성북구', '강북구'],
}

// 시주 한자 → 시간 범위 (자시는 23~01)
const SI_TO_HOUR = {
  '자': 0, '축': 2, '인': 4, '묘': 6, '진': 8, '사': 10,
  '오': 12, '미': 14, '신': 16, '유': 18, '술': 20, '해': 22,
}

let aptCache = null
function loadApts() {
  if (aptCache) return aptCache
  try { aptCache = JSON.parse(readFileSync(join(process.cwd(), 'public', 'apt-discovery.json'), 'utf-8')) }
  catch { aptCache = [] }
  return aptCache
}

function getAptSamples(gu, count = 2) {
  const apts = loadApts().filter(a => a.gu === gu && a.avg > 0)
  if (!apts.length) return []
  const sorted = [...apts].sort((a, b) => a.avg - b.avg)
  const mid = Math.floor(sorted.length / 2)
  return sorted.slice(Math.max(0, mid - 1), mid + count - 1).map(a => ({
    name: a.name, dong: a.dong,
    avg: +(a.avg / 10000).toFixed(1),
    year: a.year, units: a.units,
  }))
}

function sanitizeJson(str) {
  let out = '', inStr = false, esc = false
  for (const ch of str) {
    if (esc)                   { out += ch; esc = false; continue }
    if (ch === '\\' && inStr)  { out += ch; esc = true;  continue }
    if (ch === '"')            { inStr = !inStr; out += ch; continue }
    if (inStr && ch === '\n')  { out += '\\n'; continue }
    if (inStr && ch === '\r')  { out += '\\r'; continue }
    if (inStr && ch === '\t')  { out += '\\t'; continue }
    out += ch
  }
  return out
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const { year, month, day, hour, si, gender } = req.query
  if (!year || !month || !day) return res.status(400).json({ error: '생년월일이 필요해요' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API 키 없음' })

  // 시주 결정: si(자/축/인...) 우선, 없으면 hour(0~23) 사용
  let hourNum = null
  if (si && SI_TO_HOUR[si] !== undefined) {
    hourNum = SI_TO_HOUR[si]
  } else if (hour !== undefined && hour !== '') {
    hourNum = Number(hour)
  }

  // 만세력으로 4주 8자 계산
  let fourPillars
  try {
    fourPillars = calculateFourPillars({
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: hourNum ?? 12,
      minute: 0,
    })
  } catch (e) {
    return res.status(400).json({ error: '생년월일 계산 오류: ' + e.message })
  }

  const {
    yearString, monthString, dayString, hourString,
    yearHanja, monthHanja, dayHanja, hourHanja,
    yearElement, monthElement, dayElement, hourElement,
  } = fourPillars

  const pillarsInfo = `
사주 원국 (만세력 계산값 — 이대로 사용하세요):
- 년주: ${yearString} (${yearHanja}) — 오행: 천간 ${yearElement?.stem}, 지지 ${yearElement?.branch}
- 월주: ${monthString} (${monthHanja}) — 오행: 천간 ${monthElement?.stem}, 지지 ${monthElement?.branch}
- 일주: ${dayString} (${dayHanja}) — 오행: 천간 ${dayElement?.stem}, 지지 ${dayElement?.branch}
- 시주: ${hourNum !== null ? `${hourString} (${hourHanja}) — 오행: 천간 ${hourElement?.stem}, 지지 ${hourElement?.branch}` : '미입력'}
`.trim()

  const aptData = {}
  for (const guList of Object.values(YONGSHIN_GU)) {
    for (const gu of guList) {
      if (!aptData[gu]) aptData[gu] = getAptSamples(gu, 2)
    }
  }

  const currentYear = new Date().getFullYear()

  const prompt = `사주명리학 전문가로서 아래 사주를 분석해 서울 거주 지역 궁합 리포트를 작성하세요.

${pillarsInfo}

성별: ${gender === 'female' ? '여성' : '남성'}
현재: ${currentYear}년

[분석 지시]
- 일주(日柱) 천간이 일간(日干)입니다. 위 계산값을 그대로 쓰세요.
- 오행 분포, 신강/신약, 용신을 위 8자 기반으로 분석하세요.
- 용신 오행에 맞는 서울 구 TOP 3을 선정하세요 (지명 오행, 지형, 생활 에너지 근거 포함).

아래 JSON만 출력 (줄바꿈 없이):
{"ilgan":"甲木","saju":{"ohaengDist":"木 과다 水 부족","sinkang":"신강","yongshin":"水","yongShinReason":"신강 甲木은 水로 설기해야 균형","daewon":"癸巳 대운(2020-2030)","sewon":"丙午년 식신"},"timing":{"isGoodYear":true,"timingScore":88,"reason":"대운이 용신 보충","bestMonths":"봄 3-4월"},"regions":[{"gu":"마포구","rank":1,"score":95,"scoreBreakdown":{"ohaengMatch":{"score":24,"reason":"한강 水 기운"},"jimingOhaeng":{"score":23,"reason":"浦자 水변"},"landscape":{"score":24,"reason":"배산임수"},"lifeEnergy":{"score":24,"reason":"교통 허브"}},"jiming":"麻浦 — 浦자에 水변","whyThisGu":"이유","dailyLife":"일상 에너지"},{"gu":"용산구","rank":2,"score":85,"scoreBreakdown":{"ohaengMatch":{"score":22,"reason":"한강"},"jimingOhaeng":{"score":19,"reason":"龍 水기운"},"landscape":{"score":23,"reason":"배산임수"},"lifeEnergy":{"score":21,"reason":"한남 에너지"}},"jiming":"龍山 — 용의 땅","whyThisGu":"이유","dailyLife":"일상"},{"gu":"영등포구","rank":3,"score":76,"scoreBreakdown":{"ohaengMatch":{"score":22,"reason":"여의도 한강"},"jimingOhaeng":{"score":15,"reason":"水 약함"},"landscape":{"score":20,"reason":"업무지형"},"lifeEnergy":{"score":19,"reason":"긴장 지속"}},"jiming":"永登浦","whyThisGu":"이유","dailyLife":"일상"}],"regionComparison":"비교","warning":{"year":"2028년","reason":"주의","action":"대비"},"summary":"한 줄 요약","finalVerdict":"최종 판단"}`

  try {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 40000)

    let resp
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    } catch {
      clearTimeout(tid)
      return res.status(504).json({ error: '분석 시간이 초과됐어요. 다시 시도해주세요.' })
    }
    clearTimeout(tid)

    if (!resp.ok) return res.status(500).json({ error: 'AI 분석 실패' })

    const data = await resp.json()
    const raw  = data?.content?.[0]?.text || ''

    const start = raw.indexOf('{')
    const end   = raw.lastIndexOf('}')
    if (start === -1 || end === -1) return res.status(500).json({ error: '결과 파싱 실패' })

    const cleaned = sanitizeJson(raw.slice(start, end + 1))

    let result
    try {
      result = JSON.parse(cleaned)
    } catch {
      return res.status(500).json({ error: 'JSON 파싱 실패 — 다시 시도해주세요' })
    }

    // 아파트 데이터 주입
    if (result.regions) {
      result.regions = result.regions.map(r => ({
        ...r,
        apts: aptData[r.gu] || [],
      }))
    }

    // 만세력 원국 추가 (프론트에서 표시용)
    result.fourPillars = {
      year: `${yearString} (${yearHanja})`,
      month: `${monthString} (${monthHanja})`,
      day: `${dayString} (${dayHanja})`,
      hour: hourNum !== null ? `${hourString} (${hourHanja})` : null,
    }

    return res.json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
