// 사주 지역 궁합 — 만세력 계산 후 AI 해석
export const config = { maxDuration: 60, regions: ['icn1'] }

import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'

// ── 만세력 계산 (manseryeok 인라인) ──────────────────────
const HEAVENLY_STEMS   = ['갑','을','병','정','무','기','경','신','임','계']
const HEAVENLY_STEMS_H = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
const EARTHLY_BRANCHES   = ['자','축','인','묘','진','사','오','미','신','유','술','해']
const EARTHLY_BRANCHES_H = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
const OHAENG_STEM   = ['목','목','화','화','토','토','금','금','수','수']
const OHAENG_BRANCH = ['수','토','목','목','토','화','화','토','금','금','토','수']

const SOLAR_TERM_BASE = [
  5.4055,20.12,3.87,18.73,5.63,20.646,4.81,20.1,5.52,21.04,5.678,21.37,
  7.108,22.83,7.5,23.13,7.646,23.042,8.318,23.438,7.438,22.36,7.18,21.94,
]
const MONTH_BRANCHES = {1:'인',2:'묘',3:'진',4:'사',5:'오',6:'미',7:'신',8:'유',9:'술',10:'해',11:'자',12:'축'}

function getSolarTermDate(year, idx) {
  const c = Math.floor(year / 100), y = year % 100
  const day = Math.floor(SOLAR_TERM_BASE[idx] + 0.2422 * y + Math.floor(y/4) - Math.floor(c/4))
  return new Date(year, Math.floor(idx / 2), day)
}

function getYearPillar(year) {
  return { stem: HEAVENLY_STEMS[(year-4)%10], branch: EARTHLY_BRANCHES[(year-4)%12] }
}

function getMonthPillar(year, month, day) {
  const date = new Date(year, month-1, day)
  let adjYear = year
  if (date < getSolarTermDate(year, 2)) adjYear = year - 1
  let solarMonth = 0
  for (let i = 0; i < 24; i += 2) {
    if (date >= getSolarTermDate(adjYear, i)) solarMonth = Math.floor(i/2) + 1
    else break
  }
  const yStemMod5 = ((adjYear-4) % 10) % 5
  const stemIdx = (yStemMod5 * 2 + solarMonth + 1) % 10
  return { stem: HEAVENLY_STEMS[stemIdx], branch: MONTH_BRANCHES[solarMonth] || '인' }
}

function getDayPillar(year, month, day) {
  const BASE = new Date(1992, 9, 24), BASE_NUM = 9
  const diff = Math.floor((new Date(year, month-1, day) - BASE) / 86400000)
  const num  = (((BASE_NUM + diff) % 60) + 60) % 60
  return { stem: HEAVENLY_STEMS[num % 10], branch: EARTHLY_BRANCHES[num % 12] }
}

function getHourPillar(dayStem, si) {
  // si: 자/축/인/묘/진/사/오/미/신/유/술/해
  const branchIdx = EARTHLY_BRANCHES.indexOf(si)
  if (branchIdx === -1) return null
  const dayStemIdx = HEAVENLY_STEMS.indexOf(dayStem)
  const hourStemIdx = ((dayStemIdx % 5) * 2 + branchIdx) % 10
  return { stem: HEAVENLY_STEMS[hourStemIdx], branch: si }
}

function hanja(stem, branch) {
  return HEAVENLY_STEMS_H[HEAVENLY_STEMS.indexOf(stem)] + EARTHLY_BRANCHES_H[EARTHLY_BRANCHES.indexOf(branch)]
}

function calcFourPillars(year, month, day, si) {
  const yr = getYearPillar(year)
  const mo = getMonthPillar(year, month, day)
  const da = getDayPillar(year, month, day)
  const hr = si ? getHourPillar(da.stem, si) : null
  return {
    year:  { kor: yr.stem + yr.branch, han: hanja(yr.stem, yr.branch), ohaeng: `천간 ${OHAENG_STEM[HEAVENLY_STEMS.indexOf(yr.stem)]} 지지 ${OHAENG_BRANCH[EARTHLY_BRANCHES.indexOf(yr.branch)]}` },
    month: { kor: mo.stem + mo.branch, han: hanja(mo.stem, mo.branch), ohaeng: `천간 ${OHAENG_STEM[HEAVENLY_STEMS.indexOf(mo.stem)]} 지지 ${OHAENG_BRANCH[EARTHLY_BRANCHES.indexOf(mo.branch)]}` },
    day:   { kor: da.stem + da.branch, han: hanja(da.stem, da.branch), ohaeng: `천간 ${OHAENG_STEM[HEAVENLY_STEMS.indexOf(da.stem)]} 지지 ${OHAENG_BRANCH[EARTHLY_BRANCHES.indexOf(da.branch)]}` },
    hour:  hr ? { kor: hr.stem + hr.branch, han: hanja(hr.stem, hr.branch), ohaeng: `천간 ${OHAENG_STEM[HEAVENLY_STEMS.indexOf(hr.stem)]} 지지 ${OHAENG_BRANCH[EARTHLY_BRANCHES.indexOf(hr.branch)]}` } : null,
    ilgan: da.stem,
  }
}

const YONGSHIN_GU = {
  水: ['마포구', '용산구', '영등포구', '노원구', '도봉구'],
  木: ['성동구', '광진구', '동대문구', '중랑구', '강동구'],
  火: ['강남구', '서초구', '송파구', '동작구', '관악구'],
  金: ['강서구', '양천구', '구로구', '서대문구', '금천구'],
  土: ['중구', '종로구', '은평구', '성북구', '강북구'],
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
  const { year, month, day, si, gender } = req.query
  if (!year || !month || !day) return res.status(400).json({ error: '생년월일이 필요해요' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API 키 없음' })

  // 만세력으로 4주 8자 계산
  let fp
  try {
    fp = calcFourPillars(Number(year), Number(month), Number(day), si || null)
  } catch (e) {
    return res.status(400).json({ error: '생년월일 계산 오류: ' + e.message })
  }

  const pillarsInfo = `
사주 원국 (만세력 계산값 — 이대로 사용하세요):
- 년주: ${fp.year.kor} (${fp.year.han}) — 오행: ${fp.year.ohaeng}
- 월주: ${fp.month.kor} (${fp.month.han}) — 오행: ${fp.month.ohaeng}
- 일주: ${fp.day.kor} (${fp.day.han}) — 오행: ${fp.day.ohaeng}
- 시주: ${fp.hour ? `${fp.hour.kor} (${fp.hour.han}) — 오행: ${fp.hour.ohaeng}` : '미입력'}
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
          max_tokens: 4096,
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
    const raw        = data?.content?.[0]?.text || ''
    const stopReason = data?.stop_reason

    // 응답이 잘린 경우
    if (stopReason === 'max_tokens') {
      return res.status(500).json({ error: '분석 응답이 너무 길어요. 다시 시도해주세요.' })
    }

    const start = raw.indexOf('{')
    const end   = raw.lastIndexOf('}')
    if (start === -1 || end === -1) return res.status(500).json({ error: '분석 결과를 읽지 못했어요. 다시 시도해주세요.' })

    const cleaned = sanitizeJson(raw.slice(start, end + 1))

    let result
    try {
      result = JSON.parse(cleaned)
    } catch {
      // JSON 파싱 실패 시 마지막 완전한 지역까지만 사용 시도
      try {
        const lastRegionEnd = cleaned.lastIndexOf('},"regionComparison"')
        if (lastRegionEnd > 0) {
          const partial = cleaned.slice(0, lastRegionEnd) + '}],"regionComparison":"","warning":{"year":"","reason":"","action":""},"summary":"","finalVerdict":""}'
          result = JSON.parse(sanitizeJson(partial))
        } else {
          return res.status(500).json({ error: '분석 결과를 읽지 못했어요. 다시 시도해주세요.' })
        }
      } catch {
        return res.status(500).json({ error: '분석 결과를 읽지 못했어요. 다시 시도해주세요.' })
      }
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
      year:  `${fp.year.kor} (${fp.year.han})`,
      month: `${fp.month.kor} (${fp.month.han})`,
      day:   `${fp.day.kor} (${fp.day.han})`,
      hour:  fp.hour ? `${fp.hour.kor} (${fp.hour.han})` : null,
    }

    return res.json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
