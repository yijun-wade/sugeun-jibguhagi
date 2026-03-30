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

// ── 동네 생활 여건 3축 구조 ───────────────────
// 반환값: { mobility, infra, risk }
export function getLifeConditions(dong) {
  const d = DONG[dong] || {}

  const mobility = d.sub || null

  // edu 우선, 없으면 note (태그 무관하게 항상 사용)
  let infra = null
  if (d.edu) {
    infra = d.edu
  } else if (d.note && d.tag !== '재건축기대' && d.tag !== '미래가치') {
    infra = d.note
  }

  // risk: tag 기반 파생, 보수적 톤
  let risk = null
  if (d.tag === '재건축기대') {
    risk = '재건축 이슈가 있어 거주 기간은 확인이 필요합니다'
  } else if (d.tag === '미래가치') {
    risk = '개발이 진행 중인 지역이라 현재 생활 편의는 확인이 필요합니다'
  }

  return { mobility, infra, risk }
}

// ── 가격 판단 2층 구조 ──────────────────────────────────
// layer 1: 절대가격 신호 (가격대 자체, 지역 보정 없음)
// layer 2: 상대가격 신호 (최근 3개월 vs 이전 3개월 — calcPriceSignal 결과)
export function buildPriceJudgment(recentAvg, direction) {
  if (!recentAvg || recentAvg <= 0) {
    return { level: null, trend: null, sentence: null }
  }

  // Layer 1: 절대가격
  let level
  if (recentAvg > PRICE_HIGH) {
    level = '높은 수준'
  } else if (recentAvg < PRICE_LOW) {
    level = '낮은 수준'
  } else {
    level = '중간 수준'
  }

  // Layer 2: 상대가격 (최근 거래 흐름)
  const trendMap = {
    '↑ 상승세': '오름세',
    '→ 보합':   '안정적',
    '↓ 하락세': '내림세',
  }
  const trend = trendMap[direction] || '안정적'

  // 문장 조합 — 실제 가격 노출로 "무엇 대비인지" 사용자가 스스로 판단 가능
  const sentence = `최근 평균 ${fP(recentAvg)} — 서울·수도권 기준 ${level}, 거래 흐름은 ${trend}입니다`

  return { level, trend, sentence }
}

// ── 한줄 판단 문장 ──────────────────────────
// tag: DONG[dong].tag 값
export function getVerdict(tag) {
  const map = {
    '역세권':     '지하철 접근성이 좋아 출퇴근이 편한 단지입니다',
    '학군최강':   '학군 인프라가 잘 갖춰져 자녀 교육 환경으로 좋은 동네입니다',
    '직주근접':   '직장 접근성이 좋아 출퇴근 시간을 아낄 수 있는 위치입니다',
    '재건축기대': '재건축 진행 중으로 이주 가능성이 있어 입주 기간을 확인해야 하는 단지입니다',
    '미래가치':   '개발이 진행 중인 지역으로 현재 생활 인프라는 아직 제한적인 동네입니다',
    '자연환경':   '공원·산 접근성이 좋아 쾌적한 주거 환경을 제공하는 단지입니다',
    '생활편의':   '마트·병원·상권이 가까워 일상 편의성이 높은 동네입니다',
    '교육환경':   '초등 통학과 학원가 접근성이 좋은 교육 친화적인 동네입니다',
    '대학가':     '상권이 활발하고 유동인구가 많은 활기찬 동네입니다',
  }
  return map[tag] || '실거래 데이터 기준 검토해볼 만한 단지 — 상세 탭에서 확인하세요'
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
