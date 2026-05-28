// 방법론 문서 기준 4시나리오 기본 가중치
// AI는 단지 특성에 따라 이 값을 ±조정해서 출력함
export const DEFAULT_WEIGHTS = {
  conservative: { market: 0.03, local: 0.03, product: 0.05, liquidity: 0.03 },
  base:         { market: 0.12, local: 0.08, product: 0.05, liquidity: 0.02 },
  optimistic:   { market: 0.25, local: 0.12, product: 0.04, liquidity: 0.01 },
  overheated:   { market: 0.35, local: 0.15, product: 0.03, liquidity: 0.00 },
}

// 5년 후 가격 — 가중치를 그대로 적용
export function priceAt5y(currentPrice, weights) {
  const growth = 1
    + weights.market
    + weights.local
    - weights.product
    - weights.liquidity
  return currentPrice * growth
}

// 3년 후 가격 — 시장·지역 프리미엄에 0.6 비율, 상품·유동성 할인은 그대로
// 근거: 방법론 문서의 보수/기준/낙관 3년·5년 예시값에서 역산한 근사치
export function priceAt3y(currentPrice, weights) {
  const growth = 1
    + weights.market * 0.6
    + weights.local * 0.6
    - weights.product
    - weights.liquidity
  return currentPrice * growth
}

// 가격 범위 — 중심값 기준 ±5%
export function priceRange(centerPrice) {
  return {
    low:  Math.round(centerPrice * 0.95),
    high: Math.round(centerPrice * 1.05),
  }
}

// 4시나리오 × (3년/5년) 매트릭스 생성
export function buildScenarioMatrix(currentPrice, weights) {
  const result = {}
  for (const key of ['conservative', 'base', 'optimistic', 'overheated']) {
    const w = weights[key]
    result[key] = {
      '3y': priceRange(priceAt3y(currentPrice, w)),
      '5y': priceRange(priceAt5y(currentPrice, w)),
    }
  }
  return result
}
