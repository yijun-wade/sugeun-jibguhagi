// 수근수근 요약 사전 생성 — public/vibe/{kaptCode}.json (클라이언트용) + public/apt-vibe.json (프리렌더용)
//
// 사용법 (NAVER_CLIENT_ID · NAVER_CLIENT_SECRET · ANTHROPIC_API_KEY 필요)
//   node scripts/build-apt-vibe.mjs --type=rental          공공임대·청년주택 전부
//   node scripts/build-apt-vibe.mjs --top=300              가격 데이터가 있는 단지 중 세대수 상위 300
//   node scripts/build-apt-vibe.mjs --codes=A10023118,...  지정 단지
//   node scripts/build-apt-vibe.mjs --all                  서울 전 단지 (약 3,300곳 · Haiku 약 $15 · 네이버 1.7만 콜)
//   공통: --max=50 (이번 실행 상한) --force (30일 안 된 것도 다시) --dry (대상만 출력)
//
// 왜: 요약은 방문마다 새로 만들어 5~6초 뒤에 떴고(평균 세션 15~27초), 크롤러에는 보이지 않았다.
// 미리 만들어 정적 파일로 두면 첫 화면에 바로 뜨고 프리렌더 HTML에도 실린다. 함수는 12개 한도라
// 저장소를 새로 붙이는 대신 정적 파일로 둔다.
//
// 운영과 키를 같이 쓴다(네이버 검색 일 25,000콜, 초당 10콜). 한 번에 한 단지씩 돈다.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { generateVibe, callClaude, BATCH_MODEL } from '../api/_vibe-core.js'
import { isRentalName } from '../api/_apt-type.js'

const arg = (k) => { const a = process.argv.find(x => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.split('=')[1] ?? true) : null }
for (const k of ['NAVER_CLIENT_ID', 'NAVER_CLIENT_SECRET', 'ANTHROPIC_API_KEY']) {
  if (!process.env[k] && !arg('dry')) { console.error(`${k} 없음`); process.exit(1) }
}

const PUB = join(process.cwd(), 'public')
const OUT_DIR = join(PUB, 'vibe')
const COMBINED = join(PUB, 'apt-vibe.json')
const FRESH_DAYS = 30
const GAP_MS = 400
// --model=claude-sonnet-5 처럼 바꿀 수 있다. 기본은 BATCH_MODEL(_vibe-core.js).
const MODEL = arg('model') || process.env.VIBE_BATCH_MODEL || BATCH_MODEL
const usage = { in: 0, out: 0 }
const load = (f, fb) => { try { return JSON.parse(readFileSync(join(PUB, f), 'utf8')) } catch { return fb } }

const seoul = load('seoul-apt-enriched.json', [])
const types = load('apt-types.json', {})
const prices = load('apt-prices.json', {})
const isRental = a => types[a.kaptCode] === 'rental' || (!types[a.kaptCode] && isRentalName(a.kaptName))

function pickTargets() {
  if (arg('codes')) { const set = new Set(String(arg('codes')).split(',')); return seoul.filter(a => set.has(a.kaptCode)) }
  if (arg('all')) return seoul
  const out = new Map()
  if (arg('type') === 'rental') seoul.filter(isRental).forEach(a => out.set(a.kaptCode, a))
  if (arg('top')) {
    seoul.filter(a => prices[a.kaptCode]).sort((x, y) => (y.kaptdaCnt || 0) - (x.kaptdaCnt || 0))
      .slice(0, Number(arg('top'))).forEach(a => out.set(a.kaptCode, a))
  }
  if (out.size === 0) { console.error('대상을 고르세요: --type=rental | --top=N | --codes=... | --all'); process.exit(1) }
  return [...out.values()]
}

const isFresh = (code) => {
  if (arg('force')) return false
  const f = join(OUT_DIR, `${code}.json`)
  if (!existsSync(f)) return false
  try { return (Date.now() - new Date(JSON.parse(readFileSync(f, 'utf8')).generatedAt).getTime()) < FRESH_DAYS * 864e5 } catch { return false }
}

const max = Number(arg('max')) || Infinity
const targets = pickTargets().filter(a => !isFresh(a.kaptCode)).slice(0, max)
console.log(`생성 대상 ${targets.length}곳 · 모델 ${MODEL}${arg('dry') ? ' (dry)' : ''}`)
if (arg('dry')) { targets.slice(0, 30).forEach(a => console.log(' ', a.kaptCode, a.kaptName, a.sigungu, a.dong)); process.exit(0) }

mkdirSync(OUT_DIR, { recursive: true })
let ok = 0, empty = 0, fail = 0
for (const [i, a] of targets.entries()) {
  try {
    const r = await generateVibe({ aptName: a.kaptName, location: a.dong, gu: a.sigungu, aptType: isRental(a) ? 'rental' : undefined }, { model: MODEL })
    if (!r.empty && callClaude.lastUsage) { usage.in += callClaude.lastUsage.input_tokens || 0; usage.out += callClaude.lastUsage.output_tokens || 0 }
    const doc = { kaptCode: a.kaptCode, aptNm: a.kaptName, generatedAt: new Date().toISOString(), model: MODEL, ...r }
    writeFileSync(join(OUT_DIR, `${a.kaptCode}.json`), JSON.stringify(doc))
    r.empty ? empty++ : ok++
  } catch (e) {
    fail++
    console.error(`  실패 ${a.kaptCode} ${a.kaptName}: ${e.message}`)
    // 인증·한도 오류는 계속 돌아봐야 같은 오류다.
    if (e.status === 401 || e.status === 403 || e.status === 429) { console.error('  중단 — 키·한도 확인'); break }
  }
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${targets.length} · 요약 ${ok} · 글 부족 ${empty} · 실패 ${fail}`)
  await new Promise(r => setTimeout(r, GAP_MS))
}

// 프리렌더용 합본 — 서버리스 함수는 파일명을 동적으로 읽으면 번들에 안 실린다. 고정 경로 하나로 묶는다.
const combined = {}
for (const f of readdirSync(OUT_DIR)) {
  if (!f.endsWith('.json')) continue
  try {
    const d = JSON.parse(readFileSync(join(OUT_DIR, f), 'utf8'))
    if (d.empty) continue
    combined[d.kaptCode] = { s: d.summary, c: d.categories.filter(c => c.lines.length), l: d.links, t: d.generatedAt.slice(0, 10) }
  } catch { /* 깨진 파일은 건너뜀 */ }
}
writeFileSync(COMBINED, JSON.stringify(combined))
console.log(`모델 ${MODEL} · 입력 ${usage.in.toLocaleString()} · 출력 ${usage.out.toLocaleString()} 토큰`)
console.log(`완료 · 요약 ${ok} · 글 부족 ${empty} · 실패 ${fail} · 합본 ${Object.keys(combined).length}곳`)
