// 캐시 키 — api/_report-cache-key.js와 동일 로직 (서버·클라이언트 모두 같은 키 생성)
// Vercel Functions와 Vite는 서로 다른 빌드 환경이라 직접 import 불가, 그래서 미러링
export const CACHE_KEY_VERSION = 'v1'

// 5천만원 단위 반올림. 음수·NaN·undefined는 throw — 호출처(getCachedReport 등)가
// try/catch로 감싸므로 실제로는 캐시 우회로 graceful degradation.
export function bucketize(manwon) {
  if (!Number.isFinite(manwon) || manwon < 0) {
    throw new TypeError(`bucketize: 유효한 0 이상 숫자가 필요합니다 (받음: ${manwon})`)
  }
  return Math.round(manwon / 5000) * 5000
}

export function buildReportCacheKey({ kaptCode, priceManwon, years, savingsManwon }) {
  if (!kaptCode || typeof kaptCode !== 'string') {
    throw new TypeError(`buildReportCacheKey: kaptCode (string) 필요 (받음: ${kaptCode})`)
  }
  if (years !== 3 && years !== 5) {
    throw new TypeError(`buildReportCacheKey: years는 3 또는 5만 허용 (받음: ${years})`)
  }
  const priceBucket   = bucketize(priceManwon)
  const savingsBucket = bucketize(savingsManwon)
  return `report:${CACHE_KEY_VERSION}:${kaptCode}:${priceBucket}:${years}:${savingsBucket}`
}
