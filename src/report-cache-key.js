// 캐시 키 — api/_report-cache-key.js와 동일 로직.
// (Vercel Functions와 Vite는 서로 다른 빌드 환경이라 직접 import 불가)
export const CACHE_KEY_VERSION = 'v1'

export function bucketize(manwon) {
  return Math.round(manwon / 5000) * 5000
}

export function buildReportCacheKey({ kaptCode, priceManwon, years, savingsManwon }) {
  const priceBucket   = bucketize(priceManwon)
  const savingsBucket = bucketize(savingsManwon)
  return `report:${CACHE_KEY_VERSION}:${kaptCode}:${priceBucket}:${years}:${savingsBucket}`
}
