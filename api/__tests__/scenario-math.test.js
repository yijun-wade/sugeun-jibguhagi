import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_WEIGHTS,
  priceAt5y,
  priceAt3y,
  priceRange,
  buildScenarioMatrix,
} from '../_scenario-math.js'

describe('priceAt5y — 5년 후 가격 (가중치 직접 적용)', () => {
  test('기준 시나리오: 5억 → 5.8억 (12+8-5-2=13%)', () => {
    const w = { market: 0.12, local: 0.08, product: 0.05, liquidity: 0.02 }
    const p = priceAt5y(50000, w)  // 단위: 만원
    // IEEE 754 부동소수점 오차로 50000 * 1.13 직접 비교 불가 → 정수 만원 단위로 비교
    assert.equal(Math.round(p), 56500)  // 56500 만원
  })

  test('보수 시나리오: 5억 → 약 4.9억 (3+3-5-3=-2%)', () => {
    const w = { market: 0.03, local: 0.03, product: 0.05, liquidity: 0.03 }
    const p = priceAt5y(50000, w)
    assert.equal(Math.round(p), 49000)  // 49000 만원
  })
})

describe('priceAt3y — 3년 후 가격 (시장·지역 ×0.6, 상품·유동성 그대로)', () => {
  test('기준 시나리오: 5억 → 약 5.6억 ((12*0.6 + 8*0.6) - 5 - 2 = 5%)', () => {
    const w = { market: 0.12, local: 0.08, product: 0.05, liquidity: 0.02 }
    const p = priceAt3y(50000, w)
    // 1 + 0.072 + 0.048 - 0.05 - 0.02 = 1.05
    assert.equal(Math.round(p), 52500)
  })
})

describe('priceRange — ±5% 범위', () => {
  test('5.65억 → 5.37억 ~ 5.93억', () => {
    const r = priceRange(56500)
    assert.equal(r.low, Math.round(56500 * 0.95))
    assert.equal(r.high, Math.round(56500 * 1.05))
  })
})

describe('buildScenarioMatrix — 4시나리오 × (3년/5년)', () => {
  test('4시나리오 × 2시점 = 8셀 매트릭스', () => {
    const m = buildScenarioMatrix(50000, {
      conservative: { market: 0.03, local: 0.03, product: 0.05, liquidity: 0.03 },
      base:         { market: 0.12, local: 0.08, product: 0.05, liquidity: 0.02 },
      optimistic:   { market: 0.25, local: 0.12, product: 0.04, liquidity: 0.01 },
      overheated:   { market: 0.35, local: 0.15, product: 0.03, liquidity: 0.00 },
    })
    assert.equal(m.conservative['3y'].low, Math.round(50000 * (1 + 0.03*0.6 + 0.03*0.6 - 0.05 - 0.03) * 0.95))
    assert.equal(m.conservative['5y'].low, Math.round(50000 * (1 + 0.03 + 0.03 - 0.05 - 0.03) * 0.95))
    assert.ok(m.base['5y'].high > m.base['5y'].low)
    assert.ok(m.optimistic['5y'].high > m.base['5y'].high, '낙관 > 기준')
    assert.ok(m.overheated['5y'].high > m.optimistic['5y'].high, '과열 > 낙관')
  })
})

describe('DEFAULT_WEIGHTS — 방법론 문서 기본값', () => {
  test('4시나리오 모두 정의', () => {
    assert.ok(DEFAULT_WEIGHTS.conservative)
    assert.ok(DEFAULT_WEIGHTS.base)
    assert.ok(DEFAULT_WEIGHTS.optimistic)
    assert.ok(DEFAULT_WEIGHTS.overheated)
  })

  test('기준 시나리오는 +12% / +8% / -5% / -2%', () => {
    assert.deepEqual(DEFAULT_WEIGHTS.base, {
      market: 0.12, local: 0.08, product: 0.05, liquidity: 0.02
    })
  })
})
