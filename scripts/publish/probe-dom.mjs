// 에디터 DOM 구조 덤프. 입력도 저장도 하지 않는다 — 읽기 전용.
// 목적: 제목 컴포넌트와 본문 컴포넌트를 확실히 가르는 셀렉터를 찾는다.
// (probe-input에서 .se-component-content 가 제목까지 매칭해 본문 텍스트가 제목에 박혔다)

import { connectChrome, newPage } from './lib/chrome.mjs'

const BLOG_ID = 'kaimex'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { browser } = await connectChrome()
  const page = await newPage(browser)
  await page.setViewport({ width: 1440, height: 950 })
  await page.goto(`https://blog.naver.com/${BLOG_ID}?Redirect=Write`, { waitUntil: 'networkidle2', timeout: 45000 })
  await sleep(3500)

  const frame = page.frames().find((f) => /PostWriteForm/.test(f.url()))
  if (!frame) throw new Error('에디터 프레임 없음')

  const dump = await frame.evaluate(() => {
    const out = { components: [], toolbar: [], header: [] }

    // 에디터 최상위 컴포넌트들 — 제목/본문이 어떻게 나뉘는지
    document.querySelectorAll('.se-component').forEach((el, i) => {
      out.components.push({
        i,
        cls: el.className,
        type: el.getAttribute('data-a11y-title') || el.dataset.compType || '',
        editables: el.querySelectorAll('[contenteditable="true"]').length,
        paragraphs: el.querySelectorAll('.se-text-paragraph').length,
        text: (el.innerText || '').slice(0, 40).replace(/\s+/g, ' '),
      })
    })

    // 툴바 버튼 — 굵게·사진·소제목 경로 확인용
    document.querySelectorAll('button, [role="button"]').forEach((el) => {
      const name = el.getAttribute('data-name') || el.getAttribute('data-log') || ''
      const label = (el.getAttribute('aria-label') || el.title || el.innerText || '').slice(0, 24).replace(/\s+/g, ' ')
      if (name || label) out.toolbar.push({ name, label, cls: String(el.className).slice(0, 60) })
    })

    // 상단 저장/발행
    document.querySelectorAll('[class*="publish"], [class*="save"]').forEach((el) => {
      out.header.push({ tag: el.tagName, cls: String(el.className).slice(0, 70), text: (el.innerText || '').slice(0, 20).replace(/\s+/g, ' ') })
    })

    // 본문 컨테이너 후보
    out.mainContainer = document.querySelector('.se-main-container')?.className || null
    out.titleWrap = document.querySelector('.se-documentTitle')?.className || null
    out.bodyOnlyCount = document.querySelectorAll('.se-component:not(.se-documentTitle) .se-text-paragraph').length
    out.titleParaCount = document.querySelectorAll('.se-documentTitle .se-text-paragraph').length
    return out
  })

  console.log('\n■ 컴포넌트 (제목 vs 본문 구분)')
  for (const c of dump.components) {
    console.log(`  [${c.i}] editable=${c.editables} para=${c.paragraphs} "${c.text}"`)
    console.log(`       ${c.cls}`)
  }

  console.log('\n■ 컨테이너')
  console.log('  se-main-container :', dump.mainContainer)
  console.log('  se-documentTitle  :', dump.titleWrap)
  console.log('  제목 밖 문단 수   :', dump.bodyOnlyCount)
  console.log('  제목 안 문단 수   :', dump.titleParaCount)

  console.log('\n■ 툴바 버튼 (data-name 있는 것)')
  for (const b of dump.toolbar.filter((b) => b.name)) console.log(`  ${b.name.padEnd(18)} "${b.label}"`)

  console.log('\n■ 툴바 버튼 (라벨만 — 굵게/소제목 후보)')
  for (const b of dump.toolbar.filter((b) => !b.name && /굵|볼드|bold|제목|인용|본문/i.test(b.label))) {
    console.log(`  "${b.label}"  ${b.cls}`)
  }

  console.log('\n■ 저장 / 발행')
  for (const h of dump.header) console.log(`  ${h.tag} "${h.text}"  ${h.cls}`)

  console.log()
  await browser.disconnect()
}

main().catch((e) => { console.error('실패:', e.message); process.exit(1) })
