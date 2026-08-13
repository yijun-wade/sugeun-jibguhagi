import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeDate, normalizeTitle, findDuplicate, parseNaverJson } from '../../scripts/publish/lib/published.mjs'

test('네이버 응답의 비표준 이스케이프를 견딘다', () => {
  // 실제 응답에 <div class=\'blog2_paginate\'> 가 들어 있다. JSON에서 \' 는 무효라
  // JSON.parse가 그대로 던지고, 중복 탐지가 통째로 죽는다(2026-08-13 실제 발생).
  const raw = String.raw`{"resultCode":"S","postList":[{"logNo":"1","title":"a+b","addDate":"2026. 7. 23."}],"html":"<div class=\'x\'>"}`
  assert.throws(() => JSON.parse(raw), '전제가 깨졌다 — 표준 JSON으로 파싱된다')
  const d = parseNaverJson(raw)
  assert.equal(d.resultCode, 'S')
  assert.equal(d.postList.length, 1)
})

test('normalizeDate — 네이버 형식을 ISO로', () => {
  assert.equal(normalizeDate('2026. 7. 23.'), '2026-07-23')
  assert.equal(normalizeDate('2026. 12. 5.'), '2026-12-05')
  assert.equal(normalizeDate(''), null)
  assert.equal(normalizeDate(undefined), null)
})

test('normalizeTitle — 공백·문장부호 차이를 무시한다', () => {
  assert.equal(
    normalizeTitle('집값 오르는데, 대출은 막혀...'),
    normalizeTitle('집값오르는데 대출은막혀'),
  )
})

const posts = [
  { logNo: '1', title: '금리 올리고 대출 줄인다, 집 사려던 사람들 어쩌나', addDate: '2026. 7. 23.' },
  { logNo: '2', title: '양도세 중과 유예 D-3, 강남·마포에 급매물이 늘어나는 이유', addDate: '2026. 7. 22.' },
]

test('중복 탐지 — 같은 제목이면 잡는다', () => {
  const d = findDuplicate(posts, '금리 올리고 대출 줄인다, 집 사려던 사람들 어쩌나')
  assert.equal(d?.logNo, '1')
})

test('중복 탐지 — 문장부호가 달라도 잡는다', () => {
  // 네이버 에디터가 제목을 다듬는 경우가 있다
  const d = findDuplicate(posts, '금리 올리고 대출 줄인다 집 사려던 사람들 어쩌나!')
  assert.equal(d?.logNo, '1')
})

test('중복 탐지 — 다른 글은 잡지 않는다', () => {
  assert.equal(findDuplicate(posts, '보유세 인상에 전세난 심화, 금융규제까지 겹치다'), null)
})

test('중복 탐지 — 빈 제목은 무엇과도 매칭되지 않는다', () => {
  // 빈 문자열이 모든 제목에 "포함"되어 전부 중복으로 판정되면 발행이 영구히 막힌다
  assert.equal(findDuplicate(posts, ''), null)
  assert.equal(findDuplicate(posts, null), null)
})

test('중복 탐지 — 짧은 제목은 포함관계로 매칭하지 않는다', () => {
  // "집값"이 여러 제목에 들어간다고 중복은 아니다
  assert.equal(findDuplicate(posts, '금리'), null)
})
