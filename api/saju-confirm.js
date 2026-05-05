// 토스페이먼츠 결제 확인 + 사주 분석
export const config = { maxDuration: 60, regions: ['icn1'] }

import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'
import { processToolResponse } from './saju.js'

let aptCache = null
function loadApts() {
  if (aptCache) return aptCache
  try { aptCache = JSON.parse(readFileSync(join(process.cwd(), 'public', 'apt-discovery.json'), 'utf-8')) }
  catch { aptCache = [] }
  return aptCache
}

function getAptSamples(gu) {
  const apts = loadApts().filter(a => a.gu === gu && a.avg > 0)
  if (!apts.length) return []
  const sorted = [...apts].sort((a, b) => a.avg - b.avg)
  const mid = Math.floor(sorted.length / 2)
  return sorted.slice(Math.max(0, mid - 1), mid + 2).map(a => ({
    name: a.name, dong: a.dong,
    avg: +(a.avg / 10000).toFixed(1),
    year: a.year, units: a.units,
  }))
}

const YONGSHIN_GU = {
  水: ['마포구', '용산구', '영등포구', '노원구', '도봉구'],
  木: ['성동구', '광진구', '동대문구', '중랑구', '강동구'],
  火: ['강남구', '서초구', '송파구', '동작구', '관악구'],
  金: ['강서구', '양천구', '구로구', '서대문구', '금천구'],
  土: ['중구', '종로구', '은평구', '성북구', '강북구'],
}

// ── 결제 사용자용 풍부 리포트 schema (saju.js의 SAJU_TOOL과 별개 — vsOther 추가) ─
const PREMIUM_TOOL = {
  name: 'submit_saju_premium_report',
  description: '결제 사용자용 풍부한 사주 리포트. 모든 필드를 빠짐없이 채우세요.',
  input_schema: {
    type: 'object',
    properties: {
      ilgan: {
        type: 'string',
        enum: ['甲木','乙木','丙火','丁火','戊土','己土','庚金','辛金','壬水','癸水'],
        description: '일간 (천간 한자 + 오행)',
      },
      saju: {
        type: 'object',
        properties: {
          ohaengDist:     { type: 'string' },
          sinkang:        { type: 'string', enum: ['신강','신약','중화'] },
          yongshin:       { type: 'string', enum: ['水','木','火','金','土'] },
          yongShinReason: { type: 'string' },
          daewon:         { type: 'string' },
          sewon:          { type: 'string' },
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
            gu:    { type: 'string' },
            rank:  { type: 'integer', minimum: 1, maximum: 3 },
            score: { type: 'integer', minimum: 0, maximum: 100 },
            scoreBreakdown: {
              type: 'object',
              properties: {
                ohaengMatch:  { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 25 }, reason: { type: 'string' } }, required: ['score','reason'] },
                jimingOhaeng: { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 25 }, reason: { type: 'string' } }, required: ['score','reason'] },
                landscape:    { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 25 }, reason: { type: 'string' } }, required: ['score','reason'] },
                lifeEnergy:   { type: 'object', properties: { score: { type: 'integer', minimum: 0, maximum: 25 }, reason: { type: 'string' } }, required: ['score','reason'] },
              },
              required: ['ohaengMatch','jimingOhaeng','landscape','lifeEnergy'],
            },
            jiming:    { type: 'string' },
            whyThisGu: { type: 'string' },
            dailyLife: { type: 'string' },
            vsOther:   { type: 'string', description: '다른 후보 구 대비 이 구의 우위' },
          },
          required: ['gu','rank','score','scoreBreakdown','jiming','whyThisGu','dailyLife','vsOther'],
        },
      },
      regionComparison: { type: 'string' },
      warning: {
        type: 'object',
        properties: {
          year:   { type: 'string' },
          reason: { type: 'string' },
          action: { type: 'string' },
        },
        required: ['year','reason','action'],
      },
      summary:      { type: 'string' },
      finalVerdict: { type: 'string' },
    },
    required: ['ilgan','saju','timing','regions','regionComparison','warning','summary','finalVerdict'],
  },
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용' })

  const { paymentKey, orderId, amount, birth } = req.body || {}
  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ error: '결제 정보가 없어요' })
  }
  if (!process.env.TOSSPAYMENTS_SECRET_KEY) {
    return res.status(500).json({ error: '결제 설정이 없어요' })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'AI 분석 설정이 없어요' })
  }

  // 1. 토스페이먼츠 결제 확인
  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY
  const basicAuth  = Buffer.from(secretKey + ':').toString('base64')

  const tossResp = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  if (!tossResp.ok) {
    const err = await tossResp.json().catch(() => ({}))
    return res.status(400).json({ error: err.message || '결제 확인 실패' })
  }

  // 결제 확인 완료 — 사주 분석 시작
  const { year, month, day, hour, gender } = birth || {}
  if (!year || !month || !day) {
    return res.status(400).json({ error: '생년월일 정보가 없어요' })
  }

  const aptData = {}
  for (const guList of Object.values(YONGSHIN_GU)) {
    for (const gu of guList) {
      if (!aptData[gu]) aptData[gu] = getAptSamples(gu)
    }
  }

  const currentYear = new Date().getFullYear()

  const prompt = `사주명리학 전문가로서 아래 생년월일시를 분석해 서울 거주 지역 궁합 리포트를 작성하세요.

입력: ${year}년 ${month}월 ${day}일 ${hour ? hour + '시' : '시간 미상'} (${gender === 'female' ? '여성' : '남성'})
현재: ${currentYear}년

[용신 오행별 서울 구 매핑 — 반드시 이 목록에서만 선택]
水 용신: 마포구·용산구·영등포구·노원구·도봉구
木 용신: 성동구·광진구·동대문구·중랑구·강동구
火 용신: 강남구·서초구·송파구·동작구·관악구
金 용신: 강서구·양천구·구로구·서대문구·금천구
土 용신: 중구·종로구·은평구·성북구·강북구

[분석 지시]
- 만세력으로 사주 4주 8자를 정확히 산출한 뒤 신강/신약과 용신을 판단하세요.
- 용신 오행 매핑에서 TOP 3 구를 선정하세요. 점수 차이 근거를 지명 오행·지형·생활 에너지 세 가지로 구체적으로 설명하고, vsOther에 다른 후보 대비 우위를 작성하세요.
- scoreBreakdown 4개 항목 점수 합이 score와 일치하도록 분배하세요.

분석 결과는 반드시 submit_saju_premium_report 도구로 제출하세요.`

  // 2. Claude 사주 분석 (tool use)
  const ctrl = new AbortController()
  const tid  = setTimeout(() => ctrl.abort(), 40000)

  let aiResp
  try {
    aiResp = await fetch('https://api.anthropic.com/v1/messages', {
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
        tools: [PREMIUM_TOOL],
        tool_choice: { type: 'tool', name: PREMIUM_TOOL.name },
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch {
    clearTimeout(tid)
    return res.status(504).json({ error: '분석 시간이 초과됐어요. 다시 시도해주세요.' })
  }
  clearTimeout(tid)

  if (!aiResp.ok) {
    const errBody = await aiResp.text().catch(() => '')
    console.error(`[saju-confirm] http_${aiResp.status} body=${errBody.slice(0, 200)}`)
    return res.status(500).json({ error: '분석 요청 실패 — 다시 시도해주세요' })
  }

  const aiData = await aiResp.json()
  const r = processToolResponse(aiData, PREMIUM_TOOL.name)
  if (!r.ok) {
    console.error(`[saju-confirm] ${r.errorType} stop=${aiData?.stop_reason} tokens_out=${aiData?.usage?.output_tokens ?? '?'}`)
    return res.status(500).json({ error: '분석 결과 검증 실패 — 다시 시도해주세요', errorType: r.errorType })
  }
  const result = r.result

  if (result.regions) {
    result.regions = result.regions.map(reg => ({
      ...reg,
      apts: reg.apts?.length > 0 ? reg.apts : (aptData[reg.gu] || []),
    }))
  }

  return res.json(result)
}
