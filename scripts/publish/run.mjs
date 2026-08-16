// 총감독 — STEP 0~4를 순서대로 밀고 상태를 기록한다.
//
// 사용법:
//   node scripts/publish/run.mjs                 오늘 초안을 예약 발행
//   node scripts/publish/run.mjs 2026-08-05      날짜 지정
//   node scripts/publish/run.mjs --dry-run       확정 직전까지만 (예약 안 함)
//
// 원칙 세 가지가 이 파일의 모양을 정한다:
//   1. 각 단계가 "됐다"를 반환한 뒤에만 다음으로 간다.
//   2. 멈춰도 파일이 남는다 — 다음 실행이 완료된 단계를 건너뛴다.
//   3. 실패는 조용히 넘어가지 않는다 — 상태 파일 + macOS 알림.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseDraft } from './lib/draft.mjs'
import { buildLayout } from './lib/layout.mjs'
import { nextSlots, SLOT_HOURS } from './lib/slot.mjs'
import { load, save, mark, done, isComplete } from './lib/state.mjs'
import { notifyFail, notifyOk } from './lib/notify.mjs'
import { connectChrome, newPage } from './lib/chrome.mjs'
import { SEL, humanPause, reservedTitles, openPublishPanel } from './lib/editor.mjs'
import { renderCards } from './render-cards.mjs'
import { assemble } from './naver-editor.mjs'
import { schedule } from './naver-schedule.mjs'
import { precheckOffline, precheckOnline, printChecks, draftPath } from './precheck.mjs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * 초안·브리핑을 원격에서 가져온다.
 *
 * 생성은 GitHub Actions(클라우드), 발행은 이 맥이고 접점은 git이다. 당기지 않으면
 * 로컬에 남은 옛 초안을 매일 다시 발행하게 된다 — 실제로 8/14에 8/4자 글을
 * 예약했다. 원격에는 8/13까지 있었는데 로컬이 8/5에 멈춰 있었다.
 *
 * `git pull`은 쓰지 않는다. 이 저장소에는 발행 스크립트 커밋이 쌓여 있어 병합·리베이스가
 * 충돌하면 자동 실행이 멈춘다. 필요한 경로만 원격 스냅샷에서 꺼내오면 충돌이 없다.
 */
async function syncDrafts() {
  try {
    await run('git', ['fetch', 'origin', 'main', '--quiet'], { cwd: process.cwd(), timeout: 60000 })
    await run('git', ['checkout', 'origin/main', '--', 'blog-posts', 'public/briefings'], { cwd: process.cwd(), timeout: 60000 })
    return { ok: true }
  } catch (e) {
    // 동기화 실패로 발행을 막지는 않는다. 다만 오래된 초안을 쓰게 되므로 경고한다.
    return { ok: false, reason: e.message.split('\n')[0] }
  }
}

/** 사용할 초안 날짜 — 지정이 없으면 "가장 최근에 있는" 초안. 오늘 것이 없으면 어제 것. */
function latestDraftDate() {
  const dir = join(process.cwd(), 'blog-posts')
  return readdirSync(dir)
    .map((f) => (f.match(/^(\d{4}-\d{2}-\d{2})-부동산브리핑\.md$/) || [])[1])
    .filter(Boolean)
    .sort()
    .pop()
}

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const FIXED_DATE = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) || null
// 날짜는 초안 동기화가 끝난 뒤에 정한다 — 먼저 정하면 방금 받아온 오늘치를 못 본다
let DATE = FIXED_DATE

const log = (m) => console.log(m)

/** 예약도 발행도 안 된 초안이 쌓이면 알린다. 자동 소급 발행은 하지 않는다 —
 *  하루에 여러 편이 나가는 것 자체가 대량 발행 신호다. */
function pendingAlert() {
  const dir = join(process.cwd(), 'blog-posts')
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f) && f.slice(0, 10) < DATE)
    .sort()
    .slice(-20)
    .map((f) => f.replace(/\.md$/, ''))
    .filter((id) => !isComplete(load(id)))
}

/** 그 날짜의 초안 전부. 카테고리 구분 없이 파일명으로 찾는다. */
function draftsFor(date) {
  return readdirSync(join(process.cwd(), 'blog-posts'))
    .filter((f) => f.startsWith(`${date}-`) && f.endsWith('.md'))
    .sort()
}

/** 이미 예약된 시각들 — 슬롯 배정에서 제외한다 */
async function takenSlots(frame) {
  try {
    const lines = await reservedTitles(frame)
    return lines
      .map((l) => (l.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/) || []).slice(1))
      .filter((m) => m.length === 5)
      .map(([y, mo, d, h, mi]) => `${y}-${mo}-${d} ${h}:${mi}`)
  } catch { return [] }
}

function recordPublished(date, info) {
  const dir = join(process.cwd(), 'published')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${date}.json`), JSON.stringify(info, null, 2))
}

/** 초안 한 편을 조립·예약한다. 실패해도 다음 초안으로 넘어간다. */
async function publishOne(browser, draftFile, slot, { dry }) {
  // 초안마다 새 탭을 쓴다. 같은 탭을 재사용하면 앞 글의 네비게이션이 살아 있어
  // 두 번째 초안에서 net::ERR_ABORTED 가 났다(2026-08-16).
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 950 })
  try {
    return await publishOneOn(page, draftFile, slot, { dry })
  } finally {
    await page.close().catch(() => {})
  }
}

async function publishOneOn(page, draftFile, slot, { dry }) {
  const id = draftFile.replace(/\.md$/, '')
  const date = draftFile.slice(0, 10)
  const state = load(id)
  state.draft = `blog-posts/${draftFile}`

  const off = await precheckOffline(date, state, draftFile)
  printChecks(off.checks)
  if (!off.ok) {
    const why = off.checks.find((c) => !c.ok)?.reason || '사전 점검 실패'
    if (/이미 (예약|발행)/.test(why)) { mark(state, 'schedule', true, { note: why, byOtherRun: true }); return { skipped: why } }
    mark(state, 'precheck', false, { reason: why })
    return { failed: why }
  }

  const draft = off.draft
  const on = await precheckOnline(page, draft)
  printChecks(on.checks)
  if (!on.ok) {
    const why = on.checks.find((c) => !c.ok)?.reason || '온라인 점검 실패'
    if (/이미 (예약|발행)/.test(why)) { mark(state, 'schedule', true, { note: why, byOtherRun: true }); return { skipped: why } }
    mark(state, 'precheck', false, { reason: why })
    return { failed: why }
  }
  mark(state, 'precheck', true, { reserveBaseline: on.reserveBaseline })

  // 카드 — 파일이 남아 있으면 다시 렌더하지 않는다
  let assets
  const prev = state.steps.images
  if (done(state, 'images') && prev?.files?.every((f) => existsSync(f))) {
    assets = prev.files.map((path) => ({ key: path.replace(/^.*\/\d+-|\.png$/g, ''), path }))
    log(`  · 카드 재사용 ${assets.length}장`)
  } else {
    log('  · 카드 렌더')
    assets = await renderCards(date, { draftFile })
    mark(state, 'images', true, { files: assets.map((a) => a.path) })
  }
  await humanPause(800, 2000)

  // 배치는 "실제로 렌더된 카드 키"로 만들어야 한다. 카드 종류(브리핑 vs 범용)에 따라
  // 키가 다르므로 렌더 뒤에 계산한다.
  const { placements, warnings } = buildLayout(draft, assets.map((a) => a.key))
  if (warnings.length) state.warnings = warnings

  log('  · 에디터 조립')
  const a2 = await assemble(page, { draft, placements, assets })
  mark(state, 'assemble', true, { blocks: a2.blocks, images: a2.images })
  log(`    문단 ${a2.blocks} · 이미지 ${a2.images}`)
  await humanPause(1000, 2500)

  log(`  · 예약 ${slot.date} ${slot.hourValue}:${slot.minuteValue}`)
  const frame = page.frames().find((f) => SEL.frame.test(f.url()))
  const sc = await schedule(page, frame, slot, { confirm: !dry })
  if (!sc.confirmed) { mark(state, 'schedule', false, { reason: '드라이런' }); return { dry: true } }

  state.scheduledFor = `${slot.date} ${slot.hourValue}:${slot.minuteValue}`
  mark(state, 'schedule', true, { reserveAfter: sc.reserveAfter })
  recordPublished(id, { id, date, title: draft.title, scheduledFor: state.scheduledFor, images: a2.images, blocks: a2.blocks, tags: draft.tags })
  return { scheduled: state.scheduledFor, title: draft.title }
}

async function main() {
  const sync = await syncDrafts()
  if (!sync.ok) log(`  ⚠️  초안 동기화 실패 — 로컬 초안으로 진행: ${sync.reason}`)

  if (!DATE) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    DATE = draftsFor(today).length ? today : (latestDraftDate() || today)
  }

  // 그날 초안 중 아직 예약 안 된 것만. 하루 슬롯 수를 넘지 않는다 —
  // 밀린 것까지 몰아 올리면 그 자체가 대량 발행 신호다(스펙 리스크 1).
  const all = draftsFor(DATE)
  const todo = all.filter((f) => !isComplete(load(f.replace(/\.md$/, '')))).slice(0, SLOT_HOURS.length)
  log(`\n■ suzip 발행 — ${DATE}${DRY ? '  (드라이런)' : ''}`)
  log(`  초안 ${all.length}편 중 ${todo.length}편 대상 (하루 슬롯 ${SLOT_HOURS.length}개)\n`)
  if (!todo.length) { log('→ 오늘 처리할 초안이 없다\n'); return }

  const { browser, close } = await connectChrome()
  const page = await newPage(browser)
  await page.setViewport({ width: 1440, height: 950 })

  const results = []
  try {
    // 이미 잡힌 예약 시각을 한 번만 읽어 슬롯 충돌을 피한다
    let taken = []
    try {
      const frame0 = await (await import('./lib/editor.mjs')).openEditor(page)
      await openPublishPanel(frame0)
      taken = await takenSlots(frame0)
      if (taken.length) log(`  이미 예약된 시각: ${taken.join(', ')}`)
    } catch { /* 못 읽으면 빈 배열로 진행 — schedule 단계가 다시 검증한다 */ }

    const slots = nextSlots(new Date(), todo.length, { taken })
    if (slots.length < todo.length) log(`  ⚠ 슬롯 ${slots.length}개뿐 — ${todo.length - slots.length}편은 다음 실행으로`)

    for (let i = 0; i < Math.min(todo.length, slots.length); i++) {
      const f = todo[i]
      log(`\n── [${i + 1}/${slots.length}] ${f}`)
      try {
        results.push({ file: f, ...(await publishOne(browser, f, slots[i], { dry: DRY })) })
      } catch (e) {
        const st = load(f.replace(/\.md$/, ''))
        mark(st, st.steps?.assemble?.ok ? 'schedule' : 'assemble', false, { reason: e.message })
        log(`  ❌ ${e.message}`)
        log(`     (스크린샷은 초안별 탭에서 남기지 않는다 — 탭이 이미 닫혔다)`)
        results.push({ file: f, failed: e.message })
      }
      await humanPause(2000, 5000)
    }
  } finally {
    await close()
  }

  const okCount = results.filter((r) => r.scheduled).length
  const failed = results.filter((r) => r.failed)
  log(`\n■ 결과 — 예약 ${okCount}편 / 건너뜀 ${results.filter((r) => r.skipped).length} / 실패 ${failed.length}`)
  for (const r of results) {
    log(`  ${r.scheduled ? '✅ ' + r.scheduled : r.skipped ? '⏭  ' + r.skipped.slice(0, 40) : r.dry ? '⏸ 드라이런' : '❌ ' + String(r.failed).slice(0, 50)}  ${r.file}`)
  }
  log('')

  if (okCount) await notifyOk(`${DATE} 예약 ${okCount}편 완료`)
  if (failed.length) await notifyFail(`${DATE} 발행 실패 ${failed.length}편 — ${String(failed[0].failed).slice(0, 60)}`)

  const pending = pendingAlert()
  if (pending.length >= 3) {
    log(`  ⚠ 밀린 초안 ${pending.length}편 — 소급 발행은 사람이 판단하세요`)
    await notifyFail(`밀린 초안 ${pending.length}편`)
  }
}

main().catch(async (e) => {
  console.error(`\n치명적 오류: ${e.message}\n`)
  await notifyFail(`${DATE || '날짜 미정'} 발행 오류 — ${e.message.slice(0, 80)}`)
  process.exit(1)
})
