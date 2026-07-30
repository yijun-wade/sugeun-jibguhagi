import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pushInterest, rankRegions, matchRegion } from '../../src/interest-core.js'

test('pushInterest: 최신 항목을 맨 앞에 넣는다', () => {
  const out = pushInterest([{ kaptCode: 'A' }], { kaptCode: 'B' })
  assert.deepEqual(out.map(a => a.kaptCode), ['B', 'A'])
})

test('pushInterest: 같은 kaptCode는 중복 제거하고 최신으로 올린다', () => {
  const out = pushInterest([{ kaptCode: 'A' }, { kaptCode: 'B' }], { kaptCode: 'A' })
  assert.deepEqual(out.map(a => a.kaptCode), ['A', 'B'])
})

test('pushInterest: 최대 개수 상한을 지킨다', () => {
  const list = Array.from({ length: 10 }, (_, i) => ({ kaptCode: `K${i}` }))
  const out = pushInterest(list, { kaptCode: 'NEW' }, 10)
  assert.equal(out.length, 10)
  assert.equal(out[0].kaptCode, 'NEW')
  assert.equal(out.at(-1).kaptCode, 'K8') // K9가 밀려남
})

test('pushInterest: 빈/비배열 입력도 안전', () => {
  assert.deepEqual(pushInterest(null, { kaptCode: 'A' }).map(a => a.kaptCode), ['A'])
})

test('rankRegions: 저장(가중2)이 조회(가중1)보다 우선한다', () => {
  const viewed = [{ gu: '노원구', dong: '상계동' }, { gu: '노원구', dong: '중계동' }]
  const saved = [{ gu: '강남구', dong: '대치동' }]
  // 노원 점수 2(1+1) vs 강남 2 → 동점이면 saved(강남) 먼저 삽입되어 우선
  assert.equal(rankRegions(viewed, saved).gu, '강남구')
})

test('rankRegions: 최고 가중 gu와 그 안의 dong을 반환', () => {
  const viewed = [{ gu: '노원구', dong: '상계동' }, { gu: '노원구', dong: '중계동' }, { gu: '강남구', dong: '대치동' }]
  const out = rankRegions(viewed, [])
  assert.equal(out.gu, '노원구')
  assert.equal(out.dong, '상계동')
})

test('rankRegions: 데이터 없으면 null', () => {
  assert.equal(rankRegions([], []), null)
  assert.equal(rankRegions([{ dong: '상계동' }], []), null) // gu 없는 항목은 제외
})

test('matchRegion: gu 또는 dong 언급 시 true', () => {
  assert.equal(matchRegion('노원구 아파트값 상승', '노원구', '상계동'), true)
  assert.equal(matchRegion('상계동 재건축 이슈', '노원구', '상계동'), true)
  assert.equal(matchRegion('강남 대치동 학군', '노원구', '상계동'), false)
  assert.equal(matchRegion('', '노원구', '상계동'), false)
})
