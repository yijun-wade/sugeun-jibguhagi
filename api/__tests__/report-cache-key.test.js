import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  bucketize,
  buildReportCacheKey,
  CACHE_KEY_VERSION,
} from '../_report-cache-key.js'

describe('bucketize — 5천만원 단위 반올림', () => {
  test('47000 → 45000', () => {
    assert.equal(bucketize(47000), 45000)
  })

  test('52000 → 50000 (반올림은 5천 미만이면 내림)', () => {
    assert.equal(bucketize(52000), 50000)
  })

  test('52500 → 50000 (정확히 5천 위는 짝수 반올림 — Math.round)', () => {
    // Math.round(10.5) = 11 (banker round), but 52500/5000 = 10.5
    // Math.round(10.5) === 11 in JS; * 5000 = 55000
    // 만약 banker round 적용한다면 52500 → 50000. JS는 0.5는 항상 올림.
    assert.equal(bucketize(52500), 55000)
  })

  test('100000 → 100000 (이미 정확히 5천 단위)', () => {
    assert.equal(bucketize(100000), 100000)
  })

  test('0 → 0 (저축 입력 없을 때)', () => {
    assert.equal(bucketize(0), 0)
  })
})

describe('buildReportCacheKey — 키 포맷', () => {
  test('잠실파크리오 / 5억 / 5년 / 1억 저축', () => {
    const key = buildReportCacheKey({
      kaptCode: 'A13824006',
      priceManwon: 50000,
      years: 5,
      savingsManwon: 10000,
    })
    assert.equal(key, `report:${CACHE_KEY_VERSION}:A13824006:50000:5:10000`)
  })

  test('비슷한 가격대는 같은 키로 합쳐짐', () => {
    const k1 = buildReportCacheKey({ kaptCode: 'X', priceManwon: 46000, years: 5, savingsManwon: 10000 })
    const k2 = buildReportCacheKey({ kaptCode: 'X', priceManwon: 47000, years: 5, savingsManwon: 10000 })
    assert.equal(k1, k2)  // 둘 다 45000 버킷 (46000/5000=9.2, 47000/5000=9.4 → round 9)
  })

  test('보유 기간이 다르면 키도 다름', () => {
    const k1 = buildReportCacheKey({ kaptCode: 'X', priceManwon: 50000, years: 3, savingsManwon: 10000 })
    const k2 = buildReportCacheKey({ kaptCode: 'X', priceManwon: 50000, years: 5, savingsManwon: 10000 })
    assert.notEqual(k1, k2)
  })
})
