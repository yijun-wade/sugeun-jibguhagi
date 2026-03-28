// ── 가격 기준 (만원/평) ─────────────────────
export const PRICE_HIGH = 80000   // 이 이상이면 '비쌈'
export const PRICE_LOW  = 40000   // 이 이하면 '저렴'

// ── 면적 기준 ───────────────────────────────
export const MIN_AREA_SQM  = 40   // 전용면적 최소값 (㎡), 소형 제외
export const SQM_TO_PYEONG = 2.47 // ㎡ → 평 환산 계수

// ── 네트워크 ────────────────────────────────
export const FETCH_TIMEOUT = 10000 // API 타임아웃 (ms)

// ── 한국 좌표 범위 (지도 유효성 검사) ──────
export const KR_LAT = { min: 33, max: 43 }
export const KR_LON = { min: 124, max: 132 }
