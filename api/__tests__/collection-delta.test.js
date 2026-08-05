import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDelta } from '../../src/collection-delta.js'

const DAY = 86400000
const NOW = 1754438400000 // 고정 기준 시각 — Date.now()를 쓰면 테스트가 비결정적이 된다
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString()

test('저장 시점 recentAvg가 없으면 null (비교 baseline 없음)', () => {
  assert.equal(buildDelta({ recentAvg: 0, savedAt: at(10) }, 45000, NOW), null)
  assert.equal(buildDelta({ savedAt: at(10) }, 45000, NOW), null)
})

test('현재 recentAvg가 없으면 null (단독 숫자는 오해를 부른다)', () => {
  assert.equal(buildDelta({ recentAvg: 42000, savedAt: at(10) }, 0, NOW), null)
})

test('savedItem 자체가 없으면 null', () => {
  assert.equal(buildDelta(null, 45000, NOW), null)
})

test('상승: level=up, diff 양수', () => {
  const d = buildDelta({ recentAvg: 42000, savedAt: at(21) }, 43500, NOW)
  assert.equal(d.level, 'up')
  assert.equal(d.from, 42000)
  assert.equal(d.to, 43500)
  assert.equal(d.diff, 1500)
  assert.equal(d.days, 21)
})

test('하락: level=down, diff 음수', () => {
  const d = buildDelta({ recentAvg: 42000, savedAt: at(30) }, 40000, NOW)
  assert.equal(d.level, 'down')
  assert.equal(d.diff, -2000)
})

test('±1% 이내는 flat — 표본 구성 변화를 "올랐어요"로 말하지 않는다', () => {
  assert.equal(buildDelta({ recentAvg: 42000, savedAt: at(10) }, 42300, NOW).level, 'flat') // +0.71%
  assert.equal(buildDelta({ recentAvg: 42000, savedAt: at(10) }, 41700, NOW).level, 'flat') // -0.71%
  assert.equal(buildDelta({ recentAvg: 42000, savedAt: at(10) }, 42000, NOW).level, 'flat') // 0%
})

test('1% 경계 바깥은 up/down', () => {
  assert.equal(buildDelta({ recentAvg: 42000, savedAt: at(10) }, 42500, NOW).level, 'up')   // +1.19%
  assert.equal(buildDelta({ recentAvg: 42000, savedAt: at(10) }, 41500, NOW).level, 'down') // -1.19%
})

test('당일 저장(days=0)은 fresh — 변동을 논하지 않는다', () => {
  const d = buildDelta({ recentAvg: 42000, savedAt: at(0) }, 43500, NOW)
  assert.equal(d.days, 0)
  assert.equal(d.level, 'fresh')
})

test('180일 초과는 stale 플래그 (정확한 일수가 무의미해지는 구간)', () => {
  assert.equal(buildDelta({ recentAvg: 42000, savedAt: at(100) }, 43500, NOW).stale, false)
  assert.equal(buildDelta({ recentAvg: 42000, savedAt: at(200) }, 43500, NOW).stale, true)
})

test('savedAt이 깨져 있으면 null (NaN 날짜로 계산하지 않는다)', () => {
  assert.equal(buildDelta({ recentAvg: 42000, savedAt: 'garbage' }, 43500, NOW), null)
  assert.equal(buildDelta({ recentAvg: 42000 }, 43500, NOW), null)
})

test('diffPct 반환 — 계측용', () => {
  const d = buildDelta({ recentAvg: 40000, savedAt: at(10) }, 44000, NOW)
  assert.equal(d.diffPct, 10)
})
