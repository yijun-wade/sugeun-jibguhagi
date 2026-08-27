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
import { stripTags, findOurRank, isDue, currentCheckpoint, exposureRate, CHECKPOINTS } from './publish/lib/rank.mjs'

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
  const d = await r.json()
  return { items: d.items || [], total: d.total || 0 }
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
    let titleRank = null, kwRank = null, keyword = null, competitors = 0
    try {
      const res = await searchBlog(p.title)
      titleRank = findOurRank(res.items, BLOG_ID)
      competitors = res.total
    } catch (e) {
      console.log(`  ⚠ ${p.title.slice(0, 24)} — 제목 검색 실패: ${e.message}`)
      continue
    }
    await sleep(300) // API 예의

    // 2) 대표 키워드 — 우리가 노린 검색어에서 몇 위인가
    const rec = records.find((r) => normalizeTitle(r.title) === normalizeTitle(p.title))
    keyword = rec?.tags?.[0] || null
    if (keyword) {
      try { kwRank = findOurRank((await searchBlog(keyword)).items, BLOG_ID) } catch { /* 키워드 실패는 치명적이지 않다 */ }
      await sleep(300)
    }

    // 경쟁 문서 수를 함께 남긴다. 이게 없으면 "30위 밖"이 저품질 때문인지
    // 그냥 일반적인 제목이라 그런지 구분할 수 없다.
    entry.checks.push({ day, at: now.toISOString(), titleRank, competitors, keyword, kwRank })
    log.entries[key] = entry
    checked++

    const mark = titleRank === null
      ? `— 30위 밖 (경쟁 ${competitors.toLocaleString()}건)`
      : `✅ 제목 ${titleRank}위 (경쟁 ${competitors.toLocaleString()}건)`
    const kw = keyword ? ` / "${keyword}" ${kwRank === null ? `${DISPLAY}위 밖` : `${kwRank}위`}` : ''
    console.log(`  D+${String(day).padEnd(2)} ${mark}${kw}  ${stripTags(p.title).slice(0, 30)}`)
  }

  if (!checked) console.log('  오늘 확인할 글이 없다 (체크포인트 D+1·3·7·14)')

  // ── 색인률 요약 ─────────────────────────────────────────────
  const entries = Object.values(log.entries)
  console.log('\n■ 노출률 (자기 제목 검색 30위 이내)')
  for (const d of CHECKPOINTS) {
    const r = exposureRate(entries, d)
    if (!r) continue
    console.log(`  D+${String(d).padEnd(2)} 전체 ${String(Math.round(r.rate * 100)).padStart(3)}% (${r.shown}/${r.checked})` +
      (r.easyRate !== null ? `   경쟁 20건 이하 ${Math.round(r.easyRate * 100)}% (${r.easyShown}/${r.easyChecked})` : ''))
    // 경쟁이 적은데도 밀리는 것이 진짜 위험 신호다. 일반적인 제목이 30위 밖인 건
    // 뉴스 기사와 경쟁해서 그런 것이라 정상이다.
    if (r.easyChecked >= 4 && r.easyRate < 0.5) {
      console.log(`       ⚠ 경쟁이 적은 글도 밀린다 — 계정 노출 제한을 의심할 것`)
    }
  }
  console.log('\n  ※ "30위 밖"은 미색인이 아니라 순위다. 제목이 일반적이면 뉴스와 경쟁해 밀린다.')

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
