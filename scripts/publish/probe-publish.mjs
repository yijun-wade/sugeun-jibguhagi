// 발행 패널 / 예약 UI 진단기.
//
// 안전장치: 제목을 비운 상태로만 연다. 네이버는 제목 없는 글의 발행을 거부하므로
// 만에 하나 확정이 눌려도 발행되지 않는다. 확정 버튼은 절대 클릭하지 않는다.
// 패널을 열고 구조만 읽은 뒤 Esc로 닫는다.

import { connectChrome, newPage } from './lib/chrome.mjs'

const BLOG_ID = 'kaimex'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ok = (m) => console.log(`  ✅ ${m}`)
const no = (m) => console.log(`  ❌ ${m}`)

async function main() {
  const { browser } = await connectChrome()
  const page = await newPage(browser)
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto(`https://blog.naver.com/${BLOG_ID}?Redirect=Write`, { waitUntil: 'networkidle2', timeout: 45000 })
  await sleep(3500)

  const frame = page.frames().find((f) => /PostWriteForm/.test(f.url()))
  if (!frame) throw new Error('에디터 프레임 없음')

  // ── "작성 중인 글이 있습니다" 팝업 먼저 치운다 ─────────────
  // 네이버가 자동저장한 초안이 있으면 이 팝업이 뜨고, 이후 모든 클릭을 가로챈다.
  // 반드시 "취소"(닫기)를 고른다. "확인"은 이어쓰기라 초안이 섞인다.
  console.log('\n[0] 이어쓰기 팝업 처리')
  const resume = await frame.evaluate(() => {
    const el = [...document.querySelectorAll('.se-popup, [class*="popup"]')]
      .find((e) => /작성 중인 글/.test(e.innerText || ''))
    if (!el) return null
    const btns = [...el.querySelectorAll('button')].map((b) => (b.innerText || '').trim())
    return { btns }
  })
  if (resume) {
    console.log(`  · 팝업 감지 — 버튼 ${JSON.stringify(resume.btns)}`)
    const clicked = await frame.evaluate(() => {
      const el = [...document.querySelectorAll('.se-popup, [class*="popup"]')]
        .find((e) => /작성 중인 글/.test(e.innerText || ''))
      const cancel = [...el.querySelectorAll('button')].find((b) => /취소|닫기/.test(b.innerText || ''))
      if (!cancel) return false
      cancel.click()
      return true
    })
    await sleep(1200)
    // "했다"가 아니라 "됐다" — 팝업이 실제로 사라졌는지 확인한다
    const gone = await frame.evaluate(() =>
      ![...document.querySelectorAll('.se-popup, [class*="popup"]')].some(
        (e) => /작성 중인 글/.test(e.innerText || '') && e.offsetParent !== null,
      ))
    clicked && gone ? ok('팝업 닫힘 (이어쓰기 아님)') : no('팝업이 안 닫힘 — 중단')
    if (!gone) { await browser.disconnect(); return }
  } else console.log('  · 팝업 없음')

  // 안전 확인 — 제목이 비어 있어야 한다
  const titleText = await frame.$eval('.se-documentTitle', (e) => (e.innerText || '').trim()).catch(() => '')
  if (titleText && titleText !== '제목') {
    no(`제목이 비어 있지 않다("${titleText}") — 안전을 위해 중단`)
    await browser.disconnect()
    return
  }
  ok('제목 비어 있음 — 발행 불가 상태 확인')

  console.log('\n[1] 발행 패널 열기')
  const publishBtn = await frame.$('button.publish_btn__m9KHH')
  if (!publishBtn) { no('발행 버튼 못 찾음'); await browser.disconnect(); return }
  await publishBtn.click()
  await sleep(2000)

  // 눌렀다고 열린 게 아니다. 패널 고유 요소가 실제로 보이는지로 판정한다.
  const opened = await frame.evaluate(() =>
    [...document.querySelectorAll('[class*="option_"], [class*="layer_"], [class*="publish_"]')].some(
      (e) => e.offsetParent !== null && /공개 설정|발행 시간|카테고리|태그 편집/.test(e.innerText || ''),
    ))
  if (!opened) {
    no('발행 버튼을 눌렀지만 패널이 안 열림 — 무언가 클릭을 가로채고 있다')
    await page.screenshot({ path: '.publish-assets/probe-publish-blocked.png' })
    console.log('  📸 .publish-assets/probe-publish-blocked.png')
    await browser.disconnect()
    return
  }
  ok('패널 열림 (내용으로 확인)')

  console.log('\n[2] 패널 구조')
  const panel = await frame.evaluate(() => {
    const out = { radios: [], buttons: [], inputs: [], texts: [] }
    document.querySelectorAll('[class*="option_"], [class*="publish"], [class*="layer"]').forEach((el) => {
      const t = (el.innerText || '').trim()
      if (t && t.length < 120) out.texts.push(t.replace(/\s+/g, ' ').slice(0, 90))
    })
    document.querySelectorAll('input').forEach((el) => {
      out.inputs.push({ type: el.type, id: el.id, name: el.name, cls: String(el.className).slice(0, 55), readOnly: el.readOnly, value: String(el.value).slice(0, 20) })
    })
    document.querySelectorAll('label, button').forEach((el) => {
      const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')
      if (t && t.length < 30) out.buttons.push({ tag: el.tagName, text: t, cls: String(el.className).slice(0, 55), for: el.htmlFor || '' })
    })
    return out
  })

  console.log('\n  ■ input 요소 (날짜·시·분 후보)')
  for (const i of panel.inputs) {
    console.log(`    ${i.type.padEnd(8)} id=${(i.id || '-').padEnd(22)} readOnly=${String(i.readOnly).padEnd(5)} val="${i.value}"  ${i.cls}`)
  }

  console.log('\n  ■ 예약 관련 라벨/버튼')
  for (const b of panel.buttons.filter((b) => /예약|현재|공개|발행|시간|날짜|분|시/.test(b.text))) {
    console.log(`    ${b.tag.padEnd(7)} "${b.text}"  for=${b.for || '-'}  ${b.cls}`)
  }

  const hasReserve = panel.buttons.some((b) => /예약/.test(b.text))
  hasReserve ? ok('\n  예약 옵션 존재') : no('\n  예약 옵션 못 찾음')

  // ── 예약 라디오를 켜야 날짜·시·분 UI가 나타난다 ────────────
  // 확정은 누르지 않는다. 라디오만 켜고 구조를 읽는다.
  console.log('\n[3] 예약 선택 시 나타나는 날짜·시·분')
  await frame.evaluate(() => document.querySelector('label[for="radio_time2"]')?.click())
  await sleep(1200)

  const on = await frame.evaluate(() => document.querySelector('#radio_time2')?.checked === true)
  on ? ok('예약 라디오 ON (checked로 확인)') : no('예약 라디오가 안 켜짐')

  const sched = await frame.evaluate(() => {
    const out = { inputs: [], selects: [], calendar: null }
    document.querySelectorAll('input').forEach((el) => {
      if (/date|hour|min|time|시|분/i.test(el.id + el.name + el.className) || el.readOnly) {
        out.inputs.push({ id: el.id, cls: String(el.className).slice(0, 50), readOnly: el.readOnly, value: String(el.value).slice(0, 24) })
      }
    })
    document.querySelectorAll('select').forEach((el) => {
      out.selects.push({ id: el.id, cls: String(el.className).slice(0, 45), value: el.value, options: [...el.options].slice(0, 4).map((o) => o.value) })
    })
    const cal = document.querySelector('[class*="calendar"], [class*="datepicker"]')
    out.calendar = cal ? String(cal.className).slice(0, 60) : null
    return out
  })

  console.log('  ■ 날짜/시각 input')
  for (const i of sched.inputs) console.log(`    id=${(i.id || '-').padEnd(24)} readOnly=${String(i.readOnly).padEnd(5)} val="${i.value}"  ${i.cls}`)
  console.log('  ■ select (시·분 후보)')
  for (const s of sched.selects) console.log(`    id=${(s.id || '-').padEnd(24)} val=${s.value}  opts=${JSON.stringify(s.options)}  ${s.cls}`)
  console.log(`  ■ 달력 컨테이너: ${sched.calendar || '없음'}`)

  // 시·분이 select라면 선택 가능한 값이 유한하다. 예약 시각 정책이 여기 걸린다.
  const opts = await frame.evaluate(() => {
    const h = document.querySelector('select.hour_option__J_heO')
    const m = document.querySelector('select.minute_option__Vb3xB')
    const d = document.querySelector('input.input_date__QmA0s')
    return {
      hours: h ? [...h.options].map((o) => o.value) : null,
      minutes: m ? [...m.options].map((o) => o.value) : null,
      dateValue: d?.value ?? null,
      dateReadOnly: d?.readOnly ?? null,
      // 날짜칸을 눌렀을 때 달력이 뜨는지 보려면 형제 요소를 봐야 한다
      dateSiblings: d ? [...(d.parentElement?.children || [])].map((e) => `${e.tagName}.${String(e.className).slice(0, 34)}`) : null,
      // React 등이 붙어 있으면 값 대입만으로는 상태가 안 바뀐다
      reactish: h ? Object.keys(h).filter((k) => /^__react|^_react/i.test(k)) : [],
    }
  })
  console.log(`\n  ■ 선택 가능한 시(hour): ${JSON.stringify(opts.hours)}`)
  console.log(`  ■ 선택 가능한 분(minute): ${JSON.stringify(opts.minutes)}`)
  console.log(`  ■ 날짜칸: value="${opts.dateValue}" readOnly=${opts.dateReadOnly}`)
  console.log(`  ■ 날짜칸 형제: ${JSON.stringify(opts.dateSiblings)}`)
  console.log(`  ■ React 내부키: ${JSON.stringify(opts.reactish)}`)

  const reserveCount = await frame.evaluate(() =>
    document.querySelector('button.reserve_btn__Km5Xh')?.innerText.trim() || null)
  console.log(`\n  ■ 예약 건수 기준선: "${reserveCount}"  ← 등록 검증은 이 숫자의 증가분으로`)

  await page.screenshot({ path: '.publish-assets/probe-publish.png' })
  console.log('\n  📸 .publish-assets/probe-publish.png')

  // 패널 닫기 — 확정은 누르지 않는다
  await page.keyboard.press('Escape')
  await sleep(800)
  console.log('\n⚠ 확정 버튼은 누르지 않았습니다. 발행·예약 0건.\n')
  await browser.disconnect()
}

main().catch((e) => { console.error('실패:', e.message); process.exit(1) })
