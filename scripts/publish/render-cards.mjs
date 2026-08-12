// 브리핑 JSON → 카드 PNG 5장. 헤드리스 크롬이 요소를 직접 스크린샷한다.
// 사용법: node scripts/publish/render-cards.mjs [YYYY-MM-DD]

import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { connectChrome, newPage } from './lib/chrome.mjs'
import { renderCardsHtml, CARD_KEYS } from './card-template.mjs'

const MIN_BYTES = 20_000 // 빈 흰 카드는 이 크기를 못 넘긴다
const SIZE = 1080

export async function renderCards(dateStr, { browser: given } = {}) {
  const briefingPath = join(process.cwd(), 'public', 'briefings', `${dateStr}.json`)
  if (!existsSync(briefingPath)) throw new Error(`브리핑 없음: ${briefingPath}`)
  const briefing = JSON.parse(readFileSync(briefingPath, 'utf-8'))

  const outDir = join(process.cwd(), '.publish-assets', dateStr)
  mkdirSync(outDir, { recursive: true })

  const conn = given ? null : await connectChrome({ headless: true })
  const browser = given || conn.browser
  const page = await newPage(browser)
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 })

  try {
    await page.setContent(renderCardsHtml(briefing), { waitUntil: 'domcontentloaded' })

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
    for (let i = 0; i < CARD_KEYS.length; i++) {
      const key = CARD_KEYS[i]
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
  console.log(`\n카드 렌더: ${date}`)
  renderCards(date)
    .then((f) => console.log(`\n${f.length}장 완료\n`))
    .catch((e) => { console.error(`\n실패: ${e.message}\n`); process.exit(1) })
}
