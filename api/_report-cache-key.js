// 캐시 키 스키마 버전 — 단지 API schema 변경 시 v2로 올리면 전체 무효화
export const CACHE_KEY_VERSION = 'v1'

// 5천만원 단위 반올림. JS Math.round는 0.5 → 올림 (banker round 아님)
export function bucketize(manwon) {
  return Math.round(manwon / 5000) * 5000
}

// 정규화된 캐시 키 — 클라이언트(localStorage)와 서버(Vercel KV) 모두 동일 키 사용
export function buildReportCacheKey({ kaptCode, priceManwon, years, savingsManwon }) {
  const priceBucket    = bucketize(priceManwon)
  const savingsBucket  = bucketize(savingsManwon)
  return `report:${CACHE_KEY_VERSION}:${kaptCode}:${priceBucket}:${years}:${savingsBucket}`
}
