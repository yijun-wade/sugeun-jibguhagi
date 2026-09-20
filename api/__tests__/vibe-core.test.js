import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseVibe, collectSources, generateVibe, MIN_SOURCES } from '../_vibe-core.js'

test('parseVibe: 카테고리·총평을 뽑고 "정보 없음"은 버린다', () => {
  const r = parseVibe('[교통]\n역까지 5분이래요\n버스 많대요\n[학군]\n정보 없음\n[분위기]\n조용한 편이래요\n[이슈]\n정보 없음\n[총평]\n조용히 살기 좋대요\n')
  assert.deepEqual(r.categories.find(c => c.label === '교통').lines, ['역까지 5분이래요', '버스 많대요'])
  assert.deepEqual(r.categories.find(c => c.label === '학군').lines, [])
  assert.equal(r.summary, '조용히 살기 좋대요')
})

test('parseVibe: 형식이 깨져도 죽지 않는다', () => {
  const r = parseVibe('죄송하지만 요약할 수 없어요')
  assert.equal(r.summary, null)
  assert.ok(r.categories.every(c => c.lines.length === 0))
})

const fakeSearch = (map) => async (endpoint, query) => {
  const key = Object.keys(map).find(k => query.includes(k))
  return key ? map[key] : []
}

test('collectSources: 동명 단지 글을 거르고, 남은 글 수와 원문 링크를 돌려준다', async () => {
  const search = fakeSearch({
    '살아보니': [
      { title: '마포 DMC청구 후기', description: '성산동', link: 'a' },
      { title: 'DMC청구 살아보니', description: '수색동 조용', link: 'b' },
    ],
    '동네 분위기': [{ title: '수색동 동네 분위기', description: '한적', link: 'c' }],
  })
  const r = await collectSources({ aptName: 'DMC청구아파트', location: '수색동', gu: '은평구' }, { naverSearch: search })
  assert.equal(r.count, 2)
  // 원문 링크는 단지를 직접 말한 글만 — 동네 글(c)은 요약 재료로는 쓰되 링크로는 안 내보낸다.
  assert.deepEqual(r.links.map(l => l.link), ['b'])
  assert.ok(r.sections.includes('수색동 조용'))
  assert.ok(!r.sections.includes('성산동'))
})

test('generateVibe: 글이 모자라면 모델을 부르지 않고 empty로 끝낸다', async () => {
  let called = 0
  const r = await generateVibe(
    { aptName: '이름없는단지', location: '어딘가동', gu: '은평구' },
    { naverSearch: fakeSearch({ '살아보니': [{ title: '글 하나', description: 'x', link: 'a' }] }), callModel: async () => { called++; return '' } },
  )
  assert.equal(called, 0)
  assert.equal(r.empty, true)
  assert.ok(MIN_SOURCES >= 2)
})

test('generateVibe: 모델 출력에 내용이 하나도 없으면 empty', async () => {
  const items = [1, 2, 3, 4].map(i => ({ title: `DMC청구 수색동 글${i}`, description: '내용', link: `l${i}` }))
  const r = await generateVibe(
    { aptName: 'DMC청구아파트', location: '수색동', gu: '은평구' },
    { naverSearch: fakeSearch({ '살아보니': items }), callModel: async () => '[교통]\n정보 없음\n[총평]\n' },
  )
  assert.equal(r.empty, true)
})

test('collectSources: 동 이름으로 검색한 결과라도 그 동을 말하지 않는 글은 버린다', async () => {
  const search = fakeSearch({
    '동네 분위기': [
      { title: '성북동 길상사', description: '가을 산책', link: 'x' },
      { title: '공덕동 살기 어떤가요', description: '직장인 많아요', link: 'y' },
    ],
  })
  const r = await collectSources({ aptName: '공덕동 크로시티 행복주택', location: '공덕동', gu: '마포구' }, { naverSearch: search })
  assert.equal(r.count, 1)
  assert.ok(!r.sections.includes('길상사'))
})

import { buildSummaryPrompt } from '../_vibe-core.js'
test('임대 단지 프롬프트: 입주자 관점, 계층 평가 금지', () => {
  const rental = buildSummaryPrompt({ aptName: 'X행복주택', gu: '마포구', location: '공덕동', sections: 's', aptType: 'rental' })
  assert.ok(rental.includes('공공임대·청년주택') && rental.includes('소득·계층'))
  const sale = buildSummaryPrompt({ aptName: 'X', gu: '마포구', location: '공덕동', sections: 's' })
  assert.ok(!sale.includes('소득·계층'))
})
