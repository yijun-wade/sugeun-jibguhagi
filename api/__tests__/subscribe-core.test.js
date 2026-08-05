import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushRegion, removeRegion, rankRegionsWithSubs } from '../../src/subscribe-core.js'

test('pushRegion: 새 지역을 맨 앞에 넣는다', () => {
  const out = pushRegion([{ dong: '상계동', gu: '노원구' }], { dong: '대치동', gu: '강남구' }, 5)
  assert.deepEqual(out.map(r => r.dong), ['대치동', '상계동'])
})

test('pushRegion: 같은 dong 중복은 무시하고 원본 유지', () => {
  const prev = [{ dong: '상계동', gu: '노원구', ts: 1 }]
  const out = pushRegion(prev, { dong: '상계동', gu: '노원구', ts: 2 }, 5)
  assert.equal(out.length, 1)
  assert.equal(out[0].ts, 1) // 기존 항목 보존
})

test('pushRegion: 상한 초과 시 거절 — 사용자가 명시한 의사를 임의로 지우지 않는다', () => {
  const prev = Array.from({ length: 5 }, (_, i) => ({ dong: `D${i}`, gu: 'G' }))
  const out = pushRegion(prev, { dong: 'NEW', gu: 'G' }, 5)
  assert.equal(out, null) // null = 거절 신호
})

test('pushRegion: dong 없으면 null', () => {
  assert.equal(pushRegion([], { gu: '노원구' }, 5), null)
})

test('removeRegion: 해당 dong만 제거', () => {
  const prev = [{ dong: '상계동' }, { dong: '중계동' }]
  assert.deepEqual(removeRegion(prev, '상계동').map(r => r.dong), ['중계동'])
})

test('rankRegionsWithSubs: 명시 구독(5)이 저장(2)·조회(1)를 이긴다', () => {
  const viewed = [
    { gu: '노원구', dong: '상계동' }, { gu: '노원구', dong: '상계동' },
    { gu: '노원구', dong: '상계동' }, { gu: '노원구', dong: '상계동' },
  ]
  const saved = [{ gu: '노원구', dong: '상계동' }]
  const subs  = [{ gu: '강남구', dong: '대치동' }]
  // 노원 = 4*1 + 1*2 = 6, 강남 = 5 → 아직 노원
  assert.equal(rankRegionsWithSubs(viewed, saved, subs).gu, '노원구')
  // 구독 2개면 강남 10 > 노원 6
  assert.equal(rankRegionsWithSubs(viewed, saved, [
    { gu: '강남구', dong: '대치동' }, { gu: '강남구', dong: '역삼동' },
  ]).gu, '강남구')
})

test('rankRegionsWithSubs: subscribed 플래그로 카피 분기 가능', () => {
  const out = rankRegionsWithSubs([], [], [{ gu: '강남구', dong: '대치동' }])
  assert.equal(out.gu, '강남구')
  assert.equal(out.subscribed, true)

  const out2 = rankRegionsWithSubs([{ gu: '노원구', dong: '상계동' }], [], [])
  assert.equal(out2.subscribed, false)
})

test('rankRegionsWithSubs: 데이터 없으면 null', () => {
  assert.equal(rankRegionsWithSubs([], [], []), null)
})
