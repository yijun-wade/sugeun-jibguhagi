// 발행 상태 파일. 데이터베이스는 없다 — 상태도 파일이다.
// 중간에 멈춰도 파일이 남고, 다음 실행이 완료된 단계를 건너뛴다.
//
// .publish-state/YYYY-MM-DD.json (gitignore)

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const STEPS = ['precheck', 'images', 'assemble', 'schedule']
const DIR = () => join(process.cwd(), '.publish-state')
const pathFor = (date) => join(DIR(), `${date}.json`)

const empty = (date) => ({
  date,
  draft: null,
  steps: {},
  scheduledFor: null,
  warnings: [],
})

export function load(date) {
  const p = pathFor(date)
  if (!existsSync(p)) return empty(date)
  try {
    return { ...empty(date), ...JSON.parse(readFileSync(p, 'utf-8')) }
  } catch {
    // 깨진 상태 파일 때문에 발행이 영구히 막히면 안 된다. 처음부터 다시 한다.
    return { ...empty(date), warnings: ['상태 파일이 깨져 있어 새로 시작한다'] }
  }
}

export function save(state) {
  mkdirSync(DIR(), { recursive: true })
  writeFileSync(pathFor(state.date), JSON.stringify(state, null, 2))
  return state
}

/** 단계 완료/실패를 기록하고 즉시 저장한다. 프로세스가 죽어도 남아야 한다. */
export function mark(state, step, ok, extra = {}) {
  if (!STEPS.includes(step)) throw new Error(`알 수 없는 단계: ${step}`)
  state.steps[step] = { ok, at: nowIso(), ...extra }
  return save(state)
}

export const done = (state, step) => state.steps?.[step]?.ok === true

/** 예약까지 끝났는가 — 멱등성 게이트의 1차 신호 */
export const isComplete = (state) => done(state, 'schedule')

const nowIso = () => new Date().toISOString()

/** 예약도 발행도 안 된 채 남은 초안 날짜들. 3편 이상이면 경보 대상. */
export function pendingDates(availableDates) {
  return availableDates.filter((d) => !isComplete(load(d)))
}

/** 상태 파일이 있는 모든 날짜 */
export function knownDates() {
  if (!existsSync(DIR())) return []
  return readdirSync(DIR())
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(0, 10))
    .sort()
}
