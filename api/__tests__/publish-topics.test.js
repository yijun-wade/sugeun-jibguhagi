import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickTopics, keyOf, CATEGORIES } from '../../scripts/publish/lib/topics.mjs'

const pools = () => ({
  브리핑: [{ category: '브리핑', subject: '2026-08-20' }],
  용어사전: [
    { category: '용어사전', subject: '매매' },
    { category: '용어사전', subject: '전세' },
    { category: '용어사전', subject: '월세' },
  ],
  정책: [
    { category: '정책', subject: '청년 전세자금 대출 확대' },
    { category: '정책', subject: '생애최초 취득세 감면' },
  ],
  임장가이드: [
    { category: '임장가이드', subject: '노원구' },
    { category: '임장가이드', subject: '마포구' },
  ],
})

test('하루 4편이면 4개 카테고리가 전부 다르다', () => {
  // 같은 날 같은 카테고리 두 편은 서로 검색 순위를 잡아먹는다
  const { picked } = pickTopics(pools(), [], 4, '2026-08-20')
  assert.equal(picked.length, 4)
  assert.equal(new Set(picked.map((t) => t.category)).size, 4)
})

test('이미 쓴 소재는 다시 뽑지 않는다', () => {
  const used = [keyOf({ category: '용어사전', subject: '매매' })]
  for (let i = 0; i < 20; i++) {
    const { picked } = pickTopics(pools(), used, 4, `seed-${i}`)
    assert.ok(!picked.some((t) => keyOf(t) === used[0]), `seed-${i}에서 재선택됨`)
  }
})

test('뽑는 규칙과 거르는 규칙이 같다 — 골랐다가 튕기는 일이 없다', () => {
  // 지인 시스템은 뽑을 때 키워드만, 거를 때 브랜드까지 봐서 매번 같은 것을 골라
  // 매번 튕겨내며 하루를 날렸다. 여기서는 pick 결과가 항상 used와 무교집합이어야 한다.
  const used = pools().용어사전.map(keyOf).concat(pools().정책.map(keyOf))
  const { picked } = pickTopics(pools(), used, 4, '2026-08-20')
  for (const t of picked) assert.ok(!used.includes(keyOf(t)))
})

test('후보가 소진되면 조용히 넘어가지 않고 경고한다', () => {
  const p = pools()
  const used = p.용어사전.map(keyOf)
  const { picked, warnings } = pickTopics(p, used, 4, '2026-08-20')
  assert.ok(warnings.some((w) => /용어사전.*소진/.test(w)), warnings.join(' | '))
  assert.ok(!picked.some((t) => t.category === '용어사전'))
})

test('채울 수 없으면 개수 부족을 알린다 — 같은 카테고리를 두 번 쓰지 않는다', () => {
  const { picked, warnings } = pickTopics({ 브리핑: pools().브리핑 }, [], 4, '2026-08-20')
  assert.equal(picked.length, 1)
  assert.equal(new Set(picked.map((t) => t.category)).size, 1)
  assert.ok(warnings.some((w) => /확보/.test(w)))
})

test('같은 seed면 같은 결과 (멱등) — 재실행이 다른 글을 만들면 안 된다', () => {
  const a = pickTopics(pools(), [], 4, '2026-08-20').picked.map(keyOf)
  const b = pickTopics(pools(), [], 4, '2026-08-20').picked.map(keyOf)
  assert.deepEqual(a, b)
})

test('날짜가 바뀌면 카테고리 순서가 돌아간다 — 매일 같은 카테고리가 08시가 아니다', () => {
  const firsts = new Set()
  for (let d = 1; d <= 20; d++) {
    const { picked } = pickTopics(pools(), [], 4, `2026-09-${String(d).padStart(2, '0')}`)
    firsts.add(picked[0].category)
  }
  assert.ok(firsts.size >= 2, `20일간 첫 카테고리가 ${firsts.size}종류뿐`)
})

test('빈 풀에도 던지지 않는다', () => {
  const { picked, warnings } = pickTopics({}, [], 4, 'x')
  assert.deepEqual(picked, [])
  assert.ok(warnings.length >= 1)
})

test('CATEGORIES 4종이 슬롯 수와 맞는다', () => {
  assert.equal(CATEGORIES.length, 4)
})
