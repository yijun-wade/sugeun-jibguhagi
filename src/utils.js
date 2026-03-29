// src/utils.js
import { DONG } from './data.js'

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

// ── 한줄 판단 문장 ──────────────────────────
// tag: DONG[dong].tag 값
// priceLabel: '비쌈' | '적정' | '저렴'
export function getVerdict(tag, priceLabel) {
  const map = {
    '역세권': {
      '비쌈':  '출퇴근은 편하지만 주거비 부담이 큼 — 교통비 절약 효과와 비교해볼 것',
      '적정':  '지하철 접근성 좋고 가격도 부담 없는 수준 — 실거주 만족도 높을 단지',
      '저렴':  '교통 편하고 가격도 낮은 편 — 주거비 부담 없이 출퇴근 쾌적',
    },
    '학군최강': {
      '비쌈':  '학원가 접근성은 최고지만 거주비 부담이 상당함 — 교육비와 합산해 계획 필요',
      '적정':  '학군 좋고 가격도 합리적 — 자녀 교육 환경 만족도 높을 단지',
      '저렴':  '학군 인프라 대비 가격 낮음 — 자녀 교육 계획 있다면 우선 검토 추천',
    },
    '직주근접': {
      '비쌈':  '직장 가깝고 출퇴근 시간 아끼기 좋지만 주거비 부담이 큼',
      '적정':  '직장 접근성 좋고 가격도 합리적 — 워라밸 중심 거주에 적합',
      '저렴':  '직장 가깝고 가격도 저렴 — 출퇴근 스트레스 없이 생활비 여유 가능',
    },
    '재건축기대': {
      '비쌈':  '노후 단지 특성상 관리비·시설 불편 가능 — 이주 시점 불확실성 감안 필요',
      '적정':  '재건축 진행 시 이주 가능성 있음 — 단기 실거주 계획이라면 확인 필요',
      '저렴':  '가격은 낮지만 공사·이주 리스크 있음 — 장기 거주보다 단기 계획에 적합',
    },
    '미래가치': {
      '비쌈':  '개발 호재 있지만 지금 당장 생활 편의는 제한적 — 완공 전 불편 감수 필요',
      '적정':  '개발 진행 중으로 생활 인프라가 성숙 중 — 입주 시기에 따라 편의 차이',
      '저렴':  '인프라가 아직 부족하지만 가격 부담 적음 — 불편 감수 가능하다면 고려',
    },
    '자연환경': {
      '비쌈':  '공원·산 접근성 좋고 쾌적하지만 가격 부담 있음 — 조용한 주거 선호라면 고려',
      '적정':  '자연환경 쾌적하고 가격도 합리적 — 산책·여유로운 일상 원하는 가족에 적합',
      '저렴':  '자연환경 좋고 가격도 낮은 편 — 쾌적한 주거 환경을 합리적 비용으로',
    },
    '생활편의': {
      '비쌈':  '마트·병원·상권 가깝고 편리하지만 주거비 부담이 있음',
      '적정':  '생활 편의 시설 잘 갖춰져 있고 가격도 적정 — 일상 편의성 높은 단지',
      '저렴':  '편의 시설 풍부하고 가격도 낮은 편 — 일상 불편 없이 주거비 절약 가능',
    },
    '교육환경': {
      '비쌈':  '초등 통학과 학원가 접근성 좋지만 거주비 부담이 큼',
      '적정':  '교육 인프라 갖추고 가격도 합리적 — 초등 자녀 키우기 좋은 환경',
      '저렴':  '교육 환경 좋고 가격도 낮음 — 초등 자녀 있는 가족에게 실용적인 선택',
    },
    '대학가': {
      '비쌈':  '유동인구 많고 상권 활성화 — 소음·임대 수요 공존, 거주 쾌적성 확인 필요',
      '적정':  '상권 활발하고 생활 편의 좋음 — 활기찬 동네 분위기 선호한다면 적합',
      '저렴':  '대학가 상권 인프라 갖추고 가격 낮음 — 1~2인 가구 실거주에 실용적',
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
