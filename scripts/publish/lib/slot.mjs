// 예약 발행 시각을 정한다. 순수 함수 — 현재 시각은 주입받는다.
//
// v2(2026-08-14): 하루 1편 → 4시간 간격 4편.
//   08시 / 12시 / 16시 / 20시. 00·04시는 넣지 않는다 — 독자가 없는 시간에
//   글을 밀어 넣으면 노출도 못 받고 기계 발행 티만 난다.
//
// 실측 제약: 네이버 예약 UI의 시·분은 <select>이고 분은 00/10/20/30/40/50뿐이다.
// 그래서 분 단위 랜덤이 불가능하다. 같은 시각에 매일 고정 발행되는 것을 피하려고
// 슬롯마다 분을 날짜 해시로 흔든다.

export const MINUTE_OPTIONS = ['00', '10', '20', '30', '40', '50']

/** 하루 슬롯의 기준 시각. 4시간 간격. */
export const SLOT_HOURS = [8, 12, 16, 20]
/** 각 슬롯에서 고를 수 있는 분. 정각 고정은 사람이 만들지 않는 패턴이다. */
const SLOT_MINUTES = ['00', '10', '20']

// 예약 확정까지 몇 분이 걸린다. 마진이 없으면 "예약"이 "즉시 발행"이 될 수 있다.
const MARGIN_MS = 10 * 60 * 1000
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

const kstParts = (d) => {
  const s = new Date(d.getTime() + KST_OFFSET_MS)
  return { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate() }
}
const ymd = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const kstEpoch = (dateStr, hour, minute) =>
  Date.parse(`${dateStr}T${String(hour).padStart(2, '0')}:${minute}:00+09:00`)

const addDays = (dateStr, n) => {
  const d = new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// 날짜 문자열 → 안정적인 정수. Math.random()을 쓰지 않는 이유는 멱등성이다.
// FNV만 쓰면 연속된 날짜처럼 비슷한 입력에서 하위 비트가 뭉쳐 후보가 편중된다.
// 슬롯 선택이 곧 modulo라 하위 비트 품질이 전부여서 확산 단계를 붙인다.
const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return h >>> 0
}

const makeSlot = (date, hour) => {
  const minute = SLOT_MINUTES[hash(`${date}#${hour}`) % SLOT_MINUTES.length]
  return {
    date,
    hour,
    minute: Number(minute),
    hourValue: String(hour).padStart(2, '0'),
    minuteValue: minute,
  }
}

/** 그 날짜의 슬롯 4개 (시각 오름차순) */
export function slotsForDate(date) {
  return SLOT_HOURS.map((h) => makeSlot(date, h))
}

/**
 * 지금 이후로 예약 가능한 슬롯을 count개 돌려준다. 오늘 것이 모자라면 다음날로 넘어간다.
 * @param {Date} now
 * @param {number} count
 * @param {{taken?: string[]}} opts 이미 예약된 "YYYY-MM-DD HH:MM" 목록 — 그 자리는 건너뛴다
 */
export function nextSlots(now, count = 1, opts = {}) {
  const taken = new Set(opts.taken || [])
  const out = []
  let date = ymd(kstParts(now))

  for (let day = 0; day <= 7 && out.length < count; day++) {
    for (const s of slotsForDate(date)) {
      if (out.length >= count) break
      if (kstEpoch(s.date, s.hour, s.minuteValue) - now.getTime() < MARGIN_MS) continue
      const key = `${s.date} ${s.hourValue}:${s.minuteValue}`
      if (taken.has(key)) continue
      out.push({ ...s, key, sameDay: day === 0 })
    }
    date = addDays(date, 1)
  }
  return out
}

/** 하위 호환 — 한 개만 필요할 때 */
export function nextSlot(now, opts = {}) {
  const [s] = nextSlots(now, 1, opts)
  return s
}
