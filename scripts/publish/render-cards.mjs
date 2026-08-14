// 브리핑 JSON → 카드 PNG 5장. 헤드리스 크롬이 요소를 직접 스크린샷한다.
// 사용법: node scripts/publish/render-cards.mjs [YYYY-MM-DD]

import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { connectChrome, newPage } from './lib/chrome.mjs'
import { renderCardsHtml, renderGenericCardsHtml, CARD_KEYS } from './card-template.mjs'
import { parseDraft } from './lib/draft.mjs'
import { stripInline } from './lib/inline.mjs'

const MIN_BYTES = 20_000 // 빈 흰 카드는 이 크기를 못 넘긴다
const SIZE = 1080

/**
 * 초안 파일에서 카드 재료를 뽑는다. 브리핑은 전용 JSON, 나머지는 초안의 굵은 소제목.
 * @param {string} draftFile blog-posts 기준 파일명
 */
export function cardSourceFor(dateStr, draftFile) {
  if (!draftFile || /부동산브리핑\.md$/.test(draftFile)) {
    const p = join(process.cwd(), 'public', 'briefings', `${dateStr}.json`)
    if (!existsSync(p)) throw new Error(`브리핑 없음: ${p}`)
    return { kind: 'briefing', briefing: JSON.parse(readFileSync(p, 'utf-8')) }
  }

  const md = readFileSync(join(process.cwd(), 'blog-posts', draftFile), 'utf-8')
  const d = parseDraft(md)
  const category = (md.match(/^>\s*카테고리:\s*(.+)$/m) || [])[1]?.trim() || '수군수군 우리집'

  // 문장 중간에서 자르면 "…03년 준공이니" 처럼 깨져 보인다. 마지막 문장 끝에서
  // 자르고, 그럴 자리가 없으면 말줄임표를 붙인다.
  const clip = (t, max) => {
    const s0 = String(t || '').trim()
    if (s0.length <= max) return s0
    const cut = s0.slice(0, max)
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('요. '))
    return end > max * 0.45 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…'
  }

  // 굵은 소제목 = 카드 본문. 소제목이 없으면 앞쪽 본문 문단으로 대체해 최소 3장을 채운다.
  const points = []
  for (const i of d.subheadIndexes) {
    const full = stripInline(d.blocks[i].text)
    const head = clip(full.split(/(?<=[.!?])\s/)[0], 40)
    const next = d.blocks[i + 1]
    const rest = d.blocks[i].standalone && next && next.type === 'body'
      ? stripInline(next.text)
      : full.slice(full.split(/(?<=[.!?])\s/)[0].length).trim()
    points.push({ head, body: clip(rest, 100) })
  }
  if (points.length === 0) {
    for (let i = d.bodyStart; i <= d.bodyEnd && points.length < 2; i++) {
      const t = stripInline(d.blocks[i]?.text || '')
      if (t) points.push({ head: clip(t.split(/(?<=[.!?])\s/)[0], 40), body: clip(t, 100) })
    }
  }
  return { kind: 'generic', title: d.title, date: dateStr, category, points }
}

export async function renderCards(dateStr, { browser: given, draftFile = null } = {}) {
  const src = cardSourceFor(dateStr, draftFile)
  const rendered = src.kind === 'briefing'
    ? { html: renderCardsHtml(src.briefing), keys: CARD_KEYS }
    : renderGenericCardsHtml(src)

  const outDir = join(process.cwd(), '.publish-assets', draftFile ? draftFile.replace(/\.md$/, '') : dateStr)
  mkdirSync(outDir, { recursive: true })

  const conn = given ? null : await connectChrome({ headless: true, profile: 'render' })
  const browser = given || conn.browser
  const page = await newPage(browser)
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 })

  try {
    await page.setContent(rendered.html, { waitUntil: 'domcontentloaded' })

    // 폰트 로딩 전에 캡처하면 폴백 폰트로 찍힌다. 에러도 안 나고 파일도 정상 크기로 생긴다.
    await page.evaluate(() => document.fonts.ready)

    const fontOk = await page.evaluate(() => {
      const el = document.querySelector('.c1-title')
      const ff = getComputedStyle(el).fontFamily
      return { ff, ok: /Apple SD Gothic Neo|Noto Sans KR/i.test(ff) }
    })
    if (!fontOk.ok) throw new Error(`폰트가 기대와 다르다: ${fontOk.ff}`)

    // 넘치는 카드는 폰트를 줄여 맞춘다
    const fit = await page.evaluate(() => window.__fitCards())
    for (const f of fit) {
      if (f.overflow) throw new Error(`카드 ${f.card} 가 축소 후에도 넘친다`)
      if (f.shrunk > 0) console.log(`  · ${f.card}: 폰트 ${f.shrunk}단계 축소`)
    }

    const files = []
    for (let i = 0; i < rendered.keys.length; i++) {
      const key = rendered.keys[i]
      const el = await page.$(`[data-card="${key}"]`)
      if (!el) throw new Error(`카드 요소 없음: ${key}`)
      const path = join(outDir, `${String(i + 1).padStart(2, '0')}-${key}.png`)
      await el.screenshot({ path })

      // "만들었다"가 아니라 "제대로 만들어졌다"를 확인한다
      const size = statSync(path).size
      if (size < MIN_BYTES) throw new Error(`${key} 카드가 ${size}B — 빈 카드로 보인다`)
      const dim = await page.evaluate((k) => {
        const e = document.querySelector(`[data-card="${k}"]`)
        return { w: e.clientWidth, h: e.clientHeight }
      }, key)
      if (dim.w !== SIZE || dim.h !== SIZE) throw new Error(`${key} 카드가 ${dim.w}×${dim.h}`)

      files.push({ key, path, bytes: size })
      console.log(`  ✅ ${key.padEnd(7)} ${(size / 1024).toFixed(0).padStart(4)}KB  ${path}`)
    }
    return files
  } finally {
    await page.close().catch(() => {})
    if (conn) await conn.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const date = process.argv[2] || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const draftFile = process.argv[3] || null
  console.log(`\n카드 렌더: ${date}${draftFile ? ` (${draftFile})` : ''}`)
  renderCards(date, { draftFile })
    .then((f) => console.log(`\n${f.length}장 완료\n`))
    .catch((e) => { console.error(`\n실패: ${e.message}\n`); process.exit(1) })
}
