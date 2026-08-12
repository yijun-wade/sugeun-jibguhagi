import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseDraft } from '../../scripts/publish/lib/draft.mjs'

const fixture = (name) => readFileSync(join(process.cwd(), 'blog-posts', name), 'utf-8')

// 실제 초안 3종. 형식이 서로 다르다는 것이 이 테스트의 요점.
//  - 08-05: 굵게 소제목이 "단독 줄" (30편 중 2편뿐인 소수 형식)
//  - 08-01: 굵게 "리드인 + 이어지는 본문" (다수 형식)
//  - 07-21: 굵게 시작 블록이 아예 0개
//  - 07-17: 요약·CTA·면책이 2번씩 — 한 파일에 글 2편이 섞인 이상치
const MD_STANDALONE = fixture('2026-08-05-부동산브리핑.md')
const MD_LEADIN = fixture('2026-08-01-부동산브리핑.md')
const MD_NO_BOLD = fixture('2026-07-21-부동산브리핑.md')
const MD_DOUBLED = fixture('2026-07-17-부동산브리핑.md')

test('제목 — # 한 줄을 뽑고 본문에서 제외한다', () => {
  const d = parseDraft(MD_STANDALONE)
  assert.equal(d.title, '보유세 인상과 금융규제의 완벽한 폭풍, 전세난 시작되다')
  assert.ok(!d.blocks.some((b) => b.text.startsWith('# ')))
})

test('태그 — 쉼표 분해, 카테고리·발행 메타는 버린다', () => {
  const d = parseDraft(MD_STANDALONE)
  assert.deepEqual(d.tags, ['보유세', '전세난', '부동산정책', '금융규제', '월세인상', '주택시장', '2026년세제개편'])
  assert.ok(!d.blocks.some((b) => /^>\s*(카테고리|발행)/.test(b.text)))
})

test('--- 구분선은 블록에 남지 않는다', () => {
  const d = parseDraft(MD_STANDALONE)
  assert.ok(!d.blocks.some((b) => /^-{3,}$/.test(b.text)))
})

test('본문은 통짜가 아니라 블록 배열이다', () => {
  // 통짜로 붙여넣으면 네이버에서 문단이 한 덩어리로 뭉친다 — 스펙 STEP 2
  const d = parseDraft(MD_STANDALONE)
  assert.ok(d.blocks.length >= 6, `블록이 ${d.blocks.length}개뿐`)
  assert.ok(d.blocks.every((b) => b.text.trim().length > 0))
})

test('요약줄 — 굵게가 여러 개인 첫 블록. 소제목이 아니다', () => {
  const d = parseDraft(MD_STANDALONE)
  assert.equal(d.summaryIndex, 0)
  assert.equal(d.blocks[0].type, 'summary')
  assert.ok(!d.subheadIndexes.includes(0))
})

test('CTA·면책 위치를 인덱스로 돌려준다', () => {
  const d = parseDraft(MD_STANDALONE)
  assert.ok(d.ctaIndex > d.summaryIndex)
  assert.equal(d.blocks[d.ctaIndex].type, 'cta')
  assert.equal(d.blocks[d.disclaimerIndex].type, 'disclaimer')
  assert.equal(d.disclaimerIndex, d.blocks.length - 1)
})

test('단독 줄 소제목을 subhead로 잡는다 (08-05)', () => {
  const d = parseDraft(MD_STANDALONE)
  assert.equal(d.subheadIndexes.length, 4)
  for (const i of d.subheadIndexes) {
    assert.equal(d.blocks[i].type, 'subhead')
    assert.equal(d.blocks[i].standalone, true)
  }
})

test('굵게 리드인도 subhead로 잡는다 (08-01) — 다수 형식', () => {
  const d = parseDraft(MD_LEADIN)
  assert.equal(d.subheadIndexes.length, 3)
  // 리드인은 뒤에 본문이 이어붙어 있으므로 standalone이 아니다
  assert.equal(d.blocks[d.subheadIndexes[0]].standalone, false)
  assert.ok(d.blocks[d.subheadIndexes[0]].text.length > 60)
})

test('굵게 시작 블록이 0개여도 에러가 아니다 (07-21)', () => {
  // 판단은 layout이 한다. draft는 사실만 보고한다.
  const d = parseDraft(MD_NO_BOLD)
  assert.deepEqual(d.subheadIndexes, [])
  assert.ok(d.ctaIndex > 0)
  assert.ok(d.title.length > 0)
})

test('제목이 2줄로 쪼개져도 한 줄로 합친다 (07-28)', () => {
  // 네이버 제목은 한 줄이다. 둘째 줄을 본문으로 흘리면 요약줄 앞에 미아 블록이 생긴다.
  const d = parseDraft(fixture('2026-07-28-부동산브리핑.md'))
  assert.equal(d.title, '집값은 오르는데 대출은 안 된다? 2030년 내 집 마련이 위험하다')
  assert.equal(d.summaryIndex, 0)
})

test('글 2편이 섞인 초안은 첫 편에서 잘라내고 경고한다 (07-17)', () => {
  // 상류 generate-blog-post.mjs의 라벨 파싱 실패 산출물(124편 중 2편).
  // 자르지 않으면 면책 문구 뒤에 두 번째 글이 통째로 딸려 발행된다.
  const d = parseDraft(MD_DOUBLED)
  assert.equal(d.disclaimerIndex, d.blocks.length - 1)
  assert.equal(d.blocks.filter((b) => b.type === 'cta').length, 1)
  assert.equal(d.blocks.filter((b) => b.type === 'summary').length, 1)
  assert.ok(d.warnings.some((w) => /2편|중복/.test(w)), d.warnings.join(' | '))
})

test('[본문]·[태그] 같은 라벨 헤딩은 본문에서 제거한다 (07-17)', () => {
  const d = parseDraft(MD_DOUBLED)
  assert.ok(!d.blocks.some((b) => /^#*\s*\[(제목|본문|태그)\]/.test(b.text)), '라벨 헤딩이 본문에 남음')
  assert.equal(d.title, "대출 반토막, 월세는 올라… 실수요자 '옥죄기'")
})

test('제목·태그가 없어도 던지지 않는다 — 빈 값으로 내려보낸다', () => {
  const d = parseDraft('본문만 있는 글이에요.\n\n관심 단지 실거래가가 궁금하시면 suzip.kr에서 확인해보세요.\n')
  assert.equal(d.title, '')
  assert.deepEqual(d.tags, [])
  assert.ok(d.warnings.length >= 1)
})

test('본문 블록 범위 — 요약 다음부터 CTA 직전까지', () => {
  const d = parseDraft(MD_LEADIN)
  assert.equal(d.bodyStart, d.summaryIndex + 1)
  assert.equal(d.bodyEnd, d.ctaIndex - 1)
  assert.ok(d.bodyEnd >= d.bodyStart)
})
