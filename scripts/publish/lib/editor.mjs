// 네이버 스마트에디터 ONE 조작 공통부.
// 셀렉터는 2026-08-12 실측(scripts/publish/probe*.mjs)으로 확보한 것들이다.
// 네이버가 에디터를 고치면 여기가 먼저 깨진다. 깨질 때 "조용히"가 아니라 예외로 깨지게 한다.

export const BLOG_ID = 'kaimex'
export const WRITE_URL = `https://blog.naver.com/${BLOG_ID}?Redirect=Write`

export const SEL = {
  frame: /PostWriteForm/,
  title: '.se-component.se-documentTitle',
  // 소제목 서식을 걸면 컴포넌트 클래스가 .se-text 가 아닌 것으로 바뀐다.
  // .se-text 로 좁히면 소제목 문단이 조회에서 통째로 사라져 "안 남았다"로 오판한다.
  bodyComponent: '.se-component:not(.se-documentTitle)',
  paragraph: '.se-text-paragraph',
  bold: 'button[data-name="bold"]',
  image: 'button[data-name="image"]',
  textFormat: 'button[data-name="text-format"]',
  save: 'button.save_btn__bzc5B',
  publish: 'button.publish_btn__m9KHH',
  confirm: 'button.confirm_btn__WEaBq',
  reserveBtn: 'button.reserve_btn__Km5Xh',
  reserveLayer: '[class*="layer_popup__"]',
  timeNow: '#radio_time1',
  timeReserve: '#radio_time2',
  dateInput: 'input.input_date__QmA0s',
  hourSelect: 'select.hour_option__J_heO',
  minuteSelect: 'select.minute_option__Vb3xB',
  openPublic: '#open_public',
  optionSearch: '#publish-option-search',
  tagInput: '#tag-input',
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// 단계 사이 대기는 상수가 아니라 범위로 — 매번 똑같은 간격은 사람이 만들지 않는다
export const humanPause = (min = 400, max = 1100) => sleep(min + Math.floor(Math.random() * (max - min)))

/** 에디터를 열고 프레임을 확보한다. 프레임이 뜨는 것이 로그인 판정 신호이기도 하다. */
export async function openEditor(page, { timeout = 45000 } = {}) {
  await page.goto(WRITE_URL, { waitUntil: 'networkidle2', timeout })
  let frame = null
  for (let i = 0; i < 25 && !frame; i++) {
    await sleep(700)
    frame = page.frames().find((f) => SEL.frame.test(f.url()))
  }
  if (!frame) throw new Error('에디터 프레임이 뜨지 않았다 — 로그아웃이거나 네이버가 구조를 바꿨다')
  await sleep(1500)
  return frame
}

/**
 * "작성 중인 글이 있습니다" 팝업을 닫는다.
 * 네이버가 자동저장을 하므로 이건 예외가 아니라 매 실행의 상시 경로다.
 * 반드시 "취소"(닫기). "확인"은 이어쓰기라 지난 초안이 섞인다.
 */
export async function dismissResumePopup(frame, { waitMs = 4000 } = {}) {
  const isUp = () => frame.evaluate(() =>
    [...document.querySelectorAll('.se-popup, [class*="popup"]')].some(
      (e) => /작성 중인 글/.test(e.innerText || '') && e.offsetParent !== null,
    ))

  // 팝업은 프레임이 뜬 직후가 아니라 조금 뒤에 나타난다. 한 번만 보고 "없음"으로
  // 넘어가면, 우리가 타이핑을 시작한 뒤에 떠서 클릭을 삼킨다.
  let found = false
  for (let i = 0; i < Math.ceil(waitMs / 400) && !found; i++) {
    found = await isUp()
    if (!found) await sleep(400)
  }
  if (!found) return { found: false, dismissed: false }

  await frame.evaluate(() => {
    const el = [...document.querySelectorAll('.se-popup, [class*="popup"]')]
      .find((e) => /작성 중인 글/.test(e.innerText || ''))
    const cancel = [...el.querySelectorAll('button')].find((b) => /취소|닫기/.test(b.innerText || ''))
    cancel?.click()
  })
  await sleep(1200)

  // "눌렀다"가 아니라 "닫혔다"를 본다. 안 닫히면 이후 모든 클릭을 이 팝업이 삼킨다.
  const gone = await frame.evaluate(() =>
    ![...document.querySelectorAll('.se-popup, [class*="popup"]')].some(
      (e) => /작성 중인 글/.test(e.innerText || '') && e.offsetParent !== null,
    ))
  if (!gone) throw new Error('"작성 중인 글" 팝업이 닫히지 않았다 — 이후 클릭이 전부 무시된다')
  // 팝업이 사라진 직후에도 에디터는 잠깐 입력을 받지 않는다. 여기서 안 기다리면
  // 첫 타이핑이 통째로 삼켜진다.
  await sleep(1500)
  return { found: true, dismissed: true }
}

/**
 * 에디터가 정말 비어 있는지 확인하고, 아니면 비운다.
 *
 * 팝업을 닫는 것만으로는 부족하다. 네이버는 자동저장분을 팝업 없이 복원해두기도 하고,
 * 팝업이 우리가 확인한 뒤에 뜨기도 한다. 실제로 지난 실행의 잔재가 남은 채 그 위에
 * 덧씌워져 제목이 "…금융규제의 …금융규제의 완벽한 폭풍…" 처럼 겹쳤다(2026-08-14).
 * 빈 상태를 전제하지 말고 강제한다.
 */
export async function ensureBlankEditor(page, frame) {
  const read = () => frame.evaluate((s) => {
    const t = document.querySelector(s.title)
    const bodies = [...document.querySelectorAll(`${s.bodyComponent} ${s.paragraph}`)]
    const clean = (e) => (e?.innerText || '')
      .replace(/​/g, '')
      // 플레이스홀더가 innerText에 섞여 나온다
      .replace(/^제목$/, '')
      .replace(/나를 돌아보는 회고.*$/s, '')
      .trim()
    return { title: clean(t), body: bodies.map(clean).filter(Boolean).join('\n') }
  }, SEL)

  let st = await read()
  if (!st.title && !st.body) return { wasBlank: true, cleared: false }

  // 비운다: 본문 → 제목 순. 각각 전체 선택 후 삭제.
  for (const target of ['body', 'title']) {
    const sel = target === 'title' ? SEL.title : `${SEL.bodyComponent} ${SEL.paragraph}`
    const el = await frame.$(sel)
    if (!el) continue
    await el.click()
    await sleep(300)
    await frame.evaluate((s) => {
      const nodes = document.querySelectorAll(s)
      const root = nodes[0]?.closest('.se-component') || nodes[0]
      if (!root) return
      const r = document.createRange()
      r.selectNodeContents(root)
      const g = window.getSelection(); g.removeAllRanges(); g.addRange(r)
    }, sel)
    await sleep(200)
    await page.keyboard.press('Backspace')
    await sleep(400)
  }

  st = await read()
  if (st.title || st.body) {
    throw new Error(`에디터를 비우지 못했다 — 제목:"${st.title.slice(0, 30)}" 본문:"${st.body.slice(0, 30)}"`)
  }
  return { wasBlank: false, cleared: true }
}

/** 도움말 패널이 열려 있으면 닫는다 (첫 진입 시 뜬다) */
export async function dismissHelpPanel(frame) {
  const btn = await frame.$('.se-help-panel-close-button, button[class*="help"][class*="close"]')
  if (!btn) return false
  await btn.click()
  await sleep(500)
  return true
}

/** 현재 계정이 맞는지. 잘못된 계정 발행이 최악이다. */
export async function assertAccount(page) {
  const url = page.url()
  if (!url.includes(BLOG_ID)) throw new Error(`계정 불일치: ${url}`)
  return true
}

/** 발행 패널을 연다. 눌렀는지가 아니라 열렸는지로 판정한다. */
export async function openPublishPanel(frame) {
  await frame.evaluate((s) => document.querySelector(s)?.click(), SEL.publish)
  await sleep(2000)
  const opened = await frame.evaluate(() =>
    [...document.querySelectorAll('[class*="option_"], [class*="layer_"], [class*="publish_"]')].some(
      (e) => e.offsetParent !== null && /공개 설정|발행 시간|카테고리|태그 편집/.test(e.innerText || ''),
    ))
  if (!opened) throw new Error('발행 패널이 열리지 않았다 — 무언가 클릭을 가로채고 있다')
  return true
}

/** 예약 발행 건수 (등록 검증의 기준선). 절대 수가 아니라 증가분을 보기 위한 값. */
export async function reserveCount(frame) {
  const t = await frame.evaluate((s) => document.querySelector(s)?.innerText?.trim() || '', SEL.reserveBtn)
  const m = t.match(/(\d+)\s*건/)
  return m ? parseInt(m[1], 10) : null
}

/** 예약된 글 제목 목록. 상태 파일이 사라져도 중복 예약을 막는 2차 방어선. */
export async function reservedTitles(frame) {
  await frame.evaluate((s) => document.querySelector(s)?.click(), SEL.reserveBtn)
  await sleep(2000)
  const text = await frame.evaluate((s) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.offsetParent !== null && /예약 발행 글/.test(e.innerText || ''))
    return el?.innerText || ''
  }, SEL.reserveLayer)

  // 닫는다 — 열어둔 채로 두면 다음 클릭을 가로챈다
  await frame.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /팝업닫기|닫기/.test(b.innerText || '') && b.offsetParent !== null)
    btn?.click()
  })
  await sleep(800)

  if (/예약 발행 글이 없습니다/.test(text)) return []
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^예약 발행 글|^총\s*\d+|^팝업닫기$|^\d+개$/.test(l))
}
