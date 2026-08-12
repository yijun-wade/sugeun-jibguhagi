import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextSlot, MINUTE_OPTIONS, TODAY_SLOTS, TOMORROW_SLOTS } from '../../scripts/publish/lib/slot.mjs'

// KST 시각을 만든다. 테스트는 항상 now를 주입한다 — Date.now()에 의존하지 않는다.
const kst = (s) => new Date(`${s}+09:00`)

test('예약 가능한 분은 10분 단위뿐 — 네이버 select 옵션이 6개다', () => {
  // 실측(2026-08-12): minute select = 00 10 20 30 40 50.
  // 어뷰징 완화로 넣었던 "±0~9분 랜덤"은 여기서 불가능해진다.
  assert.deepEqual(MINUTE_OPTIONS, ['00', '10', '20', '30', '40', '50'])
  for (const s of [...TODAY_SLOTS, ...TOMORROW_SLOTS]) {
    assert.ok(MINUTE_OPTIONS.includes(String(s.minute).padStart(2, '0')), `${s.hour}:${s.minute} 는 선택 불가`)
  }
})

test('아침 실행(08:30) → 당일 낮 슬롯', () => {
  const s = nextSlot(kst('2026-08-12T08:30:00'))
  assert.equal(s.date, '2026-08-12')
  assert.ok(s.hour >= 11 && s.hour <= 12, `${s.hour}시`)
})

test('저녁 실행(20:30) → 익일 아침 슬롯', () => {
  const s = nextSlot(kst('2026-08-12T20:30:00'))
  assert.equal(s.date, '2026-08-13')
  assert.ok(s.hour >= 8 && s.hour <= 9, `${s.hour}시`)
})

test('당일 슬롯을 이미 지났으면 익일로 민다', () => {
  // 글을 버리는 것보다 하루 늦추는 게 낫다 — 스펙 STEP 3
  const s = nextSlot(kst('2026-08-12T13:00:00'))
  assert.equal(s.date, '2026-08-13')
})

test('경계 — 슬롯 정각에 실행하면 그 슬롯은 쓰지 않는다', () => {
  // 예약 확정까지 몇 분 걸린다. 정각을 살려두면 "예약"이 "즉시 발행"이 될 수 있다.
  const s = nextSlot(kst('2026-08-12T12:20:00'))
  assert.equal(s.date, '2026-08-13', '마지막 당일 슬롯 정각인데 당일로 잡힘')
})

test('마진 — 실행 시각으로부터 최소 10분 뒤여야 한다', () => {
  for (const t of ['2026-08-12T11:45:00', '2026-08-12T12:05:00', '2026-08-12T07:55:00']) {
    const s = nextSlot(kst(t))
    const at = kst(`${s.date}T${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}:00`)
    assert.ok(at.getTime() - kst(t).getTime() >= 10 * 60000, `${t} → ${s.date} ${s.hour}:${s.minute} (마진 부족)`)
  }
})

test('같은 날짜·같은 시각이면 결과가 같다 (결정적)', () => {
  const a = nextSlot(kst('2026-08-12T08:30:00'))
  const b = nextSlot(kst('2026-08-12T08:30:00'))
  assert.deepEqual(a, b)
})

test('날짜가 바뀌면 슬롯도 바뀐다 — 매일 같은 시각에 발행하지 않는다', () => {
  // 리스크 1 대응. 정확히 12:00:00 고정 발행은 사람이 만들지 않는 패턴이다.
  const picks = new Set()
  for (let d = 1; d <= 28; d++) {
    const day = String(d).padStart(2, '0')
    const s = nextSlot(kst(`2026-09-${day}T08:30:00`))
    picks.add(`${s.hour}:${s.minute}`)
  }
  assert.ok(picks.size >= 3, `28일간 슬롯이 ${picks.size}종류뿐: ${[...picks]}`)
})

test('월말 롤오버 — 8/31 저녁 → 9/1', () => {
  const s = nextSlot(kst('2026-08-31T20:30:00'))
  assert.equal(s.date, '2026-09-01')
})

test('연말 롤오버 — 12/31 저녁 → 이듬해 1/1', () => {
  const s = nextSlot(kst('2026-12-31T20:30:00'))
  assert.equal(s.date, '2027-01-01')
})

test('UTC 머신에서 돌아도 KST 기준으로 같은 답', () => {
  // launchd는 로컬이지만 CI나 다른 TZ에서 돌 수 있다.
  const before = process.env.TZ
  const run = (tz) => { process.env.TZ = tz; return nextSlot(kst('2026-08-12T08:30:00')) }
  const seoul = run('Asia/Seoul')
  const utc = run('UTC')
  const ny = run('America/New_York')
  process.env.TZ = before
  assert.deepEqual(seoul, utc)
  assert.deepEqual(seoul, ny)
})

test('반환 형식 — 네이버 select/달력에 바로 쓸 수 있는 모양', () => {
  const s = nextSlot(kst('2026-08-12T08:30:00'))
  assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(typeof s.hour, 'number')
  assert.equal(typeof s.minute, 'number')
  assert.match(s.hourValue, /^\d{2}$/) // select value
  assert.match(s.minuteValue, /^\d{2}$/)
  assert.equal(s.minuteValue, String(s.minute).padStart(2, '0'))
})
