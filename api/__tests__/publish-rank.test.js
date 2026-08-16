import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripTags, findOurRank, daysSince, isDue, currentCheckpoint, indexRate, CHECKPOINTS } from '../../scripts/publish/lib/rank.mjs'

const now = (s) => new Date(`${s}+09:00`)

test('stripTags — 네이버가 검색어를 <b>로 감싸서 보낸다', () => {
  assert.equal(stripTags('세제 개편이 <b>전세난</b>을 부른다'), '세제 개편이 전세난을 부른다')
  assert.equal(stripTags('&quot;월세지옥&quot; 급행'), '"월세지옥" 급행')
  assert.equal(stripTags(null), '')
})

const items = (links) => links.map((l) => ({ link: l, bloggerlink: '' }))

test('우리 글 순위를 1-based로 찾는다', () => {
  const r = findOurRank(items([
    'https://blog.naver.com/yarl/123',
    'https://blog.naver.com/kaimex/224354913309',
  ]), 'kaimex')
  assert.equal(r, 2)
})

test('없으면 null', () => {
  assert.equal(findOurRank(items(['https://blog.naver.com/other/1']), 'kaimex'), null)
  assert.equal(findOurRank([], 'kaimex'), null)
  assert.equal(findOurRank(null, 'kaimex'), null)
})

test('블로그 ID가 다른 문자열에 부분 포함돼도 오탐하지 않는다', () => {
  // "kaimex"가 "notkaimex" 나 "kaimexpert" 안에 들어가도 우리 글이 아니다
  assert.equal(findOurRank(items(['https://blog.naver.com/notkaimex/1']), 'kaimex'), null)
  assert.equal(findOurRank(items(['https://blog.naver.com/kaimexpert/1']), 'kaimex'), null)
})

test('bloggerlink 쪽에만 있어도 찾는다', () => {
  const r = findOurRank([{ link: 'https://x.com/a', bloggerlink: 'blog.naver.com/kaimex' }], 'kaimex')
  assert.equal(r, 1)
})

test('daysSince — KST 날짜 기준', () => {
  assert.equal(daysSince('2026-08-16', now('2026-08-17T09:00:00')), 1)
  assert.equal(daysSince('2026-08-16', now('2026-08-16T23:00:00')), 0)
  assert.equal(daysSince('2026-08-16', now('2026-08-30T09:00:00')), 14)
})

test('체크포인트는 D+1·3·7·14', () => {
  assert.deepEqual(CHECKPOINTS, [1, 3, 7, 14])
})

test('발행 당일과 14일 초과는 확인하지 않는다', () => {
  assert.equal(isDue('2026-08-16', [], now('2026-08-16T12:00:00')), false)
  assert.equal(isDue('2026-08-16', [], now('2026-09-01T12:00:00')), false)
})

test('체크포인트 날이면 확인한다', () => {
  assert.equal(isDue('2026-08-16', [], now('2026-08-17T09:00:00')), true)  // D+1
  assert.equal(isDue('2026-08-16', [], now('2026-08-19T09:00:00')), true)  // D+3
})

test('같은 체크포인트를 두 번 기록하지 않는다 (멱등)', () => {
  const checks = [{ day: 1, titleRank: 4 }]
  assert.equal(isDue('2026-08-16', checks, now('2026-08-17T09:00:00')), false)
})

test('놓친 체크포인트를 뒤늦게라도 잡는다 — 맥이 며칠 꺼져 있었을 수 있다', () => {
  // D+1을 놓치고 D+2에 처음 돌아도 D+1로 기록한다
  assert.equal(isDue('2026-08-16', [], now('2026-08-18T09:00:00')), true)
  assert.equal(currentCheckpoint('2026-08-16', now('2026-08-18T09:00:00')), 1)
  // D+5에 처음 돌면 D+3으로
  assert.equal(currentCheckpoint('2026-08-16', now('2026-08-21T09:00:00')), 3)
})

test('indexRate — 색인률. 이 값이 꺾이면 발행을 줄이라는 신호', () => {
  const entries = [
    { checks: [{ day: 1, titleRank: 4 }] },
    { checks: [{ day: 1, titleRank: null }] },
    { checks: [{ day: 1, titleRank: 12 }] },
    { checks: [{ day: 3, titleRank: 2 }] }, // day 1 기록 없음 — 분모에서 제외
  ]
  const r = indexRate(entries, 1)
  assert.equal(r.checked, 3)
  assert.equal(r.indexed, 2)
  assert.ok(Math.abs(r.rate - 2 / 3) < 1e-9)
})

test('indexRate — 표본이 없으면 null (0%로 오해하면 안 된다)', () => {
  assert.equal(indexRate([], 1), null)
  assert.equal(indexRate([{ checks: [] }], 1), null)
})
