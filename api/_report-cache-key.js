// 캐시 키 스키마 버전 — 단지 API schema 변경 시 v2로 올리면 전체 무효화
export const CACHE_KEY_VERSION = 'v1'

// 5천만원 단위 반올림. JS Math.round는 0.5 → 올림 (banker round 아님)
// 음수·NaN·undefined는 캐시 키 오염을 막기 위해 throw
export function bucketize(manwon) {
  if (!Number.isFinite(manwon) || manwon < 0) {
    throw new TypeError(`bucketize: 유효한 0 이상 숫자가 필요합니다 (받음: ${manwon})`)
  }
  return Math.round(manwon / 5000) * 5000
}

// 정규화된 캐시 키 — 클라이언트(localStorage)와 서버(Vercel KV) 모두 동일 키 사용
// kaptCode 누락·잘못된 타입은 throw해서 KV에 "report:v1:undefined:..." 같은 오염 키 진입을 막음
export function buildReportCacheKey({ kaptCode, priceManwon, years, savingsManwon }) {
  if (!kaptCode || typeof kaptCode !== 'string') {
    throw new TypeError(`buildReportCacheKey: kaptCode (string) 필요 (받음: ${kaptCode})`)
  }
  if (years !== 3 && years !== 5) {
    throw new TypeError(`buildReportCacheKey: years는 3 또는 5만 허용 (받음: ${years})`)
  }
  const priceBucket    = bucketize(priceManwon)
  const savingsBucket  = bucketize(savingsManwon)
  return `report:${CACHE_KEY_VERSION}:${kaptCode}:${priceBucket}:${years}:${savingsBucket}`
}
