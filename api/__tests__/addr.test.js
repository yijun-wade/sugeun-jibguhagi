import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAddr as server } from '../_addr.js'
import { parseAddr as client } from '../../src/addr.js'

// 서버·클라이언트 미러가 같은 결과를 내야 한다.
for (const [label, parseAddr] of [['api/_addr', server], ['src/addr', client]]) {
  test(`${label}: 서울 주소는 '서울특별시'가 아니라 구를 돌려준다`, () => {
    // 회귀: '시'로 끝나는 '서울특별시'가 먼저 걸려 모든 서울 단지의 구가 '서울특별시'였다.
    // 그 결과 유사단지의 "같은 구 우선"이 한 번도 작동하지 않았다.
    assert.deepEqual(parseAddr('서울특별시 송파구 가락동'), { sido: '서울특별시', gu: '송파구', dong: '가락동' })
    assert.deepEqual(parseAddr('서울특별시 마포구 공덕동 123-4'), { sido: '서울특별시', gu: '마포구', dong: '공덕동' })
  })

  test(`${label}: 시 아래 구가 있으면 구, 없으면 시·군`, () => {
    assert.equal(parseAddr('경기도 성남시 분당구 정자동').gu, '분당구')
    assert.equal(parseAddr('경기도 부천시 작동').gu, '부천시')
    assert.equal(parseAddr('경기도 양평군 양평읍').gu, '양평군')
    assert.equal(parseAddr('경기도 양평군 양평읍').dong, '양평읍')
  })

  test(`${label}: 세종·빈 값도 죽지 않는다`, () => {
    assert.equal(parseAddr('세종특별자치시 어진동').gu, '세종특별자치시')
    assert.deepEqual(parseAddr(''), { sido: '', gu: '', dong: '' })
    assert.deepEqual(parseAddr(undefined), { sido: '', gu: '', dong: '' })
  })

  test(`${label}: '동'으로 끝나는 구 이름(강동구 등)을 동으로 오인하지 않는다`, () => {
    assert.deepEqual(parseAddr('서울특별시 강동구 둔촌동'), { sido: '서울특별시', gu: '강동구', dong: '둔촌동' })
    assert.equal(parseAddr('서울특별시 성동구 마장동').dong, '마장동')
  })
}

test('법정동에 숫자가 섞여도(당산동2가) 동으로 잡고, 번지(123-4)는 무시한다', () => {
  assert.equal(server('서울특별시 영등포구 당산동2가 12-3').dong, '당산동2가')
  assert.equal(client('서울특별시 중구 을지로6가').dong, '을지로6가')
})
