import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyAptType as server, isRentalName as serverName } from '../_apt-type.js'
import { classifyAptType as client, isRentalName as clientName } from '../../src/apt-type.js'

for (const [label, classifyAptType, isRentalName] of [['api', server, serverName], ['src', client, clientName]]) {
  test(`${label}: K-APT 분양형태 코드가 있으면 그것이 우선한다`, () => {
    assert.equal(classifyAptType({ name: '공덕동 크로시티 행복주택', codeSaleNm: '임대' }), 'rental')
    assert.equal(classifyAptType({ name: '헬리오시티아파트', codeSaleNm: '혼합' }), 'mixed')
    assert.equal(classifyAptType({ name: '래미안상도2차', codeSaleNm: '분양' }), 'sale')
    // 이름에 '임대'가 없어도 코드가 임대면 임대 (방화스카이포레, 위례포레샤인13단지)
    assert.equal(classifyAptType({ name: '방화스카이포레아파트', codeSaleNm: '임대' }), 'rental')
  })

  test(`${label}: 코드가 없으면 단지명 키워드로 추정한다`, () => {
    for (const n of ['청신호 행복주택 정릉하늘마루', '라봄성동청년안심주택', '서울주택도시공사 목동현대B 임대아파트',
      '도화현대2차아파트(임대)', '장월SH-VILLE1단지', 'LH서초3단지', '천호역한강청년주택', '불광에스에이치빌']) {
      assert.equal(classifyAptType({ name: n }), 'rental', n)
      assert.equal(isRentalName(n), true, n)
    }
    assert.equal(classifyAptType({ name: '잠실엘스아파트' }), 'unknown')
  })

  test(`${label}: 키워드 오탐을 막는다`, () => {
    // 'SH'가 다른 영문 상호 안에 들어간 경우, '청년'이 아닌 일반 단지
    assert.equal(isRentalName('SK북한산시티아파트'), false)
    assert.equal(isRentalName('DMC SK VIEW 2단지'), false)
    assert.equal(isRentalName('래미안퍼스티지'), false)
  })
}
