// src/collection-delta.js — 저장 시점 대비 변동 계산 (순수 함수, 단위테스트 대상)

const DAY = 86400000
const FLAT_PCT = 1      // ±1% 이내는 변동 없음으로 본다 (실거래 평균은 표본 구성만 바뀌어도 흔들림)
const STALE_DAYS = 180  // 이 이상이면 정확한 일수가 무의미

// savedItem: collection.js가 저장한 항목 { recentAvg, savedAt } (baseline, 갱신하지 않음)
// currentAvg: 지금 화면의 recentAvg
// now: 밀리초 타임스탬프 (테스트 주입용)
// → { days, from, to, diff, diffPct, level, stale } | null
export function buildDelta(savedItem, currentAvg, now = Date.now()) {
  if (!savedItem) return null
  const from = Number(savedItem.recentAvg) || 0
  const to   = Number(currentAvg) || 0
  if (from <= 0 || to <= 0) return null

  const savedMs = Date.parse(savedItem.savedAt)
  if (!Number.isFinite(savedMs)) return null

  const days = Math.max(0, Math.floor((now - savedMs) / DAY))
  const diff = to - from
  const diffPct = Math.round((diff / from) * 1000) / 10

  let level
  if (days === 0) level = 'fresh'
  else if (Math.abs(diffPct) <= FLAT_PCT) level = 'flat'
  else level = diff > 0 ? 'up' : 'down'

  return { days, from, to, diff, diffPct, level, stale: days > STALE_DAYS }
}
