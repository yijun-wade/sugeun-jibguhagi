import { test } from 'node:test'
import assert from 'node:assert/strict'
import { acceptStatic, loadVibe, STALE_DAYS } from '../../src/vibe-loader.js'

const NOW = new Date('2026-09-19T00:00:00Z').getTime()
const doc = (over = {}) => ({ kaptCode: 'A1', generatedAt: '2026-09-01T00:00:00Z', summary: '살 만하대요', categories: [{ label: '교통', lines: ['역 5분'] }], links: [], ...over })

test('acceptStatic: 신선하고 단지 코드가 맞는 파일만 받는다', () => {
  assert.ok(acceptStatic(doc(), 'A1', NOW))
  assert.equal(acceptStatic(doc(), 'A2', NOW), null, '다른 단지 파일')
  assert.equal(acceptStatic(doc({ generatedAt: '2026-01-01T00:00:00Z' }), 'A1', NOW), null, `${STALE_DAYS}일 넘은 파일`)
  assert.equal(acceptStatic(null, 'A1', NOW), null)
  assert.equal(acceptStatic({ foo: 1 }, 'A1', NOW), null)
})

test('acceptStatic: 글 부족(empty)도 유효한 답이다 — 실시간으로 다시 물어봐야 같은 결과다', () => {
  const r = acceptStatic(doc({ empty: true, summary: undefined, categories: undefined }), 'A1', NOW)
  assert.equal(r.empty, true)
  assert.deepEqual(r.categories, [])
})

const res = (body, { ok = true, type = 'application/json' } = {}) => ({ ok, headers: { get: () => type }, json: async () => body })

test('loadVibe: 정적 파일이 있으면 API를 부르지 않는다', async () => {
  const calls = []
  const fetchFn = async (url) => { calls.push(url); return res(doc()) }
  const r = await loadVibe({ kaptCode: 'A1', aptNm: 'X' }, { fetchFn, now: NOW })
  assert.equal(r.source, 'static')
  assert.equal(r.summary, '살 만하대요')
  assert.deepEqual(calls, ['/vibe/A1.json'])
})

test('loadVibe: 정적 파일이 없으면(SPA 폴백 HTML 포함) 실시간 API로 넘어간다', async () => {
  const calls = []
  const fetchFn = async (url) => {
    calls.push(url)
    // Vercel은 없는 경로를 index.html(200, text/html)로 돌려준다 — 404가 아니다.
    if (url.startsWith('/vibe/')) return res('<!doctype html>', { type: 'text/html' })
    return res({ categories: [{ label: '분위기', lines: ['조용'] }], summary: '조용하대요' })
  }
  const r = await loadVibe({ kaptCode: 'A9', aptNm: '이름 단지', dong: '수색동', gu: '은평구', aptType: 'rental' }, { fetchFn, now: NOW })
  assert.equal(r.source, 'live')
  assert.equal(r.summary, '조용하대요')
  assert.ok(calls[1].startsWith('/api/vibe?') && calls[1].includes('type=rental') && calls[1].includes('gu='))
})

test('loadVibe: 둘 다 실패해도 던지지 않고 빈 결과', async () => {
  const r = await loadVibe({ kaptCode: 'A1', aptNm: 'X' }, { fetchFn: async () => { throw new Error('net') }, now: NOW })
  assert.deepEqual(r.categories, [])
  assert.equal(r.source, 'error')
})

test("loadVibe: API가 error를 돌려주면 '글 없음'이 아니라 실패로 구분한다", async () => {
  const fetchFn = async (url) => url.startsWith('/vibe/') ? res('', { type: 'text/html' }) : res({ categories: [], error: true })
  const r = await loadVibe({ kaptCode: 'A1', aptNm: 'X' }, { fetchFn, now: NOW })
  assert.equal(r.source, 'error')
  assert.equal(r.empty, false)
})
