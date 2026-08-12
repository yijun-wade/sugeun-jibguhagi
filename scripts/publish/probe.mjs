// 작동 가능성 진단기. 발행은 절대 하지 않는다 — 읽기만 한다.
//
// 확인하는 것:
//   1) 전용 프로파일 Chrome에 CDP로 붙을 수 있는가
//   2) 네이버 로그인이 살아있는가 (화면이 아니라 판정 신호로)
//   3) 글쓰기 에디터에 진입되는가 — iframe 구조, 제목/본문 요소가 잡히는가
//   4) 발행 패널의 예약 UI가 존재하는가
// 사용법: node scripts/publish/probe.mjs [--login]
//   --login : 로그인 페이지를 열고 사람이 로그인할 때까지 기다린다 (최초 1회)

import { connectChrome, newPage, PROFILE_DIR } from './lib/chrome.mjs'

const BLOG_ID = 'kaimex'
const WANT_LOGIN = process.argv.includes('--login')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ok = (m) => console.log(`  ✅ ${m}`)
const no = (m) => console.log(`  ❌ ${m}`)
const info = (m) => console.log(`  ·  ${m}`)

async function main() {
  console.log(`\n프로파일: ${PROFILE_DIR}\n`)

  console.log('[1] Chrome CDP 연결')
  const { browser, spawned } = await connectChrome()
  ok(`연결됨 (${spawned ? '새로 기동' : '기존 인스턴스에 붙음'})`)
  const page = await newPage(browser)
  await page.setViewport({ width: 1440, height: 950 })

  console.log('\n[2] 네이버 로그인 상태')
  await page.goto('https://nid.naver.com/nidlogin.login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(1500)
  let loggedIn = !/nidlogin\.login/.test(page.url())

  if (!loggedIn && WANT_LOGIN) {
    console.log('\n  🔑 로그인 창을 띄웠습니다. 브라우저에서 직접 로그인해주세요.')
    console.log('     (2단계 인증이 있으면 여기서 통과시켜주세요. 최대 5분 대기)\n')
    for (let i = 0; i < 300 && !loggedIn; i++) {
      await sleep(1000)
      loggedIn = !/nidlogin\.login/.test(page.url())
      if (i % 15 === 14) info(`대기 중… ${i + 1}초`)
    }
  }

  if (!loggedIn) {
    no('로그아웃 상태')
    console.log('\n  → `node scripts/publish/probe.mjs --login` 으로 최초 1회 로그인하세요.\n')
    await browser.disconnect()
    return
  }
  ok('로그인 유지됨')

  console.log('\n[3] 글쓰기 에디터 진입')
  await page.goto(`https://blog.naver.com/${BLOG_ID}?Redirect=Write`, { waitUntil: 'networkidle2', timeout: 45000 })
  await sleep(3000)

  const frames = page.frames()
  info(`프레임 ${frames.length}개`)
  for (const f of frames) info(`   - ${f.name() || '(무명)'} :: ${f.url().slice(0, 90)}`)

  // 스마트에디터 ONE은 mainFrame 안에 별도 iframe으로 뜬다.
  const editorFrame =
    frames.find((f) => /PostWriteForm|editor/i.test(f.url())) ||
    frames.find((f) => f.name() === 'mainFrame') ||
    page.mainFrame()

  info(`에디터 후보 프레임: ${editorFrame.name() || '(무명)'} ${editorFrame.url().slice(0, 80)}`)

  const probeSelectors = {
    '제목 입력부': '.se-documentTitle, .se-section-documentTitle, [class*="documentTitle"]',
    '본문 영역': '.se-component-content, .se-main-container, [contenteditable="true"]',
    '사진 버튼': '[data-name="image"], button[class*="image"], .se-toolbar-item-image',
    '발행 버튼': '.publish_btn__m9KHH, [class*="publish"], button[class*="publish"]',
    '작성중 팝업': '.se-popup, .se-popup-container, [class*="popup"]',
  }

  console.log('\n[4] 에디터 요소 탐지')
  for (const [label, sel] of Object.entries(probeSelectors)) {
    try {
      const n = await editorFrame.$$eval(sel, (els) => els.length).catch(() => 0)
      n > 0 ? ok(`${label} — ${n}개 (${sel.split(',')[0]})`) : no(`${label} — 못 찾음`)
    } catch {
      no(`${label} — 조회 실패`)
    }
  }

  const title = await page.title()
  info(`문서 제목: ${title}`)
  info(`현재 URL: ${page.url().slice(0, 110)}`)

  const shot = `.publish-assets/probe-editor.png`
  await page.screenshot({ path: shot, fullPage: false })
  console.log(`\n  📸 스크린샷: ${shot}`)

  console.log('\n진단 끝. 발행·저장은 하지 않았습니다. 브라우저는 열어둡니다.\n')
  await browser.disconnect()
}

main().catch((e) => {
  console.error('\n진단 실패:', e.message, '\n')
  process.exit(1)
})
