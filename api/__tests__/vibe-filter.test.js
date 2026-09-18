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

// ── 주제 언급 확인 ─────────────────────────────────────────────────────────
import { mentionsSubject } from '../_vibe-filter.js'

test('mentionsSubject: 단지명 토큰이나 동 이름이 하나도 없는 글은 무관한 글이다', () => {
  // 실제로 "공덕동 크로시티 행복주택 살아보니" 검색에 "수원시 지역화폐 가맹점"이 걸려 출처 링크로 나갔다.
  const ctx = { aptName: '공덕동 크로시티 행복주택', dong: '공덕동' }
  assert.equal(mentionsSubject(item('수원시 지역화폐 가맹점 알아보기(2탄)', '행복주택 근처 가맹점'), ctx), false) // '행복주택'은 일반어
  assert.equal(mentionsSubject(item('크로시티 입주 후기'), ctx), true)
  assert.equal(mentionsSubject(item('공덕동 살기 어때요'), ctx), true)
})

test("mentionsSubject: '아파트' 꼬리·단지 번호·띄어쓰기가 달라도 잡는다", () => {
  assert.equal(mentionsSubject(item('DMC청구 주차 후기'), { aptName: 'DMC청구아파트', dong: '수색동' }), true)
  assert.equal(mentionsSubject(item('위례 포레샤인 13단지 입주'), { aptName: '위례포레샤인13단지아파트', dong: '거여동' }), true)
  assert.equal(mentionsSubject(item('헬리오시티 살아보니'), { aptName: '헬리오시티아파트', dong: '가락동' }), true)
})

test('filterRelevant(requireSubject): 무관한 글을 먼저 버린다', () => {
  const items = [item('수원시 지역화폐 가맹점'), item('크로시티 행복주택 당첨 후기', '마포구 공덕동')]
  const r = filterRelevant(items, { aptName: '공덕동 크로시티 행복주택', gu: '마포구', dong: '공덕동', requireSubject: true })
  assert.deepEqual(r.map(i => i.title), ['크로시티 행복주택 당첨 후기'])
})

test('mentionsSubject: 단지명 앞의 행정동만 같은 글은 단지 글이 아니다', () => {
  const ctx = { aptName: '공덕동 크로시티 행복주택' } // dong을 안 넘기면 단지명만으로 본다(원문 링크 판정)
  assert.equal(mentionsSubject(item('중국냉면, 짜장밥 - 공덕동의 장가방'), ctx), false)
  assert.equal(mentionsSubject(item('이민석 서울시의원, 공덕동 크로시티 행복주택 방문'), ctx), true)
  // 이름 전체가 동 이름뿐인 단지는 그대로 둔다
  assert.equal(mentionsSubject(item('목동 10단지 매매 후기'), { aptName: '목동10단지' }), true)
})
