// src/utils.js
import { DONG } from './data.js'
import { PRICE_HIGH, PRICE_LOW } from './constants.js'

// ── 숫자 포맷 ──────────────────────────────
export function fP(v) {
  if (!v || v <= 0) return '-'
  if (v >= 10000) {
    const e = Math.floor(v / 10000), r = v % 10000
    return r ? `${e}억 ${r.toLocaleString()}만` : `${e}억`
  }
  return `${v.toLocaleString()}만`
}
export function fR(a, b) { return a === b ? fP(a) : `${fP(a)} ~ ${fP(b)}` }

// ── 날짜 유틸 ──────────────────────────────
export function formatDealDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getYM(n) {
  const list = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    list.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return list
}

// ── XML 파싱 ───────────────────────────────
export function parseXml(xml, regionName) {
  const trades = []
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    doc.querySelectorAll('item').forEach(item => {
      const g = t => (item.querySelector(t)?.textContent || '').trim()
      const amt = parseInt(g('dealAmount').replace(/,/g, ''), 10)
      const area = parseFloat(g('excluUseAr')) || 0
      const aptNm = g('aptNm'), dong = g('umdNm'), buildYear = g('buildYear') || '1988'
      if (!aptNm || isNaN(amt) || amt <= 0) return
      trades.push({ regionName, aptNm, dong, buildYear, amt, area })
    })
  } catch (e) { /* skip */ }
  return trades
}

// ── 가격 신호 계산 ─────────────────────────
// trades: [{ amt, area }] 최근 6개월치
// 앞 3개월 avg vs 뒤 3개월 avg 비교
export function calcPriceSignal(recentTrades, olderTrades) {
  const avg = arr => arr.length ? Math.round(arr.reduce((s, t) => s + t.amt, 0) / arr.length) : 0
  const recentAvg = avg(recentTrades)
  const olderAvg  = avg(olderTrades)

  let direction = '→ 보합'
  if (olderAvg > 0) {
    const pct = (recentAvg - olderAvg) / olderAvg
    if (pct > 0.05) direction = '↑ 상승세'
    else if (pct < -0.05) direction = '↓ 하락세'
  }

  // 동 내 유사 평형 대비 레이블은 호출부에서 전달받음
  return { recentAvg, olderAvg, direction }
}

// ── 동네 생활 여건 top 3 ───────────────────
// 반환값: [{ icon, text }] 최대 3개
export function getLifeConditions(dong) {
  const d = DONG[dong] || {}
  const items = []
  if (d.sub)  items.push({ icon: '🚇', text: d.sub })
  if (d.edu)  items.push({ icon: '🏫', text: d.edu })
  if (d.note) items.push({ icon: '✨', text: d.note })
  if (items.length < 3 && d.tag === '자연환경') items.push({ icon: '🌿', text: '자연환경 우수' })
  return items.slice(0, 3)
}

// ── 가격 판단 2층 구조 ──────────────────────────────────
// layer 1: 절대가격 신호 (가격대 자체, 지역 보정 없음)
// layer 2: 상대가격 신호 (최근 3개월 vs 이전 3개월 — calcPriceSignal 결과)
// verdictKey: getVerdict() 내부 조회용 키 (표시 안 함)
export function buildPriceJudgment(recentAvg, direction) {
  if (!recentAvg || recentAvg <= 0) {
    return { level: null, trend: null, sentence: null, verdictKey: '적정' }
  }

  // Layer 1: 절대가격
  let level, verdictKey
  if (recentAvg > PRICE_HIGH) {
    level = '높은 편'
    verdictKey = '비쌈'
  } else if (recentAvg < PRICE_LOW) {
    level = '낮은 편'
    verdictKey = '저렴'
  } else {
    level = '중간 수준'
    verdictKey = '적정'
  }

  // Layer 2: 상대가격 (최근 거래 흐름)
  const trendMap = {
    '↑ 상승세': '오름세',
    '→ 보합':   '안정적',
    '↓ 하락세': '내림세',
  }
  const trend = trendMap[direction] || '안정적'

  // 문장 조합 — 실제 가격 노출로 "무엇 대비인지" 사용자가 스스로 판단 가능
  const sentence = `평균 ${fP(recentAvg)}으로 가격대가 ${level} — 최근 거래는 ${trend}입니다`

  return { level, trend, sentence, verdictKey }
}

// ── 한줄 판단 문장 ──────────────────────────
// tag: DONG[dong].tag 값
// priceLabel: '비쌈' | '적정' | '저렴'
export function getVerdict(tag, priceLabel) {
  const map = {
    '역세권': {
      '비쌈':  '교통은 편하지만 주거비가 높아 실질 생활비 전체를 꼼꼼히 따져봐야 하는 단지',
      '적정':  '지하철 접근성 좋고 가격도 합리적 — 출퇴근 편하게 살기 좋은 수준',
      '저렴':  '교통 편하고 가격도 낮아 주거비 부담 없이 매일 출퇴근이 쾌적한 단지',
    },
    '학군최강': {
      '비쌈':  '학군은 최고지만 교육비까지 합치면 지출이 상당 — 충분한 예산이 필요한 동네',
      '적정':  '학군 좋고 가격도 합리적 — 자녀 교육 환경을 고민하는 가족에게 잘 맞는 단지',
      '저렴':  '학군 인프라는 좋은데 가격도 낮은 편 — 자녀 교육 계획 있다면 진지하게 볼 만한 곳',
    },
    '직주근접': {
      '비쌈':  '직장 가깝고 출퇴근 부담은 없지만 주거비가 높아 생활비 여유는 제한적인 단지',
      '적정':  '직장 가깝고 가격도 적당 — 출퇴근 시간 줄이고 일상에 여유가 생기는 환경',
      '저렴':  '직장 가깝고 가격도 낮아 출퇴근 스트레스와 생활비 부담을 동시에 줄일 수 있는 단지',
    },
    '재건축기대': {
      '비쌈':  '시설 노후화로 거주 불편이 있고 이주 일정도 불확실 — 입주 목적과 기간을 명확히 해야 하는 단지',
      '적정':  '재건축 진행 중으로 이주 가능성이 있어 장기 거주보다 단기 계획에 어울리는 단지',
      '저렴':  '가격이 낮지만 공사 소음과 이주 리스크가 현실적 — 단기 거주 계획으로 접근하는 게 맞는 곳',
    },
    '미래가치': {
      '비쌈':  '개발 호재가 있지만 지금 당장 생활 편의는 제한적 — 완공 전까지 불편을 감수해야 하는 단지',
      '적정':  '인프라가 성숙 중인 단계 — 입주 시기에 따라 생활 편의 편차가 있을 수 있는 동네',
      '저렴':  '인프라가 아직 부족하지만 가격 부담이 적어 불편을 감수할 수 있다면 고려해볼 만한 곳',
    },
    '자연환경': {
      '비쌈':  '공원·산 가깝고 조용하고 쾌적하지만 그 환경에 가격이 붙어있는 단지',
      '적정':  '자연환경 쾌적하고 가격도 합리적 — 산책과 여유로운 일상을 즐기는 가족에 잘 맞는 단지',
      '저렴':  '자연환경 좋고 가격도 낮아 쾌적한 주거 환경을 합리적 비용으로 누릴 수 있는 단지',
    },
    '생활편의': {
      '비쌈':  '마트·병원·상권 모두 가깝고 생활은 편리하지만 주거비 부담이 따라오는 단지',
      '적정':  '생활 편의 시설 잘 갖춰져 있고 가격도 적정 — 일상이 불편하지 않은 실용적인 단지',
      '저렴':  '편의 시설 풍부하고 가격도 낮아 일상 편의를 챙기면서 주거비도 아낄 수 있는 단지',
    },
    '교육환경': {
      '비쌈':  '초등 통학과 학원가 접근성은 좋지만 거주비가 높아 교육비와 함께 꼼꼼히 따져봐야 하는 단지',
      '적정':  '교육 인프라 갖추고 가격도 합리적 — 초등 자녀 키우기 좋은 환경',
      '저렴':  '교육 환경 좋고 가격도 낮아 초등 자녀 있는 가족에게 실용적인 선택이 되는 단지',
    },
    '대학가': {
      '비쌈':  '상권은 활발하지만 유동인구와 소음이 공존 — 거주 쾌적성을 직접 확인해봐야 하는 단지',
      '적정':  '상권 활발하고 생활 편의 좋아 활기찬 동네 분위기를 즐기는 사람에게 잘 맞는 곳',
      '저렴':  '대학가 인프라 갖추고 가격도 낮아 1~2인 가구가 실용적으로 살기 좋은 단지',
    },
  }
  return map[tag]?.[priceLabel] || '실거래 데이터 기준 검토해볼 만한 단지 — 상세 탭에서 확인하세요'
}

// ── 이름 유사도 ────────────────────────────
function normNm(s) { return (s || '').replace(/[\s()（）]/g, '') }
export function nameSim(a, b) {
  const na = normNm(a), nb = normNm(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const setB = new Set(nb)
  let overlap = 0
  for (const ch of na) if (setB.has(ch)) overlap++
  return overlap / Math.max(na.length, nb.length)
}

// ── 후기 텍스트 스니펫 ──────────────────────────────
// 문장 완결 단위로 maxLen 이하로 자름
export function snippetText(text, maxLen = 55) {
  if (!text) return ''
  if (text.length <= maxLen) return text
  const trimmed = text.slice(0, maxLen)

  // Punctuation boundaries (always reliable)
  const punctEnd = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf('!'),
    trimmed.lastIndexOf('?'),
  )
  if (punctEnd > 20) return trimmed.slice(0, punctEnd + 1)

  // Korean sentence-ending syllables (요/다) — only when terminal:
  // followed by space, or at the very end of the trimmed string
  for (let i = trimmed.length - 1; i > 20; i--) {
    const ch = trimmed[i]
    if (ch === '요' || ch === '다') {
      const next = trimmed[i + 1]
      if (next === undefined || next === ' ') return trimmed.slice(0, i + 1)
    }
  }

  return trimmed + '…'
}
