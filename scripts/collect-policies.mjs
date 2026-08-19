// 뉴스에서 부동산 정책을 수집해 블로그 소재 풀을 채운다.
// 사용법: ANTHROPIC_API_KEY=... NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/collect-policies.mjs [--dry]
//
// 왜 필요한가: 정책 카테고리 소재가 public/policies.json 8건뿐이라 5건을 쓴 시점에
// 3건만 남았다. 소재가 마르면 그 카테고리가 통째로 빠지고 하루 발행 편수가 줄어든다.
//
// 왜 policies.json에 직접 넣지 않는가:
//   그 파일은 src/PolicyPage.jsx가 사용자에게 보여준다. 부동산 정책은 사람들이 집을
//   살 때 참고하는 정보라, 뉴스에서 자동 추출한 것을 검수 없이 서비스 페이지에
//   올리면 안 된다. 블로그 소재 풀만 policies-auto.json으로 따로 채운다.
//   서비스에 올릴 만하다고 판단되면 사람이 policies.json으로 옮기면 된다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CURATED = join(ROOT, 'public', 'policies.json')
const AUTO = join(ROOT, 'public', 'policies-auto.json')
const DRY = process.argv.includes('--dry')

const NAVER_NEWS = 'https://openapi.naver.com/v1/search/news.json'
const QUERIES = [
  '부동산 정책 시행', '주택 지원 제도', '전세 대출 정책',
  '청년 주거 지원', '부동산 세제 개편', '주택 공급 대책',
]

// 부동산과 무관한 정책이 세제 기사에 섞여 딸려온다(실측: 병원업 가업상속공제).
// 모델 지시만으로는 새므로 코드로도 거른다.
const REALTY = /주택|부동산|아파트|전세|월세|임대|청약|분양|재개발|재건축|종부세|종합부동산세|양도세|취득세|대출|보증금|주거|임차|집값|LTV|DSR|다주택|1주택/
const isRealty = (p) => REALTY.test(`${p.name} ${p.summary} ${p.detail}`)

const stripHtml = (s) => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .trim()

/** 정책명 비교용 정규화 — 띄어쓰기·조사 차이로 중복을 놓치지 않게 */
export const normName = (s) => String(s || '').replace(/[\s·,()\[\]"']/g, '').toLowerCase()

async function searchNews(query, display = 20) {
  const url = `${NAVER_NEWS}?query=${encodeURIComponent(query)}&display=${display}&sort=date`
  const r = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) return []
  return ((await r.json()).items || []).map((it) => ({
    title: stripHtml(it.title),
    desc: stripHtml(it.description),
    link: it.originallink || it.link,
    date: it.pubDate,
  }))
}

const loadAuto = () => {
  if (!existsSync(AUTO)) return { updatedAt: null, policies: [] }
  try { return JSON.parse(readFileSync(AUTO, 'utf-8')) } catch { return { updatedAt: null, policies: [] } }
}

const loadCurated = () => {
  try { return JSON.parse(readFileSync(CURATED, 'utf-8')).policies || [] } catch { return [] }
}

const PROMPT = (articles, existing) => `아래 뉴스 기사들에서 "부동산 정책"을 추출해줘.

[기사 목록]
${articles.map((a, i) => `${i + 1}. ${a.title}\n   ${a.desc}`).join('\n')}

[이미 있는 정책 — 이것과 같거나 사실상 같은 정책은 제외]
${existing.join('\n') || '(없음)'}

[추출 규칙 — 어기면 쓸모없는 데이터가 된다]
1. "정책·제도"만 뽑는다. 시장 동향("집값이 올랐다"), 전망, 논평은 정책이 아니다.
1-1. 반드시 "주택·부동산"에 직접 관계된 것만. 세제 기사에 섞여 나오는 가업상속공제,
   법인세, 산업 지원처럼 집과 무관한 정책은 제외한다. 이 블로그는 부동산 전용이라
   주제가 어긋난 글은 오히려 해가 된다.
2. 서로 다른 기사 2건 이상에서 언급된 것만 뽑는다. 한 기사에만 나온 건 제외.
3. 기사에 없는 수치·기한·조건을 지어내지 마라. 모르면 쓰지 마라.
4. status는 기사에 근거해서만: "시행중" / "예정" / "논의중" 중 하나.
5. 확실한 것이 없으면 빈 배열을 돌려줘. 억지로 채우지 마라.

[출력 — JSON만. 설명·마크다운 금지]
{"policies":[{"name":"정책명(20자 이내)","summary":"한 줄 요약(40자 이내)","detail":"2~3문장 설명","status":"시행중|예정|논의중","sourceCount":2}]}`

async function extract(articles, existing) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: PROMPT(articles, existing) }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API ${res.status}`)
  const raw = (await res.json()).content?.[0]?.text || ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('JSON을 찾지 못했다')
  return JSON.parse(m[0]).policies || []
}

async function main() {
  if (!process.env.NAVER_CLIENT_ID) { console.error('NAVER_CLIENT_ID 없음'); process.exit(1) }
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY 없음'); process.exit(1) }

  const auto = loadAuto()
  const curated = loadCurated()
  const known = new Set([...curated, ...auto.policies].map((p) => normName(p.name)))

  console.log(`\n■ 정책 수집 (기존 큐레이션 ${curated.length} + 자동 ${auto.policies.length})\n`)

  const seen = new Set()
  const articles = []
  for (const q of QUERIES) {
    for (const a of await searchNews(q)) {
      if (seen.has(a.link)) continue
      seen.add(a.link)
      articles.push(a)
    }
  }
  console.log(`  기사 ${articles.length}건 수집`)
  if (articles.length < 5) { console.log('  기사가 너무 적다 — 중단'); return }

  let found = []
  try { found = await extract(articles.slice(0, 60), [...curated, ...auto.policies].map((p) => p.name)) }
  catch (e) { console.error(`  추출 실패: ${e.message}`); process.exit(1) }

  const fresh = []
  for (const p of found) {
    if (!p?.name || !p?.summary || !p?.detail) { console.log(`  ⚠ 필드 누락으로 제외: ${p?.name}`); continue }
    // 규칙 2를 모델이 어길 수 있으니 코드로도 막는다
    if ((p.sourceCount ?? 0) < 2) { console.log(`  ⚠ 출처 1건뿐이라 제외: ${p.name}`); continue }
    if (!isRealty(p)) { console.log(`  ⚠ 부동산과 무관해 제외: ${p.name}`); continue }
    if (known.has(normName(p.name))) { console.log(`  · 중복 제외: ${p.name}`); continue }
    known.add(normName(p.name))
    fresh.push({ ...p, collectedAt: new Date().toISOString().slice(0, 10), source: 'auto' })
  }

  console.log(`\n  신규 ${fresh.length}건`)
  fresh.forEach((p) => console.log(`  ✅ ${p.name} (${p.status}) — ${p.summary}`))

  if (!fresh.length) { console.log('\n추가할 것이 없다\n'); return }

  auto.policies.push(...fresh)
  auto.updatedAt = new Date().toISOString().slice(0, 10)
  if (DRY) { console.log('\n(--dry: 저장하지 않음)\n'); return }
  writeFileSync(AUTO, JSON.stringify(auto, null, 2))
  console.log(`\n저장: public/policies-auto.json (총 ${auto.policies.length}건)\n`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message); process.exit(1) })
}
