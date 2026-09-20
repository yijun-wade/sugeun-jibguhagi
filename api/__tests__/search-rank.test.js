import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankResults } from '../_search-rank.js'

const HELIO_BUCHEON = { kaptCode: 'B1', kaptName: '헬리오시티', addr: '경기도 부천오정구 작동' }
const HELIO_SEOUL   = { kaptCode: 'S1', kaptName: '헬리오시티아파트', addr: '서울특별시 송파구 가락동' }
const units = new Map([['B1', 300], ['S1', 9510]])

const rank = (list, q) => rankResults(list, q, (c) => units.get(c) || 0).map(a => a.kaptCode)

test('서울 단지가 지방 정확일치보다 앞선다 — 이름이 같으면 규모·지역이 의도를 가른다', () => {
  // 회귀: '헬리오시티' 검색 시 부천(정확일치 5)이 서울(포함 4 + 수도권 1 = 5)과 동점이 되어
  // 9,510세대 송파 헬리오시티가 2위로 밀렸다.
  assert.deepEqual(rank([HELIO_BUCHEON, HELIO_SEOUL], '헬리오시티'), ['S1', 'B1'])
})

test('경기 단지끼리는 정확일치가 포함보다 앞선다', () => {
  const a = { kaptCode: 'A', kaptName: '분당파크뷰', addr: '경기도 성남시 분당구 정자동' }
  const b = { kaptCode: 'B', kaptName: '분당파크뷰2차', addr: '경기도 성남시 분당구 수내동' }
  assert.deepEqual(rank([b, a], '분당파크뷰'), ['A', 'B'])
})

test('서울 가산점이 이름 무관 주소 매칭까지 끌어올리지는 않는다', () => {
  const nameHit = { kaptCode: 'N', kaptName: '래미안공덕', addr: '경기도 광주시 역동' }
  const addrHit = { kaptCode: 'D', kaptName: '무관단지', addr: '서울특별시 마포구 공덕동' }
  assert.deepEqual(rank([addrHit, nameHit], '공덕')[0], 'N')
})

test('동점이면 세대수 큰 단지가 앞선다', () => {
  const s = { kaptCode: 'X', kaptName: '같은이름', addr: '서울특별시 강남구 역삼동' }
  const t = { kaptCode: 'Y', kaptName: '같은이름', addr: '서울특별시 송파구 가락동' }
  const u = new Map([['X', 100], ['Y', 900]])
  assert.deepEqual(rankResults([s, t], '같은이름', (c) => u.get(c) || 0).map(a => a.kaptCode), ['Y', 'X'])
})
