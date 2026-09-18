import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterRelevant } from '../_vibe-filter.js'

const item = (title, description = '') => ({ title, description, link: title })

test('동명 단지: 다른 구 이야기만 하는 글은 버린다 (수색동 DMC청구 vs 마포 DMC청구)', () => {
  // 실제 항의: "AI의 수근수근은 수색동 DMC청구가 아닌 마포 DMC청구 얘기네요"
  const items = [
    item('마포 DMC청구 아파트 주차 후기', '성산동이라 주차가 빡빡해요'),
    item('DMC청구 살아보니', '은평구 수색동인데 주차 걱정 없어요'),
    item('DMC청구아파트 매물', '수색역 도보 5분'),
  ]
  const r = filterRelevant(items, { aptName: 'DMC청구아파트', gu: '은평구', dong: '수색동' })
  assert.deepEqual(r.map(i => i.title), ['DMC청구 살아보니', 'DMC청구아파트 매물'])
})

test('지역 언급이 전혀 없는 글은 남긴다 — 모르는 것까지 버리면 소규모 단지는 자료가 0이 된다', () => {
  const r = filterRelevant([item('헬리오시티 살아보니 좋아요', '커뮤니티 시설이 잘 돼 있음')],
    { aptName: '헬리오시티아파트', gu: '송파구', dong: '가락동' })
  assert.equal(r.length, 1)
})

test('우리 구·동을 같이 말하면 다른 구가 나와도 남긴다 (비교 글)', () => {
  const r = filterRelevant([item('은평 수색동 DMC청구 vs 마포 성산시영 비교')],
    { aptName: 'DMC청구아파트', gu: '은평구', dong: '수색동' })
  assert.equal(r.length, 1)
})

test('단지명 안에 들어 있는 다른 구 이름은 "다른 구 언급"으로 세지 않는다', () => {
  // 서울숲·북한산·마포… 단지명에 지명이 든 경우가 흔하다. 단지명을 지우고 본다.
  const r = filterRelevant([item('마포래미안푸르지오 임장 후기', '언덕이 좀 있어요')],
    { aptName: '마포래미안푸르지오', gu: '마포구', dong: '아현동' })
  assert.equal(r.length, 1)
  const r2 = filterRelevant([item('강남한양수자인 입주 후기')],
    { aptName: '강남한양수자인', gu: '강남구', dong: '자곡동' })
  assert.equal(r2.length, 1)
})

test("'중구'처럼 흔한 글자와 겹치는 구는 짧은 이름으로 세지 않는다", () => {
  const r = filterRelevant([item('공덕동 크로시티 행복주택 후기', '입주 중인데 중간층이라 조용해요')],
    { aptName: '공덕동 크로시티 행복주택', gu: '마포구', dong: '공덕동' })
  assert.equal(r.length, 1)
})

test('gu를 모르면 거르지 않는다', () => {
  const items = [item('마포 DMC청구 후기')]
  assert.equal(filterRelevant(items, { aptName: 'DMC청구아파트' }).length, 1)
  assert.deepEqual(filterRelevant(null, {}), [])
})
