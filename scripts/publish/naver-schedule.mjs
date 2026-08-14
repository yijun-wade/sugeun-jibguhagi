// STEP 3 — 예약 등록.
//
// ⚠ 파이프라인에서 되돌릴 수 없는 유일한 구간이다.
//   최악은 "예약 실패"가 아니라 "의도하지 않은 즉시 발행"이다. 판정이 애매하면
//   확정을 누르지 않고 멈춘다. 멈추면 초안은 남고 내일 다시 돈다.
//
// 실측(2026-08-12)으로 확인한 제약:
//   - 날짜칸은 readOnly — 값을 못 넣는다. 달력을 열어 클릭해야 한다.
//   - 시·분은 <select>. 분은 00/10/20/30/40/50 여섯 개뿐이다.
//   - select에 React가 붙어 있다(__reactFiber). 값만 대입하면 화면만 바뀌고
//     내부 상태는 그대로다 — 그대로 확정하면 기본값(새벽)으로 발행된다.

import { SEL, sleep, openPublishPanel, reserveCount } from './lib/editor.mjs'

/** React가 붙은 컨트롤에 값을 넣는다. 값 대입만으로는 내부 상태가 안 바뀐다. */
async function setReactValue(frame, selector, value) {
  const ok = await frame.evaluate((sel, val) => {
    const el = document.querySelector(sel)
    if (!el) return false
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    setter ? setter.call(el, val) : (el.value = val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return el.value === val
  }, selector, value)
  await sleep(400)
  return ok
}

/** 공개 설정 — 전체공개 + 검색허용 */
async function setVisibility(frame) {
  await frame.evaluate((s) => document.querySelector(s)?.click(), `label[for="open_public"]`)
  await sleep(400)
  const pub = await frame.evaluate((s) => document.querySelector(s)?.checked === true, SEL.openPublic)
  if (!pub) throw new Error('전체공개가 선택되지 않았다')

  const search = await frame.evaluate((s) => document.querySelector(s)?.checked === true, SEL.optionSearch)
  if (!search) {
    await frame.evaluate(() => document.querySelector('label[for="publish-option-search"]')?.click())
    await sleep(400)
    const now = await frame.evaluate((s) => document.querySelector(s)?.checked === true, SEL.optionSearch)
    if (!now) throw new Error('검색허용을 켜지 못했다')
  }
  return true
}

/**
 * 달력을 열어 날짜를 클릭한다. 날짜칸이 readOnly라 이 경로뿐이다.
 *
 * 달력은 jQuery UI datepicker인데 표준형이 아니다(2026-08-14 실측).
 * data-month/data-year 속성도 없고, 셀 안에 <a>도 없다. td 자체를 클릭해야 한다.
 * 지난 날짜는 class="ui-state-disabled". 선택 가능한 날은 class가 비어 있다.
 * 표준 구조를 가정하고 td[data-month] > a 를 찾았더니 후보가 0개였다.
 */
async function pickDate(frame, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const readIso = () => frame.evaluate((s) => {
    const v = document.querySelector(s)?.value || ''
    return (v.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})/) || []).slice(1).join('-')
  }, SEL.dateInput)

  if ((await readIso()) === dateStr) return { clicked: false }

  await frame.evaluate((s) => document.querySelector(s)?.click(), SEL.dateInput)
  let opened = false
  for (let i = 0; i < 16 && !opened; i++) {
    await sleep(250)
    opened = await frame.evaluate(() => !!document.querySelector('.ui-datepicker[style*="block"], .ui-datepicker'))
  }
  if (!opened) throw new Error('달력이 열리지 않았다')

  // 목표 달로 이동. 다음달 버튼이 비활성이면 더 못 간다.
  for (let i = 0; i < 14; i++) {
    const cur = await frame.evaluate(() => {
      const yy = document.querySelector('.ui-datepicker-year')?.innerText?.replace(/\D/g, '')
      const mm = document.querySelector('.ui-datepicker-month')?.innerText?.replace(/\D/g, '')
      return { y: Number(yy), m: Number(mm) }
    })
    if (cur.y === y && cur.m === m) break
    const goNext = cur.y < y || (cur.y === y && cur.m < m)
    const moved = await frame.evaluate((next) => {
      const btn = document.querySelector(next ? '.ui-datepicker-next' : '.ui-datepicker-prev')
      if (!btn || /ui-state-disabled/.test(btn.className)) return false
      btn.click()
      return true
    }, goNext)
    if (!moved) throw new Error(`달력을 ${y}-${m} 로 이동할 수 없다 (현재 ${cur.y}-${cur.m})`)
    await sleep(500)
  }

  // el.click() (프로그램적 클릭)은 먹지 않는다 — jQuery UI가 위임 핸들러로 마우스
  // 이벤트를 받는데 신뢰되지 않은 이벤트는 무시된다. 셀은 눌린 것처럼 보이지만
  // 날짜칸 값이 그대로였다(2026-08-14). 실제 마우스 클릭으로 눌러야 한다.
  const cells = await frame.$$('.ui-datepicker td')
  let target = null
  for (const c of cells) {
    const info = await c.evaluate((e) => ({
      txt: (e.innerText || '').trim(),
      disabled: /ui-state-disabled|ui-datepicker-unselectable/.test(e.className),
    }))
    if (info.txt === String(d) && !info.disabled) { target = c; break }
  }
  if (!target) throw new Error(`달력에서 ${dateStr} 선택 실패 — ${d}일이 없거나 비활성(지난 날짜)`)
  await target.click()
  await sleep(800)

  const after = await readIso()
  if (after !== dateStr) throw new Error(`날짜가 반영되지 않았다: 기대 ${dateStr}, 실제 ${after}`)
  return { clicked: true }
}

/**
 * 예약 등록.
 * @param {{date:string,hourValue:string,minuteValue:string}} slot
 * @param {{confirm:boolean}} opts confirm=false면 확정 직전에 멈춘다(사람 입회용)
 */
export async function schedule(page, frame, slot, { confirm = false } = {}) {
  const before = await reserveCount(frame)
  await openPublishPanel(frame)

  await setVisibility(frame)

  // 예약 라디오 — 이게 꺼져 있으면 확정 버튼은 예약이 아니라 "지금 발행"이다
  await frame.evaluate(() => document.querySelector('label[for="radio_time2"]')?.click())
  await sleep(900)
  const reserveOn = await frame.evaluate((s) => document.querySelector(s)?.checked === true, SEL.timeReserve)
  if (!reserveOn) throw new Error('예약 라디오가 켜지지 않았다 — 확정하면 즉시 발행된다. 중단.')

  const dateRes = await pickDate(frame, slot.date)
  if (!(await setReactValue(frame, SEL.hourSelect, slot.hourValue))) throw new Error('시 설정 실패')
  if (!(await setReactValue(frame, SEL.minuteSelect, slot.minuteValue))) throw new Error('분 설정 실패')

  // ── 확정 직전 3중 확인 ──────────────────────────────────────
  // 화면에는 반영됐는데 내부에는 안 들어간 경우를 여기서 잡는다.
  const state = await frame.evaluate((s) => ({
    reserve: document.querySelector(s.timeReserve)?.checked === true,
    now: document.querySelector(s.timeNow)?.checked === true,
    date: document.querySelector(s.dateInput)?.value || '',
    hour: document.querySelector(s.hourSelect)?.value || '',
    minute: document.querySelector(s.minuteSelect)?.value || '',
    public: document.querySelector(s.openPublic)?.checked === true,
  }), SEL)

  const problems = []
  if (!state.reserve) problems.push('예약 토글 OFF')
  if (state.now) problems.push('"현재"가 선택돼 있음')
  if (state.hour !== slot.hourValue) problems.push(`시 불일치 ${state.hour} ≠ ${slot.hourValue}`)
  if (state.minute !== slot.minuteValue) problems.push(`분 불일치 ${state.minute} ≠ ${slot.minuteValue}`)
  if (!state.public) problems.push('전체공개 아님')
  const dateIso = (state.date.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})/) || []).slice(1).join('-')
  if (dateIso !== slot.date) problems.push(`날짜 불일치 ${dateIso} ≠ ${slot.date}`)

  const summary = { ...state, dateIso, want: slot, reserveBefore: before, dateClicked: dateRes.clicked }
  if (problems.length) {
    throw new Error(`확정 전 검증 실패 — 확정하지 않고 중단\n  ${problems.join('\n  ')}`)
  }

  if (!confirm) {
    return { ...summary, confirmed: false, note: '확정 직전에서 멈춤 (--confirm 없음)' }
  }

  await frame.evaluate((s) => document.querySelector(s)?.click(), SEL.confirm)

  // 확정에 성공하면 네이버가 에디터를 떠나 블로그 목록으로 이동한다.
  // 그래서 "같은 프레임에서 예약 건수를 다시 읽는" 검증은 성립하지 않는다.
  // 실제로 예약이 걸렸는데도 건수를 못 읽어 실패로 판정했다(2026-08-14).
  // 그 오판은 상태 파일에 완료가 안 남아 다음 실행이 같은 글을 또 예약하게 만든다.
  // → 이동을 성공 신호로 보고, 에디터를 새로 열어 예약 목록으로 확인한다.
  let left = false
  for (let i = 0; i < 40 && !left; i++) {
    await sleep(700)
    left = !/PostWriteForm/.test(page.url()) && !page.frames().some((f) => SEL.frame.test(f.url()))
  }
  if (!left) throw new Error('확정을 눌렀으나 에디터가 그대로다 — 확정이 먹지 않았다')

  const check = await verifyReserved(page, slot)
  if (!check.found) {
    throw new Error(`확정 후 예약 목록에서 글을 찾지 못했다 (건수 ${check.count})`)
  }
  return { ...summary, confirmed: true, reserveAfter: check.count, reservedAt: check.when }
}

/** 에디터를 새로 열어 예약 목록을 읽는다. 확정 직후 검증 전용. */
async function verifyReserved(page, slot) {
  const { openEditor, dismissResumePopup, dismissHelpPanel, reservedTitles } = await import('./lib/editor.mjs')
  const frame = await openEditor(page)
  await dismissHelpPanel(frame)
  await dismissResumePopup(frame)
  await openPublishPanel(frame)
  const count = await reserveCount(frame)
  const lines = await reservedTitles(frame)
  const want = `${slot.date.replace(/-/g, '.')} ${slot.hourValue}:${slot.minuteValue}`
  return { count, found: lines.some((l) => l.includes(want)) || count > 0, when: want, lines }
}
