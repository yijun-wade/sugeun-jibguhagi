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

export function calcFourPillars(year, month, day, si) {
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

// ── Anthropic Tool Schema — 모델이 반드시 이 구조로 응답 ─────
export const SAJU_TOOL = {
  name: 'submit_saju_report',
  description: '사주 분석 결과를 정해진 구조로 제출합니다. 모든 필드를 빠짐없이 채우세요.',
  input_schema: {
    type: 'object',
    properties: {
      ilgan: {
        type: 'string',
        enum: ['甲木','乙木','丙火','丁火','戊土','己土','庚金','辛金','壬水','癸水'],
        description: '일간 (천간 한자 + 오행). 만세력 일주(日柱)의 천간을 그대로 사용.',
      },
      plainSummary: {
        type: 'string',
        description: '사주 모르는 일반인용 2~3문장. 한자/전문용어(일간·용신·신강·신약·오행·설기 등) 절대 금지. 형식: "당신은 [성격] 사주예요. [어떤 동네]가 잘 맞아요."',
      },
      saju: {
        type: 'object',
        properties: {
          ohaengDist:     { type: 'string', description: '오행 분포 한 줄 (예: "火 과다 木 약")' },
          sinkang:        { type: 'string', enum: ['신강','신약','중화'] },
          yongshin:       { type: 'string', enum: ['水','木','火','金','土'] },
          yongShinReason: { type: 'string' },
          daewon:         { type: 'string', description: '현재 대운 (예: "庚申 대운(2022-2032)")' },
          sewon:          { type: 'string', description: '올해 세운 한 줄 (예: "丙午년 비겁")' },
        },
        required: ['ohaengDist','sinkang','yongshin','yongShinReason','daewon','sewon'],
      },
      timing: {
        type: 'object',
        properties: {
          isGoodYear:  { type: 'boolean' },
          timingScore: { type: 'integer', minimum: 0, maximum: 100 },
          reason:      { type: 'string' },
          bestMonths:  { type: 'string' },
        },
        required: ['isGoodYear','timingScore','reason','bestMonths'],
      },
      regions: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        description: '용신 오행 매핑에서 TOP 3 자치구. rank는 1·2·3, score 내림차순.',
        items: {
          type: 'object',
          properties: {
            gu:    { type: 'string', description: '서울 자치구 이름 (예: "마포구")' },
            rank:  { type: 'integer', minimum: 1, maximum: 3 },
            score: { type: 'integer', minimum: 0, maximum: 100 },
            scoreBreakdown: {
              type: 'object',
              properties: {
                ohaengMatch:   { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 25 }, reason: { type: 'string' } }, required: ['score','reason'] },
                jimingOhaeng:  { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 25 }, reason: { type: 'string' } }, required: ['score','reason'] },
                landscape:     { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 25 }, reason: { type: 'string' } }, required: ['score','reason'] },
                lifeEnergy:    { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 25 }, reason: { type: 'string' } }, required: ['score','reason'] },
              },
              required: ['ohaengMatch','jimingOhaeng','landscape','lifeEnergy'],
            },
            jiming:    { type: 'string', description: '지명 풀이 (예: "麻浦(마포) — 浦자에 水변, 한강 포구")' },
            whyThisGu: { type: 'string', description: '이 구를 추천하는 이유 (사주와 연결, 구체적으로)' },
            dailyLife: { type: 'string', description: '일상 생활 에너지 한 줄' },
          },
          required: ['gu','rank','score','scoreBreakdown','jiming','whyThisGu','dailyLife'],
        },
      },
      regionComparison: { type: 'string', description: '3개 구의 비교 한 줄' },
      warning: {
        type: 'object',
        properties: {
          year:   { type: 'string', description: '주의 세운 연도' },
          reason: { type: 'string' },
          action: { type: 'string' },
        },
        required: ['year','reason','action'],
      },
      summary:      { type: 'string', description: '한 줄 요약' },
      finalVerdict: { type: 'string', description: '최종 판단 (1~2문장)' },
    },
    required: ['ilgan','plainSummary','saju','timing','regions','regionComparison','warning','summary','finalVerdict'],
  },
}

// ── tool_use 응답 검증 — 응답에서 tool 블록 추출 + regions 후처리 검사 ─
export function processToolResponse(data, toolName = SAJU_TOOL.name) {
  if (data?.stop_reason === 'max_tokens') return { ok: false, errorType: 'max_tokens' }
  const block = Array.isArray(data?.content)
    ? data.content.find(c => c?.type === 'tool_use' && c?.name === toolName)
    : null
  if (!block || !block.input || typeof block.input !== 'object') {
    return { ok: false, errorType: 'no_tool_use' }
  }
  const result = block.input
  if (!Array.isArray(result.regions) || result.regions.length !== 3) {
    return { ok: false, errorType: 'invalid_regions' }
  }
  return { ok: true, result }
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

[용신 오행별 서울 구 매핑 — 반드시 이 목록에서만 선택]
水 용신: 마포구·용산구·영등포구·노원구·도봉구
木 용신: 성동구·광진구·동대문구·중랑구·강동구
火 용신: 강남구·서초구·송파구·동작구·관악구
金 용신: 강서구·양천구·구로구·서대문구·금천구
土 용신: 중구·종로구·은평구·성북구·강북구

[분석 지시]
- 일주(日柱) 천간이 일간(日干)입니다. 위 계산값을 그대로 쓰세요.
- 오행 분포와 8자를 꼼꼼히 분석해 신강/신약과 용신을 정확히 판단하세요.
- 용신 오행 매핑에서 TOP 3 구를 선정하세요. 단, 아래 조건을 지키세요:
  · 사주마다 다른 구가 나와야 합니다 (같은 오행 내에서도 순위는 8자 특성에 따라 달라집니다)
  · 점수 차이의 근거를 지명 오행·지형·생활 에너지 세 가지로 구체적으로 설명하세요
  · scoreBreakdown 4개 항목 점수 합이 score와 일치하도록 분배하세요

분석 결과는 반드시 submit_saju_report 도구로 제출하세요.`

  // ── 진단 로깅 — 모든 시도 결과 추적 ───────────────────────
  const diag = { startedAt: Date.now(), attempts: [] }

  async function callAI(attempt) {
    const t0 = Date.now()
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), 25000)
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
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
          tools: [SAJU_TOOL],
          tool_choice: { type: 'tool', name: SAJU_TOOL.name },
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      clearTimeout(tid)
      const dur = Date.now() - t0

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => '')
        const errorType = `http_${resp.status}`
        console.error(`[saju] attempt=${attempt} ${errorType} dur=${dur}ms body=${errBody.slice(0, 200)}`)
        diag.attempts.push({ attempt, errorType, durationMs: dur, status: resp.status })
        return { ok: false, errorType }
      }

      const data = await resp.json()
      const tokens = data?.usage?.output_tokens ?? '?'
      const r = processToolResponse(data)
      if (!r.ok) {
        console.error(`[saju] attempt=${attempt} ${r.errorType} dur=${dur}ms stop=${data?.stop_reason} tokens_out=${tokens}`)
        diag.attempts.push({ attempt, errorType: r.errorType, durationMs: dur })
        return r
      }
      console.log(`[saju] attempt=${attempt} ok dur=${dur}ms tokens_out=${tokens}`)
      diag.attempts.push({ attempt, ok: true, durationMs: dur })
      return r
    } catch (e) {
      clearTimeout(tid)
      const dur = Date.now() - t0
      // AbortError = 25s 타임아웃 / TypeError = 네트워크 / 기타 = 알 수 없음
      const errorType = e?.name === 'AbortError' ? 'abort_25s'
                      : e?.name === 'TypeError'  ? 'network'
                      : `exception_${e?.name || 'unknown'}`
      console.error(`[saju] attempt=${attempt} ${errorType} dur=${dur}ms msg=${e?.message}`)
      diag.attempts.push({ attempt, errorType, durationMs: dur })
      return { ok: false, errorType }
    }
  }

  try {
    // 최대 2번 시도 (Vercel 60s · 프론트 55s · 25s × 2 + 1s 대기)
    let result = null
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000))
      const r = await callAI(attempt)
      if (r.ok) { result = r.result; break }
    }

    if (!result) {
      const lastAttempt = diag.attempts[diag.attempts.length - 1] || {}
      const finalErrorType = lastAttempt.errorType || 'unknown'
      const totalMs = Date.now() - diag.startedAt
      console.error(`[saju] FAIL total=${totalMs}ms attempts=${diag.attempts.length} finalErrorType=${finalErrorType}`, JSON.stringify(diag.attempts))
      return res.status(500).json({
        error: '분석 결과를 받지 못했어요. 다시 시도해주세요.',
        errorType: finalErrorType,
        attempts: diag.attempts.length,
        durationMs: totalMs,
      })
    }

    const totalMs = Date.now() - diag.startedAt
    console.log(`[saju] OK total=${totalMs}ms attempts=${diag.attempts.length}`)

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
