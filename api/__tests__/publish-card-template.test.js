import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { splitLead, renderCardsHtml, CARD_KEYS } from '../../scripts/publish/card-template.mjs'

const briefing = (d) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'briefings', `${d}.json`), 'utf-8'))

test('splitLead — 첫 문장을 헤드라인으로, 나머지를 본문으로', () => {
  const r = splitLead('가는 안정이다. 나는 반발이다. 다는 억제다.')
  assert.equal(r.lead, '가는 안정이다.')
  assert.equal(r.rest, '나는 반발이다. 다는 억제다.')
})

test('splitLead — 문장이 하나뿐이면 본문은 빈다', () => {
  const r = splitLead('한 문장만 있다.')
  assert.equal(r.lead, '한 문장만 있다.')
  assert.equal(r.rest, '')
})

test('splitLead — 빈 입력에도 던지지 않는다', () => {
  for (const v of [undefined, null, '', '   ']) {
    assert.deepEqual(splitLead(v), { lead: '', rest: '' })
  }
})

test('카드2·3 헤드라인이 하드코딩이 아니라 그날 데이터에서 나온다', () => {
  // 원본 card-generator.html은 "투기는 잡되, 실수요자는 보호하겠다는 뜻" /
  // "급매는 끝났다. 가격은 다시 오르는 중" 을 하드코딩했다. 수동 1회용이면 괜찮지만
  // 매일 자동 발행하면 그날 브리핑과 무관한 문장이 나가 사실과 어긋난다.
  const html = renderCardsHtml(briefing('2026-08-05'))
  assert.ok(!html.includes('투기는 잡되'), '카드2 하드코딩 헤드라인이 남아 있다')
  assert.ok(!html.includes('급매는 끝났다'), '카드3 하드코딩 헤드라인이 남아 있다')
  assert.ok(html.includes(splitLead(briefing('2026-08-05').intent).lead))
  assert.ok(html.includes(splitLead(briefing('2026-08-05').market).lead))
})

test('카드 5장이 layout.mjs가 쓰는 키로 나온다', () => {
  const html = renderCardsHtml(briefing('2026-08-05'))
  for (const k of CARD_KEYS) assert.ok(html.includes(`data-card="${k}"`), `${k} 카드 없음`)
  assert.deepEqual(CARD_KEYS, ['title', 'intent', 'market', 'demand', 'cta'])
})

test('html2canvas 의존이 남아 있지 않다', () => {
  const html = renderCardsHtml(briefing('2026-08-05'))
  assert.ok(!/html2canvas/i.test(html))
  assert.ok(!/<script[^>]+src=/i.test(html), '외부 스크립트를 불러온다')
})

test('HTML 이스케이프 — 브리핑 텍스트가 마크업을 깨뜨리지 못한다', () => {
  const html = renderCardsHtml({
    date: '2026-01-01',
    title: '<script>bad()</script>',
    intent: '따옴표 " 와 꺾쇠 <b> 가 있다. 나머지 문장.',
    market: '시장. 나머지.',
    demand: { buy: '<img onerror=x>', lease: '전세', rent: '월세' },
  })
  assert.ok(!html.includes('<script>bad()'), 'script가 그대로 들어감')
  assert.ok(!html.includes('<img onerror'), 'img가 그대로 들어감')
  assert.ok(html.includes('&lt;script&gt;'))
})

test('필드가 비어도 렌더는 된다 — 던지지 않는다', () => {
  const html = renderCardsHtml({ date: '2026-01-01' })
  for (const k of CARD_KEYS) assert.ok(html.includes(`data-card="${k}"`))
})

test('브리핑 전편이 렌더 가능 — 던지는 날이 없다', () => {
  const files = readdirSync(join(process.cwd(), 'public', 'briefings')).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  assert.ok(files.length > 50, `브리핑 ${files.length}건`)
  for (const f of files) {
    const b = JSON.parse(readFileSync(join(process.cwd(), 'public', 'briefings', f), 'utf-8'))
    const html = renderCardsHtml(b)
    assert.ok(html.length > 2000, `${f} 렌더 결과가 너무 짧다`)
    for (const k of CARD_KEYS) assert.ok(html.includes(`data-card="${k}"`), `${f}: ${k} 없음`)
  }
})
