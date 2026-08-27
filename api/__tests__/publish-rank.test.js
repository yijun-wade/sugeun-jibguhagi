import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripTags, findOurRank, daysSince, isDue, currentCheckpoint, exposureRate, CHECKPOINTS } from '../../scripts/publish/lib/rank.mjs'

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

test('exposureRate — 노출률. 색인 여부가 아니라 순위다', () => {
  // 처음엔 이걸 "색인률"이라 부르고 30위 밖을 미색인으로 읽었다가 오판했다.
  // 제목이 일반적이면 뉴스 수천 건과 경쟁해 밀릴 뿐, 색인은 되어 있다.
  const entries = [
    { checks: [{ day: 1, titleRank: 4, competitors: 6 }] },
    { checks: [{ day: 1, titleRank: null, competitors: 10300 }] },
    { checks: [{ day: 1, titleRank: 12, competitors: 15 }] },
    { checks: [{ day: 3, titleRank: 2, competitors: 3 }] }, // day 1 기록 없음 — 분모 제외
  ]
  const r = exposureRate(entries, 1)
  assert.equal(r.checked, 3)
  assert.equal(r.shown, 2)
  assert.ok(Math.abs(r.rate - 2 / 3) < 1e-9)
})

test('경쟁이 적은 글만 따로 본다 — 진짜 위험 신호는 여기서 나온다', () => {
  // 경쟁 20건 이하인데도 밀리면 계정 노출 제한을 의심해야 한다.
  // 경쟁 1만 건짜리가 밀리는 건 정상이라 같이 세면 신호가 묻힌다.
  const entries = [
    { checks: [{ day: 7, titleRank: 6, competitors: 6 }] },      // 쉬움·노출
    { checks: [{ day: 7, titleRank: null, competitors: 12 }] },  // 쉬움·밀림 ← 위험
    { checks: [{ day: 7, titleRank: null, competitors: 10300 }] }, // 어려움 — 정상
  ]
  const r = exposureRate(entries, 7)
  assert.equal(r.easyChecked, 2)
  assert.equal(r.easyShown, 1)
  assert.equal(r.easyRate, 0.5)
  // 전체 노출률은 33%지만 그것만 보면 과잉 경보가 된다
  assert.ok(Math.abs(r.rate - 1 / 3) < 1e-9)
})

test('경쟁 정보가 없으면 쉬움 표본에서 제외한다', () => {
  const r = exposureRate([{ checks: [{ day: 1, titleRank: null }] }], 1)
  assert.equal(r.easyChecked, 0)
  assert.equal(r.easyRate, null)
})

test('exposureRate — 표본이 없으면 null (0%로 오해하면 안 된다)', () => {
  assert.equal(exposureRate([], 1), null)
  assert.equal(exposureRate([{ checks: [] }], 1), null)
})
