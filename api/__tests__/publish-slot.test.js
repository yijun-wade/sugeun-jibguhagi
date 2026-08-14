import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextSlot, nextSlots, slotsForDate, MINUTE_OPTIONS, SLOT_HOURS } from '../../scripts/publish/lib/slot.mjs'

const kst = (s) => new Date(`${s}+09:00`)
const at = (s) => `${s.date} ${s.hourValue}:${s.minuteValue}`

test('4시간 간격 4슬롯 — 08/12/16/20시', () => {
  assert.deepEqual(SLOT_HOURS, [8, 12, 16, 20])
  const s = slotsForDate('2026-08-20')
  assert.equal(s.length, 4)
  assert.deepEqual(s.map((x) => x.hour), [8, 12, 16, 20])
})

test('00시·04시는 슬롯이 아니다 — 독자 없는 시간', () => {
  const hours = slotsForDate('2026-08-20').map((s) => s.hour)
  assert.ok(!hours.includes(0) && !hours.includes(4))
})

test('분은 네이버 select가 허용하는 값만 쓴다', () => {
  // 실측: minute select = 00 10 20 30 40 50. 그 밖의 값은 넣을 수 없다.
  for (let d = 1; d <= 28; d++) {
    for (const s of slotsForDate(`2026-09-${String(d).padStart(2, '0')}`)) {
      assert.ok(MINUTE_OPTIONS.includes(s.minuteValue), `${s.hourValue}:${s.minuteValue}`)
    }
  }
})

test('같은 날 슬롯끼리 시각이 겹치지 않는다', () => {
  const keys = slotsForDate('2026-08-20').map(at)
  assert.equal(new Set(keys).size, 4)
})

test('아침 실행이면 남은 오늘 슬롯부터 채운다', () => {
  const got = nextSlots(kst('2026-08-20T07:00:00'), 4)
  assert.equal(got.length, 4)
  assert.ok(got.every((s) => s.date === '2026-08-20'))
  assert.deepEqual(got.map((s) => s.hour), [8, 12, 16, 20])
})

test('낮 실행이면 지난 슬롯은 건너뛰고 다음날로 넘어간다', () => {
  const got = nextSlots(kst('2026-08-20T13:00:00'), 4)
  assert.deepEqual(got.map((s) => `${s.date} ${s.hour}`), [
    '2026-08-20 16', '2026-08-20 20', '2026-08-21 8', '2026-08-21 12',
  ])
})

test('마진 — 슬롯까지 10분이 안 남으면 쓰지 않는다', () => {
  // 예약 확정에 시간이 걸린다. 마진이 없으면 "예약"이 "즉시 발행"이 된다.
  const s = slotsForDate('2026-08-20').find((x) => x.hour === 12)
  const justBefore = kst(`2026-08-20T12:${String(Math.max(0, s.minute - 5)).padStart(2, '0')}:00`)
  const got = nextSlots(justBefore, 1)[0]
  assert.notEqual(`${got.date} ${got.hour}`, '2026-08-20 12')
})

test('이미 잡힌 자리는 건너뛴다', () => {
  const all = nextSlots(kst('2026-08-20T07:00:00'), 4)
  const taken = [at(all[0]), at(all[1])]
  const got = nextSlots(kst('2026-08-20T07:00:00'), 2, { taken })
  assert.deepEqual(got.map(at), [at(all[2]), at(all[3])])
})

test('요청 수가 하루 슬롯보다 많으면 다음날로 이어진다', () => {
  const got = nextSlots(kst('2026-08-20T07:00:00'), 6)
  assert.equal(got.length, 6)
  assert.equal(got[4].date, '2026-08-21')
})

test('같은 입력이면 같은 결과 (결정적) — 재개 시 시각이 바뀌면 안 된다', () => {
  const a = nextSlots(kst('2026-08-20T07:00:00'), 4).map(at)
  const b = nextSlots(kst('2026-08-20T07:00:00'), 4).map(at)
  assert.deepEqual(a, b)
})

test('날짜가 바뀌면 분이 흔들린다 — 매일 같은 시각 고정 발행을 피한다', () => {
  const mins = new Set()
  for (let d = 1; d <= 28; d++) {
    mins.add(slotsForDate(`2026-09-${String(d).padStart(2, '0')}`)[0].minuteValue)
  }
  assert.ok(mins.size >= 2, `28일간 08시 분이 ${mins.size}종류뿐`)
})

test('월말·연말 롤오버', () => {
  assert.equal(nextSlots(kst('2026-08-31T21:00:00'), 1)[0].date, '2026-09-01')
  assert.equal(nextSlots(kst('2026-12-31T21:00:00'), 1)[0].date, '2027-01-01')
})

test('UTC 머신에서 돌아도 KST 기준으로 같은 답', () => {
  const before = process.env.TZ
  const run = (tz) => { process.env.TZ = tz; return nextSlots(kst('2026-08-20T07:00:00'), 4).map(at) }
  const seoul = run('Asia/Seoul')
  const utc = run('UTC')
  const ny = run('America/New_York')
  process.env.TZ = before
  assert.deepEqual(seoul, utc)
  assert.deepEqual(seoul, ny)
})

test('nextSlot — 하위 호환(1개)', () => {
  const s = nextSlot(kst('2026-08-20T07:00:00'))
  assert.equal(s.hour, 8)
  assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.match(s.hourValue, /^\d{2}$/)
  assert.match(s.minuteValue, /^\d{2}$/)
})
