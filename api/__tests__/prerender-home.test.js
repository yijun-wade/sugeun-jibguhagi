import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildHomeHtml } from '../_prerender-home.js'

const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

test('홈 프리렌더는 실제 홈과 같은 문구를 낸다', () => {
  const t = text(buildHomeHtml())
  for (const s of ['퇴근 후, 이불 속에서 하는 임장', '발품 팔기 전에', '한 줄 평가']) {
    assert.ok(t.includes(s), s)
  }
})

test('내부 링크가 실린다 — 전에는 0개였다', () => {
  const html = buildHomeHtml([{ kaptCode: 'A1', kaptName: '헬리오시티아파트', sigungu: '송파구', dong: '가락동' }])
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1])
  assert.ok(links.length >= 12, `링크 ${links.length}개`)
  // 상대 경로 — 크롤러용 HTML은 /에서 서빙되고, 셸 주입도 같은 도메인이라 그대로 맞는다.
  assert.ok(links.includes('/briefing'))
  assert.ok(links.includes('/apt/A1'))
  assert.ok(links.some(l => l.includes('/search?q=')))
  assert.ok(text(html).includes('헬리오시티아파트'))
})

test('많이 찾는 단지가 없으면 그 섹션 자체를 내지 않는다', () => {
  assert.ok(!buildHomeHtml([]).includes('많이 찾는 단지'))
})

test('단지명의 특수문자를 이스케이프한다', () => {
  const html = buildHomeHtml([{ kaptCode: 'X', kaptName: '<script>bad</script>', sigungu: '', dong: '' }])
  assert.ok(!html.includes('<script>bad'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('사이트 검색 구조화 데이터를 낸다', () => {
  const ld = JSON.parse(buildHomeHtml().match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])
  assert.equal(ld['@type'], 'WebSite')
  assert.equal(ld.potentialAction['@type'], 'SearchAction')
})

import { buildHomeShell } from '../_prerender-home.js'

test('셸은 본문만 낸다 — dist/index.html의 #root에 넣을 것이라 head가 없어야 한다', () => {
  const shell = buildHomeShell([{ kaptCode: 'A1', kaptName: '헬리오시티아파트', sigungu: '송파구', dong: '가락동' }])
  assert.ok(!shell.includes('<!DOCTYPE') && !shell.includes('<head'))
  assert.ok(shell.startsWith('<h1>'))
  assert.ok(shell.includes('/apt/A1'))
})

test('셸과 크롤러 HTML이 같은 본문을 쓴다 — 두 벌이면 반드시 어긋난다', () => {
  const featured = [{ kaptCode: 'A1', kaptName: '가나단지', sigungu: '송파구', dong: '가락동' }]
  assert.ok(buildHomeHtml(featured).includes(buildHomeShell(featured)))
})
