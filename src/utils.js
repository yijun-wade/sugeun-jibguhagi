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
      '비쌈':  '입지는 확실하나 가격 부담이 큼',
      '적정':  '교통 편하고 가격도 합리적, 실거주 적합',
      '저렴':  '교통 좋고 가격까지 저렴, 관심 가져볼 만함',
    },
    '학군최강': {
      '비쌈':  '학군 프리미엄이 가격에 반영됨',
      '적정':  '학군 좋고 가격 안정적, 자녀 키우기 유리',
      '저렴':  '학군 대비 가격 낮음, 진입 기회',
    },
    '직주근접': {
      '비쌈':  '직주근접 수요로 가격 탄탄, 하락 위험 낮음',
      '적정':  '출퇴근 편하고 가격도 합리적',
      '저렴':  '직주근접에 가격까지 저렴, 실거주 우선 검토',
    },
    '재건축기대': {
      '비쌈':  '재건축 기대가 가격에 선반영됨',
      '적정':  '재건축 기대 있고 현재 가격도 합리적',
      '저렴':  '재건축 기대 있으나 현재 거주 여건 확인 필요',
    },
    '미래가치': {
      '비쌈':  '미래 호재가 이미 가격에 반영',
      '적정':  '미래 개발 호재 있고 가격도 안정적',
      '저렴':  '미래 가치 대비 저평가, 장기 보유 유리',
    },
    '자연환경': {
      '비쌈':  '쾌적한 환경이 가격에 반영됨',
      '적정':  '조용하고 쾌적, 여유로운 거주에 적합',
      '저렴':  '자연환경 좋고 가격까지 합리적',
    },
    '생활편의': {
      '비쌈':  '편의시설 풍부하나 가격 부담',
      '적정':  '생활 편의 좋고 가격도 적정',
      '저렴':  '생활 편의 갖추고 가격도 저렴',
    },
  }
  return map[tag]?.[priceLabel] || '실거래 데이터 기준 검토해볼 만한 단지'
}

// ── 이름 유사도 ────────────────────────────
function normNm(s) { return (s || '').replace(/[\s()（）]/g, '') }
export function nameSim(a, b) {
  const na = normNm(a), nb = normNm(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  let overlap = 0
  for (const ch of na) if (nb.includes(ch)) overlap++
  return overlap / Math.max(na.length, nb.length)
}
