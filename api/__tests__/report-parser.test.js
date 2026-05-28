import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { SECTION_LABELS, parseReportSections } from '../_report-parser.js'

describe('SECTION_LABELS — 12 섹션 정의', () => {
  test('12개 라벨, 순서 고정', () => {
    assert.equal(SECTION_LABELS.length, 12)
    assert.deepEqual(SECTION_LABELS, [
      '정체성', '요약', '입지', '상품성', '수요층', '주변비교',
      '시나리오', '자산변화', '징검다리', '전략', '매도리스크', '결론',
    ])
  })
})

describe('parseReportSections — 대괄호 라벨 파싱', () => {
  test('정상 입력: 모든 섹션이 객체로 반환', () => {
    const text = `[정체성]
한 줄 정체성입니다.

[요약]
종합 점수: 70점
등급: 실거주 중심 보유 가능

[입지]
교통 좋습니다.

[상품성]
장점 있습니다.

[수요층]
1~2인 가구 적합.

[주변비교]
A 단지 대비 낮음.

[시나리오]
기준 시나리오 5.8억.

[자산변화]
5년 후 +1.2억.

[징검다리]
성공 기준 6억.

[전략]
1년 차: 점검.

[매도리스크]
환금성 리스크.

[결론]
징검다리로 충분히 의미.
`
    const r = parseReportSections(text)
    assert.equal(r.정체성, '한 줄 정체성입니다.')
    assert.ok(r.요약.includes('종합 점수: 70점'))
    assert.equal(r.결론, '징검다리로 충분히 의미.')
  })

  test('일부 섹션 누락 시 빈 문자열', () => {
    const text = `[정체성]
정체성만 있음.
`
    const r = parseReportSections(text)
    assert.equal(r.정체성, '정체성만 있음.')
    assert.equal(r.요약, '')
    assert.equal(r.결론, '')
  })

  test('빈 입력', () => {
    const r = parseReportSections('')
    assert.equal(r.정체성, '')
    assert.equal(Object.keys(r).length, 12)
  })

  test('대괄호 외부 노이즈는 무시', () => {
    const text = `안녕하세요. 보고서입니다.

[정체성]
정체성 내용.

부가 설명입니다.

[결론]
끝.`
    const r = parseReportSections(text)
    assert.equal(r.정체성, '정체성 내용.\n\n부가 설명입니다.')
    assert.equal(r.결론, '끝.')
  })
})
