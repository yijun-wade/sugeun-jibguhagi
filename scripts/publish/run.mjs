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
import { nextSlot } from './lib/slot.mjs'
import { load, save, mark, done, isComplete } from './lib/state.mjs'
import { notifyFail, notifyOk } from './lib/notify.mjs'
import { connectChrome, newPage } from './lib/chrome.mjs'
import { SEL, humanPause } from './lib/editor.mjs'
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
  const dates = readdirSync(dir)
    .map((f) => (f.match(/^(\d{4}-\d{2}-\d{2})-부동산브리핑\.md$/) || [])[1])
    .filter(Boolean)
    .filter((d) => d < DATE)
    .sort()
    .slice(-14)
  const pending = dates.filter((d) => !isComplete(load(d)))
  return pending
}

function recordPublished(date, info) {
  const dir = join(process.cwd(), 'published')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${date}.json`), JSON.stringify(info, null, 2))
}

async function main() {
  const sync = await syncDrafts()
  if (!sync.ok) log(`  ⚠️  초안 동기화 실패 — 로컬 초안으로 진행: ${sync.reason}`)

  // 날짜를 지정하지 않았으면 오늘 것을 쓰되, 아직 안 만들어졌으면 가장 최근 초안을 쓴다.
  // GitHub Actions는 07:00 KST에 도는데 08:30 슬롯이 그보다 빠를 수도, 워크플로가
  // 하루 밀릴 수도 있다. 그때마다 "초안 없음"으로 종료하면 매일 빈다.
  if (!DATE) {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
    DATE = existsSync(draftPath(today)) ? today : (latestDraftDate() || today)
  }
  log(`\n■ suzip 발행 — ${DATE}${DRY ? '  (드라이런)' : ''}\n`)

  const state = load(DATE)
  state.draft = `blog-posts/${DATE}-부동산브리핑.md`

  // ── STEP 0 사전 점검 (오프라인) ─────────────────────────────
  const off = await precheckOffline(DATE, state)
  printChecks(off.checks)
  if (!off.ok) {
    const why = off.checks.find((c) => !c.ok)?.reason || '사전 점검 실패'
    // 이미 끝난 건은 실패가 아니다. 알림을 울리지 않고, 완료로 표시한다 —
    // 미완료로 두면 "밀린 초안" 경보가 이 글을 영영 센다. 거짓 경보가 쌓이면
    // 진짜 경보를 무시하게 된다.
    if (/이미 (예약|발행)/.test(why)) {
      mark(state, 'schedule', true, { note: why, byOtherRun: true })
      log(`\n→ 건너뜀: ${why}\n`)
      return
    }
    mark(state, 'precheck', false, { reason: why })
    await notifyFail(`${DATE} 발행 중단 — ${why}`)
    log(`\n→ 차단됨. 글을 만들지 않고 종료.\n`)
    return
  }
  const draft = off.draft
  const { placements, warnings } = buildLayout(draft)
  if (warnings.length) state.warnings = warnings

  const { browser, close } = await connectChrome()
  const page = await newPage(browser)
  await page.setViewport({ width: 1440, height: 950 })

  try {
    // ── STEP 0 사전 점검 (온라인) ───────────────────────────────
    const on = await precheckOnline(page, draft)
    printChecks(on.checks)
    if (!on.ok) {
      const why = on.checks.find((c) => !c.ok)?.reason || '온라인 점검 실패'
      if (/이미 (예약|발행)/.test(why)) {
        mark(state, 'schedule', true, { note: why, byOtherRun: true })
        log(`\n→ 건너뜀: ${why}\n`)
        return
      }
      mark(state, 'precheck', false, { reason: why })
      await notifyFail(`${DATE} 발행 중단 — ${why}`)
      return
    }
    mark(state, 'precheck', true, { reserveBaseline: on.reserveBaseline })

    // ── STEP 1 카드 렌더 (재개 가능) ────────────────────────────
    let assets
    const prev = state.steps.images
    if (done(state, 'images') && prev?.files?.every((f) => existsSync(f))) {
      assets = prev.files.map((path) => ({ key: path.replace(/^.*\/\d+-|\.png$/g, ''), path }))
      log(`\n  · 카드 재사용 ${assets.length}장`)
    } else {
      log('\n  · 카드 렌더')
      assets = await renderCards(DATE)
      mark(state, 'images', true, { files: assets.map((a) => a.path) })
    }
    await humanPause(800, 2000)

    // ── STEP 2 조립 ─────────────────────────────────────────────
    // 조립은 재개하지 않는다. 에디터 상태를 신뢰할 수 없어서, 예약이 안 끝났으면
    // 처음부터 다시 채우는 편이 안전하다(임시저장이 하나 더 생기는 정도의 비용).
    log('  · 에디터 조립')
    const a = await assemble(page, { draft, placements, assets })
    mark(state, 'assemble', true, { blocks: a.blocks, images: a.images })
    log(`    문단 ${a.blocks} · 이미지 ${a.images}`)
    await humanPause(1000, 2500)

    // ── STEP 3 예약 등록 ────────────────────────────────────────
    const slot = nextSlot(new Date())
    log(`  · 예약 ${slot.date} ${slot.hourValue}:${slot.minuteValue} (${slot.sameDay ? '당일' : '익일'})`)
    const frame = page.frames().find((f) => SEL.frame.test(f.url()))
    const s = await schedule(page, frame, slot, { confirm: !DRY })

    if (!s.confirmed) {
      log(`\n⏸ ${s.note}\n`)
      mark(state, 'schedule', false, { reason: '드라이런' })
      return
    }

    state.scheduledFor = `${slot.date} ${slot.hourValue}:${slot.minuteValue}`
    mark(state, 'schedule', true, { at: new Date().toISOString(), reserveAfter: s.reserveAfter })
    recordPublished(DATE, {
      date: DATE,
      title: draft.title,
      scheduledFor: state.scheduledFor,
      images: a.images,
      blocks: a.blocks,
      tags: draft.tags,
    })
    log(`\n✅ 예약 완료 — ${state.scheduledFor} (예약 ${s.reserveAfter}건)\n`)
    await notifyOk(`${DATE} 예약 완료 — ${state.scheduledFor}`)

    const pending = pendingAlert()
    if (pending.length >= 3) {
      log(`  ⚠ 밀린 초안 ${pending.length}편: ${pending.join(', ')}`)
      await notifyFail(`밀린 초안 ${pending.length}편 — 소급 발행은 사람이 판단하세요`)
    }
  } catch (e) {
    mark(state, state.steps.assemble?.ok ? 'schedule' : 'assemble', false, { reason: e.message })
    save(state)
    log(`\n❌ 실패: ${e.message}\n`)
    await page.screenshot({ path: `.publish-assets/fail-${DATE}.png` }).catch(() => {})
    await notifyFail(`${DATE} 발행 실패 — ${e.message.slice(0, 80)}`)
    process.exitCode = 1
  } finally {
    save(state)
    await close()
  }
}

main().catch(async (e) => {
  console.error(`\n치명적 오류: ${e.message}\n`)
  await notifyFail(`${DATE || '날짜 미정'} 발행 오류 — ${e.message.slice(0, 80)}`)
  process.exit(1)
})
