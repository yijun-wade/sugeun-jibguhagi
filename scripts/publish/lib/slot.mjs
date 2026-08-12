// 예약 발행 시각을 정한다. 순수 함수 — 현재 시각은 주입받는다.
//
// 실측 제약(2026-08-12): 네이버 예약 UI의 시·분은 텍스트 입력이 아니라 <select>이고,
// 분 옵션은 00/10/20/30/40/50 여섯 개뿐이다. 설계문이 어뷰징 완화책으로 적었던
// "±0~9분 랜덤 오프셋"은 여기서 물리적으로 불가능하다.
// 대신 10분 단위 슬롯 중 하나를 날짜로 결정되는 방식으로 고른다.
// 매일 다른 시각에 나가되, 같은 날 재실행하면 같은 답이 나와야 한다(멱등).

export const MINUTE_OPTIONS = ['00', '10', '20', '30', '40', '50']

// 브리핑은 뉴스 기반이라 생성일 당일 낮 발행이 원칙.
export const TODAY_SLOTS = [
  { hour: 11, minute: 50 },
  { hour: 12, minute: 0 },
  { hour: 12, minute: 10 },
  { hour: 12, minute: 20 },
]
// 당일 슬롯을 놓쳤을 때(저녁 실행 등). 글을 버리는 것보다 하루 늦추는 게 낫다.
export const TOMORROW_SLOTS = [
  { hour: 8, minute: 0 },
  { hour: 8, minute: 10 },
  { hour: 8, minute: 20 },
  { hour: 8, minute: 30 },
]

// 예약 확정까지 몇 분이 걸린다. 마진이 없으면 "예약"이 "즉시 발행"이 될 수 있다.
const MARGIN_MS = 10 * 60 * 1000
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

// KST 기준 달력 값. 머신 TZ와 무관해야 한다.
const kstParts = (d) => {
  const s = new Date(d.getTime() + KST_OFFSET_MS)
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth() + 1,
    d: s.getUTCDate(),
  }
}

const ymd = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// 'YYYY-MM-DD' + 시/분 → UTC epoch (KST로 해석)
const kstEpoch = (dateStr, hour, minute) =>
  Date.parse(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`)

const addDays = (dateStr, n) => {
  const t = Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// 날짜 문자열 → 안정적인 정수. Math.random()을 쓰지 않는 이유는 멱등성이다.
// FNV만 쓰면 연속된 날짜처럼 비슷한 입력에서 하위 비트가 뭉쳐, 슬롯 4개 중 2개만
// 뽑히는 일이 실제로 났다. 슬롯 선택은 곧 modulo라 하위 비트 품질이 전부다.
// 그래서 뒤에 확산(avalanche) 단계를 붙인다.
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

/**
 * @param {Date} now 실행 시각
 * @param {{seed?: string}} [opts] seed를 주면 날짜 대신 그걸로 슬롯을 고른다(테스트용)
 * @returns {{date: string, hour: number, minute: number, hourValue: string, minuteValue: string, sameDay: boolean}}
 */
export function nextSlot(now, opts = {}) {
  const today = ymd(kstParts(now))
  const seed = opts.seed ?? today

  // 당일 슬롯 먼저. 마진을 못 채우는 슬롯은 후보에서 뺀다.
  const usableToday = TODAY_SLOTS.filter((s) => kstEpoch(today, s.hour, s.minute) - now.getTime() >= MARGIN_MS)

  const pick = (list, date, sameDay) => {
    const s = list[hash(seed + date) % list.length]
    return {
      date,
      hour: s.hour,
      minute: s.minute,
      hourValue: String(s.hour).padStart(2, '0'),
      minuteValue: String(s.minute).padStart(2, '0'),
      sameDay,
    }
  }

  if (usableToday.length > 0) return pick(usableToday, today, true)

  const tomorrow = addDays(today, 1)
  return pick(TOMORROW_SLOTS, tomorrow, false)
}
