// 입력 경로 진단기. 저장·발행 버튼은 절대 누르지 않는다.
//
// 확인하려는 것 하나: 친구 시스템이 쓰는 "클립보드 + 맥 메뉴 클릭" 없이,
// puppeteer의 CDP 입력만으로 네이버 에디터에 글자가 들어가는가?
// 들어간다면 macOS 접근성 권한 의존이 통째로 사라진다(STEP 0 항목 -1).
//
// 사용법: node scripts/publish/probe-input.mjs

import { connectChrome, newPage } from './lib/chrome.mjs'

const BLOG_ID = 'kaimex'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ok = (m) => console.log(`  ✅ ${m}`)
const no = (m) => console.log(`  ❌ ${m}`)
const info = (m) => console.log(`  ·  ${m}`)

const TEST_TITLE = '[테스트] 발행 파이프라인 입력 확인'
const TEST_BODY = '이것은 자동화 입력 경로를 확인하기 위한 임시 문장입니다. 저장하지 않습니다.'

async function main() {
  const { browser } = await connectChrome()
  const page = await newPage(browser)
  await page.setViewport({ width: 1440, height: 950 })

  console.log('\n[1] 에디터 진입')
  await page.goto(`https://blog.naver.com/${BLOG_ID}?Redirect=Write`, { waitUntil: 'networkidle2', timeout: 45000 })
  await sleep(3500)

  const frame = page.frames().find((f) => /PostWriteForm/.test(f.url()))
  if (!frame) throw new Error('에디터 프레임(PostWriteForm)을 못 찾음')
  ok('에디터 프레임 확보')

  // ── 팝업 구분 ──────────────────────────────────────────────
  // 도움말 패널과 "작성 중인 글이 있습니다"는 둘 다 .se-popup에 걸린다. 구분해야 한다.
  console.log('\n[2] 팝업 판별')
  const popups = await frame.$$eval('.se-popup', (els) =>
    els.map((e) => ({
      text: (e.innerText || '').slice(0, 60).replace(/\s+/g, ' '),
      visible: e.offsetParth !== null && getComputedStyle(e).display !== 'none',
      cls: e.className,
    })),
  ).catch(() => [])
  for (const p of popups) info(`.se-popup → "${p.text}"`)

  const helpClose = await frame.$('.se-help-panel-close-button, button[class*="help"][class*="close"]')
  if (helpClose) { await helpClose.click(); ok('도움말 패널 닫음'); await sleep(600) }

  // 이어쓰기 팝업은 반드시 "취소/닫기"를 골라야 한다 — 이어쓰기를 누르면 초안이 섞인다.
  const resumePopup = await frame.$$eval('.se-popup', (els) =>
    els.some((e) => /작성 중인 글/.test(e.innerText || '')),
  ).catch(() => false)
  info(resumePopup ? '⚠ "작성 중인 글" 팝업 감지 — 닫기 필요' : '이어쓰기 팝업 없음')

  // ── 제목 입력 ──────────────────────────────────────────────
  console.log('\n[3] 제목 입력 — CDP 키보드만으로')
  const titleEl = await frame.$('.se-documentTitle .se-text-paragraph, .se-documentTitle [contenteditable="true"], .se-documentTitle')
  if (!titleEl) { no('제목 요소 못 찾음'); await browser.disconnect(); return }
  await titleEl.click()
  await sleep(400)
  await page.keyboard.type(TEST_TITLE, { delay: 25 })
  await sleep(800)

  const titleGot = await frame.$eval('.se-documentTitle', (e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).catch(() => '')
  info(`읽어온 제목: "${titleGot}"`)
  titleGot.includes('발행 파이프라인 입력 확인')
    ? ok('제목이 실제로 들어감 — 클립보드 경로 불필요')
    : no('제목이 안 들어감 — 클립보드+메뉴 경로 필요')

  // ── 본문 입력 ──────────────────────────────────────────────
  console.log('\n[4] 본문 입력')
  const bodyEl = await frame.$('.se-component-content .se-text-paragraph, .se-main-container [contenteditable="true"]')
  if (!bodyEl) { no('본문 요소 못 찾음') } else {
    await bodyEl.click()
    await sleep(400)
    await page.keyboard.type(TEST_BODY, { delay: 15 })
    await sleep(600)

    // 문단 분리가 되는가 — 통짜 붙여넣기 방지의 핵심
    await page.keyboard.press('Enter')
    await sleep(250)
    await page.keyboard.type('두 번째 문단입니다.', { delay: 15 })
    await sleep(800)

    const paras = await frame.$$eval('.se-main-container .se-text-paragraph', (els) =>
      els.map((e) => (e.innerText || '').trim()).filter(Boolean),
    ).catch(() => [])
    info(`본문 문단 ${paras.length}개: ${JSON.stringify(paras.slice(0, 4))}`)
    paras.length >= 2 ? ok('본문 입력 + 문단 분리 확인') : no('문단 분리 실패')
  }

  // ── 굵게 서식 ──────────────────────────────────────────────
  console.log('\n[5] 굵게 서식 (요약줄·소제목에 필수)')
  await page.keyboard.down('Shift')
  for (let i = 0; i < 9; i++) await page.keyboard.press('ArrowLeft')
  await page.keyboard.up('Shift')
  await sleep(300)
  const boldBtn = await frame.$('button[data-name="bold"], .se-toolbar-item-bold button, button[class*="bold"]')
  if (boldBtn) {
    await boldBtn.click()
    await sleep(600)
    const hasBold = await frame.$$eval('.se-main-container', (els) =>
      els.some((e) => /<b[ >]|font-weight:\s*bold|se-ff-|se-fs-.*bold/i.test(e.innerHTML)),
    ).catch(() => false)
    hasBold ? ok('굵게 적용됨') : no('굵게 미적용 — 클립보드 HTML 경로 필요할 수 있음')
  } else no('굵게 버튼 못 찾음')

  await page.screenshot({ path: '.publish-assets/probe-input.png' })
  console.log('\n  📸 .publish-assets/probe-input.png')
  console.log('\n⚠ 저장·발행은 누르지 않았습니다. 이 임시 글은 버려주세요.\n')
  await browser.disconnect()
}

main().catch((e) => { console.error('\n진단 실패:', e.message, '\n'); process.exit(1) })
