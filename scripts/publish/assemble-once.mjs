// 조립 1회 수동 실행 (Task 6 검증용). 발행·예약 없음 — 임시저장까지만.
// 사용법: node scripts/publish/assemble-once.mjs YYYY-MM-DD
import { readFileSync } from 'node:fs'
import { parseDraft } from './lib/draft.mjs'
import { buildLayout } from './lib/layout.mjs'
import { renderCards } from './render-cards.mjs'
import { connectChrome, newPage } from './lib/chrome.mjs'
import { assemble } from './naver-editor.mjs'
import { draftPath } from './precheck.mjs'

const date = process.argv[2]
if (!date) { console.error('날짜를 주세요: YYYY-MM-DD'); process.exit(1) }

console.log(`\n■ 조립 시험: ${date}  (발행·예약 없음, 임시저장까지)\n`)
const draft = parseDraft(readFileSync(draftPath(date), 'utf-8'))
const { placements, warnings } = buildLayout(draft)
console.log(`  초안: "${draft.title}"`)
console.log(`  블록 ${draft.blocks.length}개 / 이미지 ${placements.length}장 / 태그 ${draft.tags.length}개`)
if (warnings.length) console.log(`  ⚠ ${warnings.join(' / ')}`)

// --skip-render: 이미 렌더된 PNG를 재사용한다(원인 격리·재시도용)
let assets
if (process.argv.includes('--skip-render')) {
  const { readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const dir = join(process.cwd(), '.publish-assets', date)
  assets = readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
    .map((f) => ({ key: f.replace(/^\d+-|\.png$/g, ''), path: join(dir, f) }))
  console.log(`\n  · 카드 재사용 ${assets.length}장`)
} else {
  console.log('\n  · 카드 렌더')
  assets = await renderCards(date)
}

const { browser, close } = await connectChrome()
const page = await newPage(browser)
await page.setViewport({ width: 1440, height: 950 })
try {
  const r = await assemble(page, { draft, placements, assets })
  console.log(`\n✅ 조립 완료 — 문단 ${r.blocks}개, 이미지 ${r.images}장, 임시저장 ${r.saved.before}→${r.saved.after}`)

  // 조립 결과를 순서대로 덤프한다. 연결을 끊은 뒤에는 확인할 수 없으므로 여기서 한다.
  const { SEL } = await import('./lib/editor.mjs')
  const frame = page.frames().find((f) => SEL.frame.test(f.url()))
  // 컴포넌트가 아니라 문단 단위로 본다. 네이버는 한 컴포넌트 안에 여러 문단을 담아서,
  // 컴포넌트로 묶어 읽으면 소제목과 본문이 한 줄로 보이고 서식 플래그도 섞인다.
  const doc = await frame.evaluate(() => {
    const out = []
    document.querySelectorAll('.se-component').forEach((c) => {
      if (c.classList.contains('se-documentTitle')) { out.push({ t: 'title', text: (c.innerText || '').trim() }); return }
      if (c.querySelector('img')) { out.push({ t: 'img', text: '' }); return }
      c.querySelectorAll('.se-text-paragraph').forEach((p) => {
        const h = p.innerHTML
        const text = (p.innerText || '').replace(/\u200b/g, '').replace(/\s+/g, ' ').trim()
        if (!text) return
        out.push({
          t: 'p',
          text: text.slice(0, 44),
          bold: /<b[ >]|<strong|font-weight:\s*bold/i.test(h),
          italic: /<i[ >]|<em[ >]|font-style:\s*italic/i.test(h),
        })
      })
    })
    return out
  })
  console.log('\n■ 조립 결과 (순서대로)')
  doc.forEach((d, i) => {
    const m = d.t === 'img' ? '🖼 이미지' : d.t === 'title' ? '📌 ' + d.text : `${d.bold ? 'B' : ' '}${d.italic ? 'I' : ' '} ${d.text}`
    console.log('  ' + String(i).padStart(2) + ' ' + m)
  })

  // 굵게가 실제로 어디에 붙었는지 — 덤프 판정을 믿지 말고 원본 HTML로 확인한다
  const raw = await frame.$$eval('.se-component:not(.se-documentTitle) .se-text-paragraph', (els) =>
    els.map((e) => ({
      text: (e.innerText || '').replace(/\u200b/g, '').trim().slice(0, 26),
      b: (e.innerHTML.match(/<b[ >]/g) || []).length,
      i: (e.innerHTML.match(/<i[ >]/g) || []).length,
      fs: getComputedStyle(e.querySelector('span') || e).fontSize,
      cls: (e.className.match(/se-fs\d+|se-section-\w+/g) || []).join(','),
      comp: (e.closest('.se-component')?.className.match(/se-\w+/g) || []).filter((c) => !/se-l-|se-component|se-text$/.test(c)).join(','),
    })).filter((x) => x.text))
  console.log('\n■ 문단별 서식')
  raw.forEach((r, i) => console.log(`  ${String(i).padStart(2)} b=${r.b} i=${r.i} ${String(r.fs).padStart(5)} ${r.comp.padEnd(14)} ${r.text}`))

  console.log('\n네이버 임시저장 글을 직접 열어 확인해주세요. 발행은 하지 않았습니다.\n')
  await frame.evaluate(() => window.scrollTo(0, 0))
  await new Promise((r) => setTimeout(r, 800))
  await page.screenshot({ path: `.publish-assets/assemble-${date}.png`, fullPage: true })
} catch (e) {
  console.error(`\n❌ 실패: ${e.message}\n`)
  await page.screenshot({ path: `.publish-assets/assemble-fail-${date}.png` })
  process.exitCode = 1
} finally { await close() }
