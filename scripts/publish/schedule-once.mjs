// 조립 + 예약 등록 1회 실행 (Task 7 검증용).
// 기본은 드라이런 — 확정 직전에서 멈춘다. --confirm 을 줘야 실제로 예약된다.
// 사용법: node scripts/publish/schedule-once.mjs YYYY-MM-DD [--skip-render] [--confirm]
import { readFileSync } from 'node:fs'
import { parseDraft } from './lib/draft.mjs'
import { buildLayout } from './lib/layout.mjs'
import { nextSlot } from './lib/slot.mjs'
import { renderCards } from './render-cards.mjs'
import { connectChrome, newPage } from './lib/chrome.mjs'
import { SEL } from './lib/editor.mjs'
import { assemble } from './naver-editor.mjs'
import { schedule } from './naver-schedule.mjs'
import { draftPath } from './precheck.mjs'

const date = process.argv[2]
const doConfirm = process.argv.includes('--confirm')
if (!date) { console.error('날짜를 주세요: YYYY-MM-DD'); process.exit(1) }

const draft = parseDraft(readFileSync(draftPath(date), 'utf-8'))
const { placements } = buildLayout(draft)
const slot = nextSlot(new Date())

console.log(`\n■ 예약 시험: ${date}`)
console.log(`  초안: "${draft.title}"`)
console.log(`  예약 목표: ${slot.date} ${slot.hourValue}:${slot.minuteValue} (${slot.sameDay ? '당일' : '익일'})`)
console.log(`  모드: ${doConfirm ? '⚠ 실제 예약 (--confirm)' : '드라이런 — 확정 직전에서 멈춤'}\n`)

let assets
if (process.argv.includes('--skip-render')) {
  const { readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const dir = join(process.cwd(), '.publish-assets', date)
  assets = readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
    .map((f) => ({ key: f.replace(/^\d+-|\.png$/g, ''), path: join(dir, f) }))
  console.log(`  · 카드 재사용 ${assets.length}장`)
} else {
  console.log('  · 카드 렌더')
  assets = await renderCards(date)
}

const { browser, close } = await connectChrome()
const page = await newPage(browser)
await page.setViewport({ width: 1440, height: 950 })
try {
  const r = await assemble(page, { draft, placements, assets })
  console.log(`  · 조립 완료 — 문단 ${r.blocks}, 이미지 ${r.images}`)

  const frame = page.frames().find((f) => SEL.frame.test(f.url()))
  console.log('  · 예약 설정')
  const s = await schedule(page, frame, slot, { confirm: doConfirm })

  console.log('\n■ 확정 직전 상태')
  console.log(`  예약 토글 : ${s.reserve ? 'ON ✅' : 'OFF ❌'}   ("현재" 선택: ${s.now ? '예 ❌' : '아니오 ✅'})`)
  console.log(`  날짜      : ${s.date}  → ${s.dateIso} (기대 ${s.want.date}) ${s.dateIso === s.want.date ? '✅' : '❌'}`)
  console.log(`  시:분     : ${s.hour}:${s.minute} (기대 ${s.want.hourValue}:${s.want.minuteValue}) ${s.hour === s.want.hourValue && s.minute === s.want.minuteValue ? '✅' : '❌'}`)
  console.log(`  전체공개  : ${s.public ? '✅' : '❌'}`)
  console.log(`  예약 건수 : ${s.reserveBefore}건 (기준선)`)
  console.log(s.confirmed ? `\n✅ 예약 완료 — 건수 ${s.reserveBefore}→${s.reserveAfter}\n` : `\n⏸ ${s.note}\n`)
  await page.screenshot({ path: `.publish-assets/schedule-${date}.png` })
} catch (e) {
  console.error(`\n❌ ${e.message}\n`)
  await page.screenshot({ path: `.publish-assets/schedule-fail-${date}.png` })
  process.exitCode = 1
} finally { await close() }
