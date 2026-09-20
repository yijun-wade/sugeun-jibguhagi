import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrerenderHtml } from '../_prerender.js'

const HELIO = { kaptCode: 'A1', kaptName: '헬리오시티아파트', addr: '서울특별시 송파구 가락동', kaptdaCnt: 9510, useAprDay: '20181228', summary: '9,510세대 대규모 단지입니다', aptType: 'mixed' }
const PRICE = { avg: 289417, perPy: 11260, count: 12, ym: '202608', mainArea: 85, areas: [{ area: 85, py: 26, count: 101, median: 286000, min: 200000, max: 315000 }] }
const TREND = [{ ym: '202607', avg: 280000, count: 9 }, { ym: '202608', avg: 289417, count: 12 }]
const VIBE = { s: '대단지라 편하대요', c: [{ label: '교통', lines: ['송파역 도보 1분이래요'] }], l: [{ tag: '블로그', title: '헬리오 <b>후기</b>', link: 'https://blog.naver.com/x' }], t: '2026-09-19' }
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

test('title은 그대로 둔다 — 지금 네이버 순위가 걸려 있는 유일한 필드다', () => {
  const html = buildPrerenderHtml(HELIO, {})
  assert.ok(html.includes('<title>헬리오시티아파트 실거주 후기·동네 분위기·실거래가 | 수군수군 우리집</title>'))
})

test('요약·카테고리·가격·추이·원문 링크가 본문에 실린다', () => {
  const html = buildPrerenderHtml(HELIO, { vibe: VIBE, price: PRICE, trend: TREND })
  const t = text(html)
  for (const s of ['대단지라 편하대요', '송파역 도보 1분이래요', '28억 9,417만', '85㎡', '2026년 8월', '9,510세대 대규모 단지입니다']) {
    assert.ok(t.includes(s), `본문에 "${s}"가 있어야 한다`)
  }
  assert.ok(html.includes('href="https://blog.naver.com/x"') && html.includes('rel="nofollow noopener"'))
  assert.ok(!html.includes('<b>후기</b>'), '외부 글 제목의 태그는 이스케이프')
  assert.ok(t.length > 400, `가시 텍스트가 너무 짧다: ${t.length}`)
})

test('FAQ 구조화 데이터는 실제로 답할 내용이 있는 카테고리만', () => {
  const html = buildPrerenderHtml(HELIO, { vibe: VIBE })
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]))
  const faq = ld.find(x => x['@type'] === 'FAQPage')
  assert.equal(faq.mainEntity.length, 1)
  assert.ok(faq.mainEntity[0].name.includes('교통'))
  assert.equal(buildPrerenderHtml(HELIO, {}).includes('FAQPage'), false)
})

test('실거래가 없는 임대 단지에는 실거래가를 약속하지 않는다', () => {
  const rental = { kaptCode: 'R1', kaptName: '공덕동 크로시티 행복주택', addr: '서울특별시 마포구 공덕동', kaptdaCnt: 350, aptType: 'rental', summary: '2023년 준공 신축 행복주택입니다' }
  const html = buildPrerenderHtml(rental, { vibe: VIBE })
  const t = text(html).replace(/^.*?수군수군 우리집/, '') // title 뒤부터
  assert.ok(t.includes('공공임대'))
  assert.ok(!/<meta name="description" content="[^"]*실거래가/.test(html), 'description에 실거래가 약속이 없어야 한다')
  assert.ok(!t.includes('최근 실거래가'))
})

test('유사 단지는 내부 링크로 실린다', () => {
  const html = buildPrerenderHtml(HELIO, { similar: [{ code: 'A2', name: '잠실파크리오', dong: '신천동', avg: 283038 }] })
  assert.ok(html.includes('href="https://www.suzip.kr/apt/A2"'))
  assert.ok(text(html).includes('잠실파크리오'))
})

test('데이터가 하나도 없어도 깨지지 않고, 지역은 구로 나온다', () => {
  const html = buildPrerenderHtml({ kaptCode: 'X', kaptName: '이름만<있는>단지', addr: '서울특별시 은평구 수색동' }, {})
  assert.ok(html.includes('이름만&lt;있는&gt;단지'))
  assert.ok(text(html).includes('은평구 수색동'))
  assert.ok(!text(html).includes('undefined') && !text(html).includes('NaN'))
})
