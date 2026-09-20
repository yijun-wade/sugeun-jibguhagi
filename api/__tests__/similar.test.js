import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickSimilarApts, pickSameTypeApts } from '../_similar.js'

const LIST = [
  { code: 'SELF', name: '기준단지', gu: '철산구', dong: '철산동', avg: 100000, perPy: 3000, units: 500, year: '2010' },
  { code: 'G1',   name: '같은구가까움', gu: '철산구', dong: '철산동', avg: 105000, perPy: 3100, units: 300, year: '2012' },
  { code: 'G2',   name: '같은구멈', gu: '철산구', dong: '하안동', avg: 160000, perPy: 4000, units: 800, year: '2005' },
  { code: 'O1',   name: '다른구제일가까움', gu: '강남구', dong: '역삼동', avg: 101000, perPy: 5000, units: 200, year: '2018' },
  { code: 'O2',   name: '다른구멈', gu: '마포구', dong: '공덕동', avg: 200000, perPy: 6000, units: 100, year: '2000' },
  { code: 'NOAVG', name: '가격없음', gu: '철산구', dong: '철산동', avg: 0, perPy: 0, units: 999, year: '2020' },
]

test('기준가 있을 때: 같은 구를 먼저, 가격 근접순으로 정렬', () => {
  const r = pickSimilarApts(LIST, { kaptCode: 'SELF', avg: 100000, gu: '철산구' }, 6)
  const codes = r.map(a => a.code)
  // 같은 구(G1, G2)가 다른 구보다 앞, 같은 구 안에서는 가격 근접순(G1<G2)
  assert.equal(codes[0], 'G1')
  assert.equal(codes[1], 'G2')
  // 그 뒤 다른 구는 가격 근접순(O1<O2)
  assert.deepEqual(codes.slice(2), ['O1', 'O2'])
})

test('자기 자신은 제외한다', () => {
  const r = pickSimilarApts(LIST, { kaptCode: 'SELF', avg: 100000, gu: '철산구' })
  assert.ok(!r.some(a => a.code === 'SELF'))
})

test('가격 없는 후보(avg<=0)는 기준가 매칭에서 제외한다', () => {
  const r = pickSimilarApts(LIST, { kaptCode: 'SELF', avg: 100000, gu: '철산구' })
  assert.ok(!r.some(a => a.code === 'NOAVG'))
})

test('anchor.avg가 없으면 kaptCode로 목록에서 기준가를 찾는다', () => {
  const r = pickSimilarApts(LIST, { kaptCode: 'SELF' }, 6)
  assert.equal(r[0].code, 'G1') // SELF의 avg=100000 을 찾아 가장 가까운 G1
})

test('기준가를 전혀 못 구하면(목록에 없고 avg 없음) 같은 구 세대수순 폴백', () => {
  // 목록에 없는 kaptCode + avg 없음 → 기준가 확보 실패 → 폴백
  const r = pickSimilarApts(LIST, { kaptCode: 'UNKNOWN', gu: '철산구' }, 3)
  // 같은 구 세대수 많은 순 우선: NOAVG(999) > G2(800) > ...
  assert.equal(r[0].code, 'NOAVG')
  assert.equal(r[1].code, 'G2')
  assert.equal(r.length, 3)
})

test('limit을 지킨다', () => {
  const r = pickSimilarApts(LIST, { kaptCode: 'SELF', avg: 100000, gu: '철산구' }, 2)
  assert.equal(r.length, 2)
})

test('빈 목록/비정상 입력은 빈 배열', () => {
  assert.deepEqual(pickSimilarApts([], { kaptCode: 'X' }), [])
  assert.deepEqual(pickSimilarApts(null, {}), [])
})

test('슬림 필드만 반환한다', () => {
  const r = pickSimilarApts(LIST, { kaptCode: 'SELF', avg: 100000, gu: '철산구' }, 1)
  assert.deepEqual(Object.keys(r[0]).sort(), ['avg', 'code', 'dong', 'gu', 'name', 'perPy', 'units', 'year'])
})

// ── 임대 단지용: 같은 구의 다른 공공임대·청년주택 ──────────────────────────

const SEOUL = [
  { kaptCode: 'R0', kaptName: '공덕동 크로시티 행복주택', sigungu: '마포구', dong: '공덕동', kaptdaCnt: 350, useAprDay: '20230101' },
  { kaptCode: 'R1', kaptName: '창전삼성임대', sigungu: '마포구', dong: '창전동', kaptdaCnt: 120, useAprDay: '20010101' },
  { kaptCode: 'R2', kaptName: '마포이름없는단지', sigungu: '마포구', dong: '아현동', kaptdaCnt: 900, useAprDay: '20150101' }, // 유형 파일에만 임대
  { kaptCode: 'S1', kaptName: '마포래미안푸르지오', sigungu: '마포구', dong: '아현동', kaptdaCnt: 3885, useAprDay: '20140101' },
  { kaptCode: 'R3', kaptName: '라봄성동청년안심주택', sigungu: '성동구', dong: '마장동', kaptdaCnt: 200, useAprDay: '20250101' },
  { kaptCode: 'R4', kaptName: '은뜨락행복주택', sigungu: '은평구', dong: '녹번동', kaptdaCnt: 500, useAprDay: '20200101' },
]
const TYPES = { R0: 'rental', R2: 'rental', S1: 'mixed' }

test('임대 단지: 같은 구의 임대 단지를 세대수 큰 순으로, 분양·혼합은 제외', () => {
  const r = pickSameTypeApts(SEOUL, TYPES, { kaptCode: 'R0', gu: '마포구' }, 6)
  const codes = r.map(a => a.code)
  assert.deepEqual(codes.slice(0, 2), ['R2', 'R1']) // 같은 구: 900세대 → 120세대
  assert.ok(!codes.includes('S1'), '혼합 단지는 빠져야 한다')
  assert.ok(!codes.includes('R0'), '자기 자신은 빠져야 한다')
})

test('임대 단지: 같은 구가 모자라면 다른 구 임대로 채우고, 가격은 비운다', () => {
  const r = pickSameTypeApts(SEOUL, TYPES, { kaptCode: 'R0', gu: '마포구' }, 6)
  assert.equal(r.length, 4)
  assert.deepEqual(r.slice(2).map(a => a.code), ['R4', 'R3']) // 다른 구는 세대수 순
  assert.ok(r.every(a => a.avg === 0 && a.rental === true))
  assert.equal(r[0].year, '2015')
  assert.equal(r[0].units, 900)
})

test('임대 단지: 유형 파일이 비어도 단지명 키워드로 찾는다', () => {
  const r = pickSameTypeApts(SEOUL, {}, { kaptCode: 'R0', gu: '마포구' }, 6)
  assert.deepEqual(r.map(a => a.code), ['R1', 'R4', 'R3'])
})
