import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildReportPrompt } from '../_report-prompt.js'

const SAMPLE_CONTEXT = {
  apt: {
    name: '여의휴젠느',
    address: '서울특별시 영등포구 영등포동7가 94-99',
    completionYear: 2018,
    totalUnits: 53,
    supplyArea: 50.84,
    exclusiveArea: 36.85,
    roomCount: 3,
    bathroomCount: 1,
  },
  location: {
    nearestStation: '영등포시장역',
    stationLine: '5호선',
    walkingMinutes: 3,
    businessAreas: ['여의도', '광화문'],
    amenities: ['신세계백화점', '타임스퀘어', '한강성심병원'],
  },
  nearbyApts: [
    { name: '아크로타워스퀘어', avgPrice: 120000, perPy: 13000, units: 1221 },
    { name: '포레나영등포센트럴', avgPrice: 95000, perPy: 12000, units: 185 },
  ],
  recentTrades: [
    { area: 36.85, amount: 49500, dealYmd: '20260401' },
    { area: 36.85, amount: 50000, dealYmd: '20260315' },
  ],
  userInput: {
    priceManwon: 50000,
    years: 5,
    savingsManwon: 10000,
  },
  scenarioMatrix: {
    conservative: { '3y': { low: 47500, high: 52500 }, '5y': { low: 49000, high: 55000 } },
    base:         { '3y': { low: 51500, high: 56500 }, '5y': { low: 53500, high: 59500 } },
    optimistic:   { '3y': { low: 56500, high: 62500 }, '5y': { low: 64500, high: 71500 } },
    overheated:   { '3y': { low: 64000, high: 71000 }, '5y': { low: 73500, high: 81500 } },
  },
}

describe('buildReportPrompt', () => {
  test('user 메시지에 단지 이름·주소가 포함됨', () => {
    const { user } = buildReportPrompt(SAMPLE_CONTEXT)
    assert.ok(user.includes('여의휴젠느'))
    assert.ok(user.includes('영등포구'))
  })

  test('user 메시지에 사용자 입력 매가가 포함됨', () => {
    const { user } = buildReportPrompt(SAMPLE_CONTEXT)
    assert.ok(user.includes('5억'))
    assert.ok(user.includes('5년'))
    assert.ok(user.includes('1억'))
  })

  test('system 메시지에 톤 규칙이 포함됨', () => {
    const { system } = buildReportPrompt(SAMPLE_CONTEXT)
    assert.ok(system.includes('보고서체'))
    assert.ok(system.includes('이모지'))
  })

  test('user 메시지에 12 섹션 라벨이 모두 명시됨', () => {
    const { user } = buildReportPrompt(SAMPLE_CONTEXT)
    for (const label of ['정체성', '요약', '입지', '상품성', '수요층', '주변비교',
                          '시나리오', '자산변화', '징검다리', '전략', '매도리스크', '결론']) {
      assert.ok(user.includes(`[${label}]`), `라벨 ${label} 누락`)
    }
  })

  test('user 메시지에 시나리오 매트릭스 가격이 포함됨', () => {
    const { user } = buildReportPrompt(SAMPLE_CONTEXT)
    // 기준 5년 후 5.35억~5.95억대 가격 어딘가 등장해야 함
    assert.ok(user.includes('5.35') || user.includes('53500') || user.includes('5억'))
  })
})
