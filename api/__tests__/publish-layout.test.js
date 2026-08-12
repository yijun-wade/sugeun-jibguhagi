import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseDraft } from '../../scripts/publish/lib/draft.mjs'
import { buildLayout, CARD_PRIORITY } from '../../scripts/publish/lib/layout.mjs'

const layoutOf = (name) =>
  buildLayout(parseDraft(readFileSync(join(process.cwd(), 'blog-posts', name), 'utf-8')))

test('대표 카드는 항상 맨 위 — afterBlockIndex -1', () => {
  const l = buildLayout(parseDraft(readFileSync(join(process.cwd(), 'blog-posts', '2026-08-05-부동산브리핑.md'), 'utf-8')))
  assert.equal(l.placements[0].card, 'title')
  assert.equal(l.placements[0].afterBlockIndex, -1)
})

test('CTA 카드는 CTA 문단 바로 앞', () => {
  const d = parseDraft(readFileSync(join(process.cwd(), 'blog-posts', '2026-08-05-부동산브리핑.md'), 'utf-8'))
  const l = buildLayout(d)
  const cta = l.placements.find((p) => p.card === 'cta')
  assert.equal(cta.afterBlockIndex, d.ctaIndex - 1)
})

test('삽입 순서는 afterBlockIndex 오름차순 — 인덱스 밀림 사고 방지', () => {
  for (const f of ['2026-08-05-부동산브리핑.md', '2026-08-01-부동산브리핑.md', '2026-07-21-부동산브리핑.md']) {
    const idx = layoutOf(f).placements.map((p) => p.afterBlockIndex)
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b), f)
  }
})

test('한 자리에 카드 두 장이 겹치지 않는다', () => {
  for (const f of ['2026-08-05-부동산브리핑.md', '2026-08-01-부동산브리핑.md', '2026-07-14-부동산브리핑.md']) {
    const idx = layoutOf(f).placements.map((p) => p.afterBlockIndex)
    assert.equal(new Set(idx).size, idx.length, f)
  }
})

test('본문이 긴 글(9블록)은 5장 전부 들어간다 — 08-05', () => {
  const l = layoutOf('2026-08-05-부동산브리핑.md')
  assert.equal(l.placements.length, 5)
  assert.deepEqual(new Set(l.placements.map((p) => p.card)), new Set(CARD_PRIORITY))
})

test('본문이 짧으면 장수를 줄인다 — 우선순위대로 남긴다', () => {
  // 실측: 8블록 글(본문 5개)이 다수. 문단마다 이미지가 박히면 글보다 이미지가 많아 보인다.
  const l = layoutOf('2026-08-03-부동산브리핑.md')
  assert.ok(l.placements.length >= 3 && l.placements.length <= 4, `${l.placements.length}장`)
  assert.ok(l.placements.some((p) => p.card === 'title'))
  assert.ok(l.placements.some((p) => p.card === 'cta'))
})

test('굵게 시작 블록이 0개여도 3장 이상 나온다 — 07-21', () => {
  // 스펙 성공기준 3번(이미지 3장 이상)이 소제목 유무에 걸리면 안 된다.
  const l = layoutOf('2026-07-21-부동산브리핑.md')
  assert.ok(l.placements.length >= 3, `${l.placements.length}장`)
  assert.ok(l.warnings.some((w) => /소제목/.test(w)))
})

test('중간 카드는 굵게 시작 블록 앞으로 스냅한다', () => {
  // 08-01의 굵게 블록은 2,3,4. 중간 카드가 그 앞에 붙어야 문단 흐름이 안 끊긴다.
  const d = parseDraft(readFileSync(join(process.cwd(), 'blog-posts', '2026-08-01-부동산브리핑.md'), 'utf-8'))
  const l = buildLayout(d)
  const middles = l.placements.filter((p) => p.card !== 'title' && p.card !== 'cta')
  assert.ok(middles.length >= 1)
  for (const m of middles) {
    assert.ok(d.subheadIndexes.includes(m.afterBlockIndex + 1), `${m.card} → ${m.afterBlockIndex} 는 소제목 앞이 아님`)
  }
})

test('중간 카드는 정부 → 시장 → 실수요자 순으로 꽂힌다', () => {
  // 3줄 요약과 card-generator가 모두 이 순서다. 버리는 우선순위(market이 먼저 탈락)를
  // 꽂는 순서로 쓰면 본문에 정부 → 실수요자 → 시장으로 나가 글의 인과가 뒤집힌다.
  const l = layoutOf('2026-08-05-부동산브리핑.md')
  const middles = l.placements.filter((p) => !['title', 'cta'].includes(p.card)).map((p) => p.card)
  assert.deepEqual(middles, ['intent', 'market', 'demand'])
})

test('2장만 남을 땐 market이 먼저 탈락한다 — 정부(원인)·실수요자(결과)는 남는다', () => {
  const l = layoutOf('2026-08-01-부동산브리핑.md')
  const middles = l.placements.filter((p) => !['title', 'cta'].includes(p.card)).map((p) => p.card)
  assert.deepEqual(middles, ['intent', 'demand'])
})

test('카드가 요약줄 위나 면책 아래로는 절대 안 간다', () => {
  for (const f of ['2026-08-05-부동산브리핑.md', '2026-08-01-부동산브리핑.md', '2026-07-28-부동산브리핑.md']) {
    const d = parseDraft(readFileSync(join(process.cwd(), 'blog-posts', f), 'utf-8'))
    const l = buildLayout(d)
    for (const p of l.placements) {
      if (p.card === 'title') continue
      assert.ok(p.afterBlockIndex >= d.summaryIndex, `${f} ${p.card} 가 요약줄 위`)
      assert.ok(p.afterBlockIndex < d.disclaimerIndex, `${f} ${p.card} 가 면책 아래`)
    }
  }
})

test('브리핑 초안 전편이 3장 이상 + 규칙 위반 0', () => {
  const files = readdirSync(join(process.cwd(), 'blog-posts')).filter((f) => /^\d{4}-\d{2}-\d{2}-부동산브리핑\.md$/.test(f))
  assert.ok(files.length >= 90, `초안 ${files.length}편`)
  const thin = []
  for (const f of files) {
    const d = parseDraft(readFileSync(join(process.cwd(), 'blog-posts', f), 'utf-8'))
    const l = buildLayout(d)
    const idx = l.placements.map((p) => p.afterBlockIndex)
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b), f)
    assert.equal(new Set(idx).size, idx.length, f)
    if (l.placements.length < 3) thin.push(`${f}(${l.placements.length})`)
  }
  assert.deepEqual(thin, [], `3장 미만: ${thin.join(', ')}`)
})
