import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseInline, toSegments, stripInline, formatRanges } from '../../scripts/publish/lib/inline.mjs'
import { parseDraft } from '../../scripts/publish/lib/draft.mjs'

test('굵게 구간을 순서대로 세그먼트로 쪼갠다', () => {
  assert.deepEqual(parseInline('**정부** — 한줄 요약'), [
    { text: '정부', bold: true, italic: false },
    { text: ' — 한줄 요약', bold: false, italic: false },
  ])
})

test('요약줄처럼 굵게가 여러 번 나와도 순서가 유지된다', () => {
  const segs = parseInline('**정부** — 가 / **시장** — 나 / **실수요자** — 다')
  assert.deepEqual(segs.map((s) => s.bold), [true, false, true, false, true, false])
  assert.deepEqual(segs.filter((s) => s.bold).map((s) => s.text), ['정부', '시장', '실수요자'])
})

test('굵게 리드인 + 이어지는 본문 (다수 형식)', () => {
  const segs = parseInline('**정부의 의도는 좋았지만 시장은 냉정했어요.** 공급을 늘리고 자금을 풀면')
  assert.equal(segs.length, 2)
  assert.equal(segs[0].bold, true)
  assert.equal(segs[1].bold, false)
})

test('단독 줄 소제목은 굵게 세그먼트 하나', () => {
  assert.deepEqual(parseInline('**보유세 인상, 집주인들의 선택을 바꾸다**'), [
    { text: '보유세 인상, 집주인들의 선택을 바꾸다', bold: true, italic: false },
  ])
})

test('굵게가 없으면 평문 하나', () => {
  assert.deepEqual(parseInline('평범한 문단입니다.'), [{ text: '평범한 문단입니다.', bold: false, italic: false }])
})

test('빈 입력은 빈 배열 — 굵게 토글을 낭비하지 않는다', () => {
  assert.deepEqual(parseInline(''), [])
  assert.deepEqual(parseInline(null), [])
})

test('toSegments — 인접한 같은 굵기를 합쳐 토글 횟수를 줄인다', () => {
  const segs = toSegments('가**나**다')
  assert.equal(segs.length, 3)
  // 합쳐질 것이 없는 경우엔 그대로
  assert.deepEqual(segs.map((s) => s.text), ['가', '나', '다'])
})

test('면책 문구의 기울임(*…*)을 처리한다 — 별표가 발행되면 안 된다', () => {
  const segs = parseInline('*뉴스를 바탕으로 개인적으로 정리한 내용이에요.*')
  assert.deepEqual(segs, [{ text: '뉴스를 바탕으로 개인적으로 정리한 내용이에요.', bold: false, italic: true }])
})

test('굵게가 기울임 규칙에 반쪽으로 잘리지 않는다', () => {
  const segs = parseInline('**굵게** 사이 *기울임*')
  assert.deepEqual(segs.map((s) => [s.bold, s.italic]), [[true, false], [false, false], [false, true]])
})

test('stripInline — 검증용 순수 텍스트', () => {
  assert.equal(stripInline('**정부** — 한줄'), '정부 — 한줄')
  assert.equal(stripInline('*기울임*도 벗긴다'), '기울임도 벗긴다')
})

test('세그먼트를 이어붙이면 원문에서 서식만 뺀 것과 같다', () => {
  // 이게 깨지면 글자가 새거나 중복 입력된다
  const md = readFileSync(join(process.cwd(), 'blog-posts', '2026-08-05-부동산브리핑.md'), 'utf-8')
  for (const b of parseDraft(md).blocks) {
    const joined = toSegments(b.text).map((s) => s.text).join('')
    assert.equal(joined, stripInline(b.text), `블록 불일치: ${b.text.slice(0, 30)}`)
  }
})

test('초안 전편에서 세그먼트 왕복이 무손실', () => {
  const dir = join(process.cwd(), 'blog-posts')
  const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}-부동산브리핑\.md$/.test(f))
  assert.ok(files.length >= 90, `초안 ${files.length}편`)
  for (const f of files) {
    for (const b of parseDraft(readFileSync(join(dir, f), 'utf-8')).blocks) {
      const joined = toSegments(b.text).map((s) => s.text).join('')
      assert.equal(joined, stripInline(b.text), `${f}: ${b.text.slice(0, 30)}`)
    }
  }
})

test('formatRanges — 평문 오프셋으로 서식 구간을 준다', () => {
  const md = '**정부** — 한줄'
  assert.equal(stripInline(md), '정부 — 한줄')
  assert.deepEqual(formatRanges(md), [{ start: 0, end: 2, bold: true, italic: false }])
})

test('formatRanges — 요약줄의 굵게 3개가 각각 잡힌다', () => {
  const md = '**정부** — 가 / **시장** — 나 / **실수요자** — 다'
  const plain = stripInline(md)
  const ranges = formatRanges(md)
  assert.equal(ranges.length, 3)
  assert.deepEqual(ranges.map((r) => plain.slice(r.start, r.end)), ['정부', '시장', '실수요자'])
})

test('formatRanges — 기울임도 잡는다', () => {
  const md = '*뉴스를 바탕으로 정리했어요.*'
  const r = formatRanges(md)
  assert.equal(r.length, 1)
  assert.equal(r[0].italic, true)
  assert.equal(stripInline(md).slice(r[0].start, r[0].end), '뉴스를 바탕으로 정리했어요.')
})

test('formatRanges — 서식이 없으면 빈 배열', () => {
  assert.deepEqual(formatRanges('평범한 문단입니다.'), [])
})

test('formatRanges — 초안 전편에서 구간이 평문 범위를 벗어나지 않는다', () => {
  const dir = join(process.cwd(), 'blog-posts')
  for (const f of readdirSync(dir).filter((x) => /^\d{4}-\d{2}-\d{2}-부동산브리핑\.md$/.test(x))) {
    for (const b of parseDraft(readFileSync(join(dir, f), 'utf-8')).blocks) {
      const plain = stripInline(b.text)
      for (const r of formatRanges(b.text)) {
        assert.ok(r.start >= 0 && r.end <= plain.length && r.start < r.end, `${f}: ${JSON.stringify(r)} vs ${plain.length}`)
      }
    }
  }
})
