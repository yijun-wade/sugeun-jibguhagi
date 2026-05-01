// 사주 지역 궁합 — JSON sanitizer + scoreBreakdown
export const config = { maxDuration: 60, regions: ['icn1'] }

import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'

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

// JSON 문자열 내부 개행·탭만 이스케이프 (구조적 개행은 유지)
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
  const { year, month, day, hour, gender } = req.query
  if (!year || !month || !day) return res.status(400).json({ error: '생년월일이 필요해요' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'API 키 없음' })

  const aptData = {}
  for (const guList of Object.values(YONGSHIN_GU)) {
    for (const gu of guList) {
      if (!aptData[gu]) aptData[gu] = getAptSamples(gu, 2)
    }
  }

  const currentYear = new Date().getFullYear()

  const prompt = `사주명리학 전문가로서 아래 생년월일시를 분석해 서울 거주 지역 궁합 리포트를 작성하세요.

입력: ${year}년 ${month}월 ${day}일 ${hour ? hour + '시' : '시간 미상'} (${gender === 'female' ? '여성' : '남성'})
현재: ${currentYear}년

아래 JSON만 출력 (줄바꿈 없이):
{"ilgan":"甲木","saju":{"ohaengDist":"木 과다 水 부족","sinkang":"신강","yongshin":"水","yongShinReason":"신강 甲木은 水로 설기해야 균형. 水 없으면 목기 과잉으로 고집·번아웃 표출","daewon":"癸巳 대운(2020-2030)","sewon":"丙午년 식신. 새 출발 에너지"},"timing":{"isGoodYear":true,"timingScore":88,"reason":"대운이 용신 보충하고 세운이 새 시작 에너지. 계약·정착 적기","bestMonths":"봄 3-4월 가을 9-10월"},"regions":[{"gu":"마포구","rank":1,"score":95,"scoreBreakdown":{"ohaengMatch":{"score":24,"reason":"한강이 마포 남쪽을 따라 흘러 水 기운을 일상에서 공급. 甲木의 과잉 목기가 한강으로 자연스럽게 설기됨"},"jimingOhaeng":{"score":23,"reason":"麻浦의 浦는 水변 한자. 지명부터 水 오행이 담겨 땅 기운과 용신이 일치"},"landscape":{"score":24,"reason":"한강 남쪽, 공덕·아현 언덕 북쪽으로 배산임수 지형. 木 기운 언덕과 水 기운 한강이 甲木에게 자연 순환 구조를 만들어줌"},"lifeEnergy":{"score":24,"reason":"공덕역 4·5·6호선·공항철도 교통허브가 뻗어나가는 甲木 진취성과 맞음. 홍대·합정 상권 에너지가 일상 동력이 됨"}},"jiming":"麻浦(마포) — 浦자에 水변, 한강 포구의 물기운 담은 땅","whyThisGu":"甲木에게 水는 자식 오행이자 에너지 순환 통로. 목기가 과잉되면 고집과 번아웃으로 표출되는데 한강이 옆에 있으면 그 기운이 자연스럽게 흘러내려 해소됨. 지명과 지형, 교통이 모두 이 사주와 맞아 떨어지는 최적의 동네","dailyLife":"퇴근 후 한강 산책 30분이 이 사주 최고의 에너지 해소법. 공덕역에서 강남·여의도·홍대 어디든 한 번에","vsOther":"한강+지명오행+배산임수+교통 4박자 충족. 용산은 水 좋지만 가격 부담, 영등포는 과수기 위험"},{"gu":"용산구","rank":2,"score":85,"scoreBreakdown":{"ohaengMatch":{"score":22,"reason":"한남·이촌이 한강에 직접 접해 水 에너지 충분. 마포보다 한강 접근 동네 비율 낮음"},"jimingOhaeng":{"score":19,"reason":"龍山의 龍은 水 기운 동물로 간접 연결. 山 지명이라 木 기운도 있어 甲木과 공명하나 직접 오행 일치는 약함"},"landscape":{"score":23,"reason":"한강 남쪽, 남산 북쪽으로 전형적 배산임수. 남산 木이 甲木을 돕고 한강 水가 용신 충족해 서울 풍수 균형 최우수"},"lifeEnergy":{"score":21,"reason":"한남·이태원 다국적 분위기가 甲木 진취성과 맞음. 상업·업무 기능이 강해 뿌리 내리는 환경은 마포보다 아쉬움"}},"jiming":"龍山(용산) — 용이 사는 산, 한강변 배산임수의 땅","whyThisGu":"남산 木과 한강 水가 동시에 있어 甲木에게 두 에너지를 모두 공급받는 드문 지형. 서울 배산임수 최우수 구이나 가격 부담이 큼","dailyLife":"이촌한강공원 수기 충전 + 남산 산책 木 기운 보완 가능. 단 마포 대비 가격 부담 크고 교통 허브 기능 낮음","vsOther":"지형은 마포 동급이나 가격 부담·교통 허브 약세로 2순위"},{"gu":"영등포구","rank":3,"score":76,"scoreBreakdown":{"ohaengMatch":{"score":22,"reason":"여의도가 한강으로 둘러싸인 섬이라 水 기운 최강. 단 과수기로 木이 익을 위험 있음"},"jimingOhaeng":{"score":15,"reason":"永登浦에는 水 오행 한자 없음. 지명 오행 근거 세 곳 중 가장 약함"},"landscape":{"score":20,"reason":"여의도 한강 기운 좋지만 콘크리트 금융·업무 지형이 강해 자연 풍수 에너지 순도 낮음"},"lifeEnergy":{"score":19,"reason":"금융·방송 업무 에너지가 강해 퇴근 후에도 긴장 지속. 주거 안정 에너지보다 출력 에너지가 강한 동네"}},"jiming":"永登浦(영등포) — 여의도는 水의 섬이나 지명 오행 근거 약함","whyThisGu":"Water 기운은 세 곳 중 최강이나 사방이 물이라 과수기로 木이 익을 수 있음. 업무 중심 지형이 장기 주거에 피로 누적","dailyLife":"여의도한강공원 접근은 좋지만 금융·업무 중심 환경이 퇴근 후에도 에너지 소모. 뿌리 내리는 안정이 부족","vsOther":"水 최강이나 과수기 위험+지명 약점+주거 에너지 낮음으로 3순위"}],"regionComparison":"마포는 4박자 균형. 용산은 배산임수 최우수나 가격 부담. 영등포는 水 강하나 과잉+지명 약점","warning":{"year":"2028년","reason":"삼형살 에너지 활성. 예상치 못한 변동 주의","action":"2028년 전 주거 안정. 해당 연도 대형 결정·추가 대출 자제"},"summary":"甲木 일간에 水 용신 — 한강 옆에서 살면 목기가 매일 순환돼요","finalVerdict":"사주 흐름상 지금이 정착 적기. 마포구 한강변이 지명·지형·생활 모두에서 맞아 장기적으로 안정됩니다"}`

  try {
    // 서버 사이드 40초 타임아웃 — Vercel 60초 전에 명시적 종료
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
    } catch (fetchErr) {
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

    return res.json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
