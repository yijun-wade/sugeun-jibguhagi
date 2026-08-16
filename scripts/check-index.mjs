// 발행 글의 색인·순위 추적 (스펙 STEP 6).
// 사용법: NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/check-index.mjs [--dry]
//
// 왜 만드나: 스펙의 성공 기준 5개 중 4개는 코드가 판정하는데, 마지막 하나
// "2주 뒤 색인률이 수동 시절 대비 유지되는가"만 측정 수단이 없었다.
// 네이버 저품질 판정에 대한 유일한 방어선이다 — 노출이 꺾이는 걸 모르면
// 계속 발행하다가 계정을 태운다.
//
// 두 가지를 본다:
//   1) 제목 검색에 우리 글이 잡히는가 = 색인 여부 (약하지만 확실한 신호)
//   2) 대표 키워드 검색에서 몇 위인가 = 실제 유입 가능성 (강한 신호)
//
// 브라우저가 필요 없어 GitHub Actions에서 돌 수 있다.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fetchPublished, normalizeDate, normalizeTitle } from './publish/lib/published.mjs'
import { stripTags, findOurRank, isDue, currentCheckpoint, indexRate, CHECKPOINTS } from './publish/lib/rank.mjs'

const BLOG_ID = 'kaimex'
const DRY = process.argv.includes('--dry')
const LOG_PATH = join(process.cwd(), 'published', 'index-log.json')
const DISPLAY = 30 // 상위 30위까지만 본다. 그 아래는 유입이 거의 없다.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function searchBlog(query) {
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${DISPLAY}&sort=sim`
  const r = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) throw new Error(`검색 실패 HTTP ${r.status}`)
  return (await r.json()).items || []
}

const loadLog = () => {
  if (!existsSync(LOG_PATH)) return { updatedAt: null, entries: {} }
  try { return JSON.parse(readFileSync(LOG_PATH, 'utf-8')) }
  catch { return { updatedAt: null, entries: {} } }
}

/** 우리가 만든 글의 태그 — published/*.json 기록에서 제목으로 매칭 */
function tagIndex() {
  const dir = join(process.cwd(), 'published')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.json$/.test(f))
    .map((f) => { try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')) } catch { return null } })
    .filter(Boolean)
}

async function main() {
  if (!process.env.NAVER_CLIENT_ID) { console.error('NAVER_CLIENT_ID 없음'); process.exit(1) }

  const now = new Date()
  const log = loadLog()
  const records = tagIndex()
  const posts = await fetchPublished(BLOG_ID, 30)

  console.log(`\n■ 색인·순위 추적 (${posts.length}편 조회)\n`)

  let checked = 0
  for (const p of posts) {
    const date = normalizeDate(p.addDate)
    if (!date) continue
    const key = p.logNo
    const entry = log.entries[key] || { logNo: key, title: p.title, publishedAt: date, checks: [] }

    if (!isDue(date, entry.checks, now)) continue
    const day = currentCheckpoint(date, now)

    // 1) 제목 검색 — 색인 여부
    let titleRank = null, kwRank = null, keyword = null
    try {
      titleRank = findOurRank(await searchBlog(p.title), BLOG_ID)
    } catch (e) {
      console.log(`  ⚠ ${p.title.slice(0, 24)} — 제목 검색 실패: ${e.message}`)
      continue
    }
    await sleep(300) // API 예의

    // 2) 대표 키워드 — 우리가 노린 검색어에서 몇 위인가
    const rec = records.find((r) => normalizeTitle(r.title) === normalizeTitle(p.title))
    keyword = rec?.tags?.[0] || null
    if (keyword) {
      try { kwRank = findOurRank(await searchBlog(keyword), BLOG_ID) } catch { /* 키워드 실패는 치명적이지 않다 */ }
      await sleep(300)
    }

    entry.checks.push({ day, at: now.toISOString(), titleRank, keyword, kwRank })
    log.entries[key] = entry
    checked++

    const mark = titleRank === null ? '❌ 미색인' : `✅ 제목 ${titleRank}위`
    const kw = keyword ? ` / "${keyword}" ${kwRank === null ? `${DISPLAY}위 밖` : `${kwRank}위`}` : ''
    console.log(`  D+${String(day).padEnd(2)} ${mark}${kw}  ${stripTags(p.title).slice(0, 30)}`)
  }

  if (!checked) console.log('  오늘 확인할 글이 없다 (체크포인트 D+1·3·7·14)')

  // ── 색인률 요약 ─────────────────────────────────────────────
  const entries = Object.values(log.entries)
  console.log('\n■ 색인률')
  for (const d of CHECKPOINTS) {
    const r = indexRate(entries, d)
    if (!r) continue
    const pct = Math.round(r.rate * 100)
    console.log(`  D+${String(d).padEnd(2)} ${String(pct).padStart(3)}%  (${r.indexed}/${r.checked}편)`)
    // 표본이 쌓인 뒤에도 절반을 밑돌면 발행량을 줄여야 한다는 신호다
    if (r.checked >= 5 && r.rate < 0.5) console.log(`       ⚠ 색인률이 낮다 — 발행 편수를 줄이는 것을 검토할 것`)
  }

  log.updatedAt = now.toISOString()
  if (!DRY) {
    mkdirSync(join(process.cwd(), 'published'), { recursive: true })
    writeFileSync(LOG_PATH, JSON.stringify(log, null, 2))
    console.log(`\n기록: published/index-log.json (${entries.length}편)\n`)
  } else {
    console.log('\n(--dry: 저장하지 않음)\n')
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
