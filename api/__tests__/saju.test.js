// node:test — node --test api/__tests__/saju.test.js
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { calcFourPillars, processToolResponse, SAJU_TOOL } from '../saju.js'

// ───────────────────────────────────────────────────────────────
// 1. 만세력 계산 (calcFourPillars)
// ───────────────────────────────────────────────────────────────
describe('calcFourPillars — 만세력 4주 8자', () => {
  test('1991.02.13 진시 (전이준) — 일주 甲寅, 시주 戊辰', () => {
    const fp = calcFourPillars(1991, 2, 13, '진')
    assert.equal(fp.day.kor, '갑인', '일주 한글')
    assert.equal(fp.day.han, '甲寅', '일주 한자')
    assert.equal(fp.ilgan,  '갑',   '일간')
    assert.ok(fp.hour, '시주가 있어야 함')
    assert.equal(fp.hour.kor, '무진', '시주 (갑일 진시 = 무진)')
    assert.equal(fp.hour.han, '戊辰')
  })

  test('1996.08.27 유시 (전혜빈) — 일주 丙申, 시주 丁酉', () => {
    const fp = calcFourPillars(1996, 8, 27, '유')
    assert.equal(fp.day.kor, '병신')
    assert.equal(fp.day.han, '丙申')
    assert.equal(fp.ilgan,  '병')
    assert.equal(fp.hour.kor, '정유', '시주 (병일 유시 = 정유)')
  })

  test('si 미입력 시 hour = null', () => {
    const fp = calcFourPillars(1996, 8, 27, null)
    assert.equal(fp.hour, null)
  })

  test('잘못된 si는 hour = null', () => {
    const fp = calcFourPillars(1996, 8, 27, '잘못된값')
    assert.equal(fp.hour, null)
  })

  test('필수 필드 — year/month/day/ilgan 모두 존재', () => {
    const fp = calcFourPillars(2000, 6, 15, '오')
    for (const k of ['year', 'month', 'day']) {
      assert.ok(fp[k].kor, `${k}.kor`)
      assert.ok(fp[k].han, `${k}.han`)
      assert.ok(fp[k].ohaeng, `${k}.ohaeng`)
    }
    assert.ok(fp.ilgan)
  })
})

// ───────────────────────────────────────────────────────────────
// 2. processToolResponse — Anthropic 응답 검증
// ───────────────────────────────────────────────────────────────
function fixtureRegions(n = 3) {
  return Array.from({ length: n }, (_, i) => ({
    gu: `구${i+1}`, rank: i+1, score: 90 - i*5,
    scoreBreakdown: {
      ohaengMatch:  { score: 22, reason: 'r' },
      jimingOhaeng: { score: 22, reason: 'r' },
      landscape:    { score: 23, reason: 'r' },
      lifeEnergy:   { score: 23, reason: 'r' },
    },
    jiming: 'j', whyThisGu: 'w', dailyLife: 'd',
  }))
}

function fixtureToolUseResponse(overrides = {}) {
  const input = {
    ilgan: '甲木',
    plainSummary: '당신은 활동적 사주예요. 차분한 동네가 잘 맞아요.',
    saju: { ohaengDist: '木 과다', sinkang: '신강', yongshin: '水', yongShinReason: 'r', daewon: 'd', sewon: 's' },
    timing: { isGoodYear: true, timingScore: 80, reason: 'r', bestMonths: 'm' },
    regions: fixtureRegions(3),
    regionComparison: 'c',
    warning: { year: '2028년', reason: 'r', action: 'a' },
    summary: 's',
    finalVerdict: 'v',
    ...overrides,
  }
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: SAJU_TOOL.name, input }],
    usage: { output_tokens: 1500 },
  }
}

describe('processToolResponse — 정상 케이스', () => {
  test('정상 tool_use 응답 — ok', () => {
    const r = processToolResponse(fixtureToolUseResponse())
    assert.equal(r.ok, true)
    assert.equal(r.result.ilgan, '甲木')
    assert.equal(r.result.regions.length, 3)
  })

  test('text 블록과 tool_use 블록이 섞여 있어도 tool_use만 추출', () => {
    const data = {
      stop_reason: 'tool_use',
      content: [
        { type: 'text', text: '분석을 시작합니다...' },
        { type: 'tool_use', name: SAJU_TOOL.name, input: fixtureToolUseResponse().content[0].input },
        { type: 'text', text: '추가 설명입니다' },
      ],
    }
    const r = processToolResponse(data)
    assert.equal(r.ok, true)
  })
})

describe('processToolResponse — 실패 케이스', () => {
  test('max_tokens 도달', () => {
    const r = processToolResponse({ stop_reason: 'max_tokens', content: [] })
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'max_tokens')
  })

  test('tool_use 블록 없음 (text만)', () => {
    const r = processToolResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: '...' }] })
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'no_tool_use')
  })

  test('잘못된 tool 이름', () => {
    const data = {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: 'wrong_tool', input: { regions: fixtureRegions(3) } }],
    }
    const r = processToolResponse(data)
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'no_tool_use')
  })

  test('content가 없음 (undefined)', () => {
    const r = processToolResponse({ stop_reason: 'tool_use' })
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'no_tool_use')
  })

  test('content가 배열이 아님', () => {
    const r = processToolResponse({ stop_reason: 'tool_use', content: 'invalid' })
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'no_tool_use')
  })

  test('input이 누락', () => {
    const data = {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: SAJU_TOOL.name }],
    }
    const r = processToolResponse(data)
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'no_tool_use')
  })

  test('regions가 2개만 — invalid_regions', () => {
    const r = processToolResponse(fixtureToolUseResponse({ regions: fixtureRegions(2) }))
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'invalid_regions')
  })

  test('regions가 4개 — invalid_regions', () => {
    const r = processToolResponse(fixtureToolUseResponse({ regions: fixtureRegions(4) }))
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'invalid_regions')
  })

  test('regions 누락 (undefined)', () => {
    const r = processToolResponse(fixtureToolUseResponse({ regions: undefined }))
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'invalid_regions')
  })

  test('regions가 배열이 아님 (string)', () => {
    const r = processToolResponse(fixtureToolUseResponse({ regions: 'oops' }))
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'invalid_regions')
  })

  test('null 입력 — 안전 처리', () => {
    const r = processToolResponse(null)
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'no_tool_use')
  })

  test('undefined 입력 — 안전 처리', () => {
    const r = processToolResponse(undefined)
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'no_tool_use')
  })
})

describe('processToolResponse — toolName 인자', () => {
  test('다른 toolName으로 호출 가능 (saju-confirm용)', () => {
    const data = {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: 'submit_saju_premium_report', input: { regions: fixtureRegions(3) } }],
    }
    const r = processToolResponse(data, 'submit_saju_premium_report')
    assert.equal(r.ok, true)
  })

  test('toolName 불일치 시 거부', () => {
    const data = {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: 'submit_saju_report', input: { regions: fixtureRegions(3) } }],
    }
    const r = processToolResponse(data, 'submit_saju_premium_report')
    assert.equal(r.ok, false)
    assert.equal(r.errorType, 'no_tool_use')
  })
})

// ───────────────────────────────────────────────────────────────
// 3. SAJU_TOOL schema 자체 검증
// ───────────────────────────────────────────────────────────────
describe('SAJU_TOOL schema 무결성', () => {
  const s = SAJU_TOOL.input_schema

  test('tool name이 prompt에서 참조하는 이름과 일치', () => {
    assert.equal(SAJU_TOOL.name, 'submit_saju_report')
  })

  test('top-level required에 핵심 필드 포함', () => {
    for (const f of ['ilgan','plainSummary','saju','timing','regions','warning','summary','finalVerdict']) {
      assert.ok(s.required.includes(f), `required에 ${f}`)
    }
  })

  test('regions는 정확히 3개로 강제', () => {
    assert.equal(s.properties.regions.minItems, 3)
    assert.equal(s.properties.regions.maxItems, 3)
  })

  test('ilgan enum에 10천간 모두 존재', () => {
    const ilganEnum = s.properties.ilgan.enum
    assert.equal(ilganEnum.length, 10)
    for (const e of ['甲木','乙木','丙火','丁火','戊土','己土','庚金','辛金','壬水','癸水']) {
      assert.ok(ilganEnum.includes(e), `ilgan enum에 ${e}`)
    }
  })

  test('yongshin enum에 5오행', () => {
    const arr = s.properties.saju.properties.yongshin.enum
    assert.deepEqual(arr.sort(), ['木','水','火','金','土'].sort())
  })

  test('score 범위 0-100', () => {
    const item = s.properties.regions.items
    assert.equal(item.properties.score.minimum, 0)
    assert.equal(item.properties.score.maximum, 100)
  })

  test('scoreBreakdown 4개 항목 모두 0-25 범위', () => {
    const sb = s.properties.regions.items.properties.scoreBreakdown.properties
    for (const key of ['ohaengMatch','jimingOhaeng','landscape','lifeEnergy']) {
      assert.equal(sb[key].properties.score.minimum, 0, `${key}.minimum`)
      assert.equal(sb[key].properties.score.maximum, 25, `${key}.maximum`)
    }
  })

  test('주요 string 필드에 maxLength — 응답 시간 단축용', () => {
    const sb = s.properties.regions.items.properties.scoreBreakdown.properties
    for (const key of ['ohaengMatch','jimingOhaeng','landscape','lifeEnergy']) {
      assert.ok(sb[key].properties.reason.maxLength > 0, `scoreBreakdown.${key}.reason.maxLength`)
      assert.ok(sb[key].properties.reason.maxLength <= 80, `scoreBreakdown.${key}.reason 너무 길지 않음`)
    }
    assert.ok(s.properties.regions.items.properties.whyThisGu.maxLength > 0, 'whyThisGu.maxLength')
    assert.ok(s.properties.regions.items.properties.dailyLife.maxLength > 0, 'dailyLife.maxLength')
    assert.ok(s.properties.plainSummary.maxLength > 0, 'plainSummary.maxLength')
    assert.ok(s.properties.finalVerdict.maxLength > 0, 'finalVerdict.maxLength')
  })
})
