import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UPDATES } from '../../src/updates-data.js'
import { vibeFreshness } from '../../src/vibe-loader.js'

test('업데이트 내역: 최신이 위, 날짜·제목·항목이 빠짐없이 있다', () => {
  assert.ok(UPDATES.length >= 2)
  const dates = UPDATES.map(u => u.date)
  assert.deepEqual(dates, [...dates].sort().reverse(), '날짜 내림차순')
  for (const u of UPDATES) {
    assert.match(u.date, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(u.title && u.items.length > 0, u.date)
    for (const it of u.items) assert.ok(it.what && it.why, `${u.date}: 무엇이·왜 바뀌었는지 둘 다 있어야 한다`)
  }
})

test('업데이트 내역은 방문자 말로 쓴다 — 내부 용어가 새어 나가지 않는다', () => {
  const text = JSON.stringify(UPDATES)
  for (const jargon of ['프리렌더', 'Amplitude', '크롤러', 'API', '배치', 'PR #', 'Haiku', 'Opus', '세그먼트', 'CTA']) {
    assert.ok(!text.includes(jargon), `내부 용어: ${jargon}`)
  }
})

const NOW = new Date('2026-09-25T03:00:00Z').getTime()

test('vibeFreshness: 미리 모아 둔 요약은 모은 날짜를 말한다', () => {
  assert.equal(vibeFreshness({ source: 'static', generatedAt: '2026-09-20T05:41:00Z' }, NOW), '9월 20일에 모은 이야기예요')
})

test('vibeFreshness: 해가 다르면 연도까지', () => {
  assert.equal(vibeFreshness({ source: 'static', generatedAt: '2025-12-31T01:00:00Z' }, NOW), '2025년 12월 31일에 모은 이야기예요')
})

test('vibeFreshness: 방금 만든 요약·알 수 없는 경우', () => {
  assert.equal(vibeFreshness({ source: 'live' }, NOW), '방금 모은 이야기예요')
  assert.equal(vibeFreshness({ source: 'error' }, NOW), null)
  assert.equal(vibeFreshness({ source: 'static', generatedAt: 'garbage' }, NOW), null)
  assert.equal(vibeFreshness(null, NOW), null)
})

test('vibeFreshness: 날짜는 한국 시간 기준이다', () => {
  // UTC 9/19 16:00 = KST 9/20 01:00
  assert.equal(vibeFreshness({ source: 'static', generatedAt: '2026-09-19T16:00:00Z' }, NOW), '9월 20일에 모은 이야기예요')
})
