// 실거래가 API 기반 검색 인덱스 보강
//
// 문제: public/apt-list.json은 K-apt(공동주택관리정보시스템) 목록이라
//       150세대 이상 의무관리대상만 들어있음. 소규모 주상복합·도시형생활주택이
//       통째로 빠져서, 실거래는 있는데 검색은 안 되는 단지가 자치구당 30~50%.
//       (예: 여의휴젠느 — 영등포동7가, 2018년 준공, 실거래 3건/2026년)
//
// 해결: 아파트 매매 실거래가 API를 전 시군구 × N개월 훑어서 단지명을 모으고,
//       기존 인덱스에 없는 것만 public/apt-list-extra.json 으로 뽑는다.
//       실거래가 발생한 단지는 정의상 100% 잡힌다.
//
// 사용법:
//   MOLIT_API_KEY=xxx node scripts/build-trade-index.mjs                     # 전국 36개월
//   MOLIT_API_KEY=xxx node scripts/build-trade-index.mjs --region=서울 --months=12
//   MOLIT_API_KEY=xxx node scripts/build-trade-index.mjs --dry-run           # 파일 안 쓰고 리포트만
//
// 옵션:
//   --months=N       조회 개월 수 (기본 36)
//   --region=서울     시도명 prefix 필터 (기본 전국)
//   --concurrency=N  동시 요청 수 (기본 5)
//   --no-cache       캐시 무시하고 전부 재조회
//   --dry-run        파일 쓰지 않음
//
// 출력: public/apt-list-extra.json
// 캐시: .cache/trade-index/{lawdCd}-{ym}.json  (재실행 시 재사용 — 중단돼도 이어서 진행)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { nameSim } from '../src/utils.js'

const KEY = process.env.MOLIT_API_KEY
if (!KEY) { console.error('MOLIT_API_KEY 환경변수 필요'); process.exit(1) }

// ── 인자 파싱 ──────────────────────────────
const argv = process.argv.slice(2)
const arg = (name, dflt) => {
  const hit = argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : dflt
}
const MONTHS = parseInt(arg('months', '36'))
const REGION = arg('region', '')
const CONCURRENCY = parseInt(arg('concurrency', '5'))
const USE_CACHE = !argv.includes('--no-cache')
const DRY_RUN = argv.includes('--dry-run')

const CACHE_DIR = join(process.cwd(), '.cache', 'trade-index')
if (USE_CACHE) mkdirSync(CACHE_DIR, { recursive: true })

// ── 기존 인덱스에서 지역 메타 추출 ──────────────
// apt-list.json 한 건: { kaptCode, kaptName, bjdCode, addr: "서울특별시 영등포구 여의도동" }
const aptList = JSON.parse(readFileSync(join(process.cwd(), 'public/apt-list.json'), 'utf-8'))

const sggName = new Map()   // "11560" → "서울특별시 영등포구"
const dongCode = new Map()  // "11560|여의도동" → "1156011000"
const byDong = new Map()    // "11560|여의도동" → [기존 단지명...]
const bySgg = new Map()     // "11560" → [기존 단지명...]  (동 표기가 어긋날 때의 2차 방어선)

for (const a of aptList) {
  if (!a.bjdCode || !a.addr) continue
  const sgg = String(a.bjdCode).slice(0, 5)
  const parts = a.addr.split(' ')
  const sido = parts[0] || ''
  const gu = parts[1] || ''
  const dong = parts.find(p => /[동읍면가]$/.test(p)) || ''

  if (!sggName.has(sgg) && sido && gu) sggName.set(sgg, `${sido} ${gu}`)
  const dkey = `${sgg}|${dong}`
  if (dong && !dongCode.has(dkey)) dongCode.set(dkey, String(a.bjdCode))
  if (!byDong.has(dkey)) byDong.set(dkey, [])
  byDong.get(dkey).push(a.kaptName || '')
  if (!bySgg.has(sgg)) bySgg.set(sgg, [])
  bySgg.get(sgg).push(a.kaptName || '')
}

// 조회 대상 시군구 = 기존 인덱스에 등장하는 전 시군구 (REGION으로 필터)
const lawdCds = [...sggName.keys()]
  .filter(cd => !REGION || (sggName.get(cd) || '').startsWith(REGION))
  .sort()

if (!lawdCds.length) {
  console.error(`대상 시군구 0개 — --region=${REGION} 확인 필요`)
  process.exit(1)
}

// ── 조회 기간 ──────────────────────────────
function recentYms(n) {
  const out = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
const ymList = recentYms(MONTHS)

// ── API 호출 ───────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))
const BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'

let apiCalls = 0
let cacheHits = 0
const failures = []

// 한 페이지 조회. 실패 시 null (에러와 '데이터 없음'을 구분해서 캐시 오염 방지)
async function fetchPage(lawdCd, ym, pageNo) {
  const url = `${BASE}?serviceKey=${KEY}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}` +
    `&numOfRows=1000&pageNo=${pageNo}&_type=json`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      apiCalls++
      const res = await fetch(url)
      const text = await res.text()
      // 오류 시 XML로 떨어짐 (SERVICE_KEY_IS_NOT_REGISTERED_ERROR 등)
      if (text.trimStart().startsWith('<')) {
        const msg = (text.match(/<errMsg>([^<]*)</) || [])[1] || `HTTP ${res.status}`
        if (/LIMITED_NUMBER|BUSY|TIMEOUT/i.test(msg)) { await sleep(1500 * (attempt + 1)); continue }
        return { error: msg }
      }
      const data = JSON.parse(text)
      const body = data?.response?.body
      const raw = body?.items?.item
      const items = !raw ? [] : (Array.isArray(raw) ? raw : [raw])
      return { items, totalCount: parseInt(body?.totalCount || items.length) }
    } catch (e) {
      if (attempt === 2) return { error: e.message }
      await sleep(1000 * (attempt + 1))
    }
  }
  return { error: 'retry exhausted' }
}

// (시군구, 월) 단위 전량 조회 — 1000건 넘으면 페이징
async function fetchMonth(lawdCd, ym) {
  const cacheFile = join(CACHE_DIR, `${lawdCd}-${ym}.json`)
  if (USE_CACHE && existsSync(cacheFile)) {
    try { cacheHits++; return JSON.parse(readFileSync(cacheFile, 'utf-8')) } catch { /* 깨진 캐시는 재조회 */ }
  }

  const first = await fetchPage(lawdCd, ym, 1)
  if (first.error) { failures.push({ lawdCd, ym, error: first.error }); return [] }

  let items = first.items
  const pages = Math.ceil((first.totalCount || 0) / 1000)
  for (let p = 2; p <= pages; p++) {
    const next = await fetchPage(lawdCd, ym, p)
    if (next.error) { failures.push({ lawdCd, ym, page: p, error: next.error }); break }
    items = items.concat(next.items)
  }

  // 인덱스 구축에 필요한 필드만 남겨 캐시 용량 절감
  const slim = items.map(i => ({
    aptNm: String(i.aptNm || '').trim(),
    umdNm: String(i.umdNm || '').trim(),
    jibun: String(i.jibun || '').trim(),
    buildYear: i.buildYear || null,
    ym,
  })).filter(i => i.aptNm && i.umdNm)

  if (USE_CACHE) { try { writeFileSync(cacheFile, JSON.stringify(slim)) } catch { /* 캐시 실패는 무시 */ } }
  return slim
}

// ── 수집 ───────────────────────────────────
const jobs = []
for (const lawdCd of lawdCds) for (const ym of ymList) jobs.push({ lawdCd, ym })

console.log(`대상: ${lawdCds.length}개 시군구 × ${MONTHS}개월 = ${jobs.length}회 조회` +
  `${REGION ? ` (지역: ${REGION})` : ''}${USE_CACHE ? ' · 캐시 사용' : ''}`)

const complexes = new Map()  // "sgg|dong|정규화명" → 단지 정보
const startedAt = Date.now()
let done = 0

function record(lawdCd, items) {
  for (const it of items) {
    const key = `${lawdCd}|${it.umdNm}|${it.aptNm.replace(/\s+/g, '')}`
    let c = complexes.get(key)
    if (!c) {
      c = {
        sggCd: lawdCd, umdNm: it.umdNm, aptNm: it.aptNm,
        jibun: it.jibun, buildYear: it.buildYear,
        dealCount: 0, lastYm: it.ym,
      }
      complexes.set(key, c)
    }
    c.dealCount++
    if (it.ym > c.lastYm) c.lastYm = it.ym
    if (!c.buildYear && it.buildYear) c.buildYear = it.buildYear
    if (!c.jibun && it.jibun) c.jibun = it.jibun
  }
}

// 고정 크기 워커 풀
let cursor = 0
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++]
    const items = await fetchMonth(job.lawdCd, job.ym)
    record(job.lawdCd, items)
    done++
    if (done % 25 === 0 || done === jobs.length) {
      const pct = (done / jobs.length * 100).toFixed(1)
      const elapsed = (Date.now() - startedAt) / 1000
      const eta = done ? Math.round(elapsed / done * (jobs.length - done)) : 0
      process.stdout.write(
        `\r  ${done}/${jobs.length} (${pct}%) · 단지 ${complexes.size} · ` +
        `API ${apiCalls} · 캐시 ${cacheHits} · 남은시간 ~${Math.floor(eta / 60)}분${String(eta % 60).padStart(2, '0')}초   `
      )
    }
    await sleep(120)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
console.log(`\n실거래 단지 수집 완료: ${complexes.size}개`)
if (failures.length) console.warn(`  ⚠ 조회 실패 ${failures.length}건 (예: ${JSON.stringify(failures[0])})`)

// ── 이름 대조 ──────────────────────────────
// 실거래 표기와 K-apt 표기가 자주 어긋난다:
//   상계주공1(고층)   ↔ 상계주공1단지     — 괄호 부기 + 단지 표기 유무
//   에스케이북한산시티 ↔ SK북한산시티아파트 — 영문/한글 브랜드 표기
//   여의도삼익        ↔ 삼익              — 지역 prefix 유무
// 그대로 nameSim만 쓰면 이런 게 전부 '신규'로 잡혀 중복이 쌓인다.
// 그래서 (1) 괄호 제거 (2) 숫자 집합 일치 강제 (3) 브랜드 표기 통일 후 비교.

const BRAND_ALIASES = [
  ['SK', '에스케이'], ['LG', '엘지'], ['GS', '지에스'], ['KCC', '케이씨씨'],
  ['CJ', '씨제이'], ['LH', '엘에이치'], ['SH', '에스에이치'], ['KT', '케이티'],
  ['e편한세상', '이편한세상'], ['I-PARK', '아이파크'], ['IPARK', '아이파크'],
]

// 괄호 안은 단지 구분과 무관한 부기(고층·임대·101동·1101-1)일 때만 버린다.
// 별칭이 들어있는 경우(가양3단지(강변))는 그게 실거래 표기와 이어주는 유일한 단서라 남긴다.
const PAREN_NOISE = /^(고층|저층|중층|임대|분양|일반|공공|국민|영구|주상복합|도시형|오피스텔|[\d\-.,~\s]*[동호]?[\d\-.,~\s]*)$/
function baseName(s) {
  let v = String(s || '')
    .replace(/[（(]([^)）]*)[)）]/g, (_, inner) => PAREN_NOISE.test(inner.trim()) ? '' : inner)
    .replace(/\s+/g, '')
    .replace(/(아파트|APT|맨션)$/i, '')
  for (const [en, ko] of BRAND_ALIASES) v = v.replace(new RegExp(en, 'gi'), ko)
  return v
}
// 단지·차 번호는 숫자 집합으로 비교 — "1단지"·"1차"·"1" 표기 차이를 흡수하되
// 1단지와 2단지가 섞이는 건 막는다.
const digitSet = s => (baseName(s).match(/\d+/g) || [])
// 숫자·단지·차를 걷어낸 뼈대 (상계주공1단지 → 상계주공)
const skeleton = s => baseName(s).replace(/\d+/g, '').replace(/(단지|차)/g, '')

function samePair(tradeNm, indexNm) {
  const da = digitSet(tradeNm), db = digitSet(indexNm)
  const a = skeleton(tradeNm), b = skeleton(indexNm)
  if (!a || !b) return false

  if (da.length && db.length) {
    // 양쪽 다 번호가 있으면 겹쳐야 한다.
    // K-apt는 여러 단지를 한 줄에 묶어 쓰기도 해서(쌍문한양2,3,4차) 교집합으로 본다.
    if (!da.some(n => db.includes(n))) return false
  } else if (da.length || db.length) {
    // 한쪽만 번호가 있으면(고덕아남 ↔ 아남1) 뼈대가 정확히 같을 때만 같은 단지로 본다
    return a === b
  }

  if (a === b) return true
  // 지역 prefix 유무 (삼익 ⊂ 여의도삼익). 2글자 이하는 우연 일치가 많아 제외.
  const shorter = a.length <= b.length ? a : b
  if (shorter.length >= 3 && (a.includes(b) || b.includes(a))) return true
  return nameSim(a, b) >= 0.6
}

// 실거래는 지역명을 떼고 쓰는 일이 잦다 (중계동 "주공2" ↔ K-apt "중계주공2단지").
// 뼈대가 2글자면 포함 비교를 막아둔 탓에 놓치므로, 동·구 이름을 붙인 변형도 함께 본다.
const stem = s => String(s || '').replace(/\d+가$/, '').replace(/[동읍면리가구시군]$/, '')

function sameComplex(tradeNm, indexNm, dong, gu) {
  const variants = [tradeNm, `${stem(dong)}${tradeNm}`, `${stem(gu)}${tradeNm}`]
  return variants.some(v => samePair(v, indexNm))
}

// ── 기존 인덱스와 대조 ──────────────────────
// 같은 동 안에서 먼저 찾고, 못 찾으면 같은 시군구 전체를 한 번 더 훑는다
// (실거래 "영등포동7가" vs K-apt "영등포동" 처럼 동 표기가 어긋나는 경우 대비).
const extras = []
let matchedDong = 0, matchedSgg = 0

for (const c of complexes.values()) {
  const guFull = (sggName.get(c.sggCd) || '').split(' ')[1] || ''

  const dongPool = byDong.get(`${c.sggCd}|${c.umdNm}`) || []
  if (dongPool.some(n => sameComplex(c.aptNm, n, c.umdNm, guFull))) { matchedDong++; continue }

  const sggPool = bySgg.get(c.sggCd) || []
  if (sggPool.some(n => sameComplex(c.aptNm, n, c.umdNm, guFull))) { matchedSgg++; continue }

  // 신규 — 합성 kaptCode 부여. 재실행해도 같은 값이 나와야 URL·SEO·리포트 캐시가 안 깨진다.
  const hash = createHash('sha1')
    .update(`${c.sggCd}|${c.umdNm}|${c.aptNm.replace(/\s+/g, '')}`)
    .digest('hex').slice(0, 8).toUpperCase()

  const region = sggName.get(c.sggCd) || ''
  extras.push({
    kaptCode: `T${hash}`,                                  // T = trade 유래 (K-apt는 A 시작)
    kaptName: c.aptNm,
    bjdCode: dongCode.get(`${c.sggCd}|${c.umdNm}`) || `${c.sggCd}00000`,
    addr: [region, c.umdNm].filter(Boolean).join(' '),
    kaptBuldYy: c.buildYear || null,
    jibun: c.jibun || null,
    source: 'trade',
    dealCount: c.dealCount,
    lastDealYm: c.lastYm,
  })
}

extras.sort((a, b) => b.dealCount - a.dealCount || a.kaptName.localeCompare(b.kaptName, 'ko'))

// ── 리포트 ─────────────────────────────────
const total = complexes.size
console.log()
console.log('─'.repeat(58))
console.log(`실거래 단지        ${total}`)
console.log(`  기존 인덱스 매칭  ${matchedDong + matchedSgg}  (동 ${matchedDong} / 시군구 ${matchedSgg})`)
console.log(`  신규 추가        ${extras.length}  (${(extras.length / total * 100).toFixed(1)}%)`)
console.log('─'.repeat(58))

const bySido = new Map()
for (const e of extras) {
  const sido = (e.addr.split(' ')[0]) || '기타'
  bySido.set(sido, (bySido.get(sido) || 0) + 1)
}
console.log('\n시도별 신규:')
for (const [sido, n] of [...bySido].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${sido.padEnd(10)} ${String(n).padStart(6)}`)
}

console.log('\n거래 많은 신규 단지 20곳:')
for (const e of extras.slice(0, 20)) {
  console.log(`  ${e.dealCount.toString().padStart(4)}건  ${e.kaptName}  (${e.addr}${e.kaptBuldYy ? `, ${e.kaptBuldYy}년` : ''})`)
}

// ── 저장 ───────────────────────────────────
if (DRY_RUN) {
  console.log('\n--dry-run: 파일 쓰지 않음')
} else {
  const outPath = join(process.cwd(), 'public/apt-list-extra.json')
  writeFileSync(outPath, JSON.stringify(extras))
  console.log(`\n저장 완료: ${extras.length}개 → public/apt-list-extra.json`)
  console.log('  api/search.js · api/apt.js 가 이 파일을 함께 읽습니다.')
  console.log('  sitemap 반영: node scripts/generate-sitemap.mjs')
}
