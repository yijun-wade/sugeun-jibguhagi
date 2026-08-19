// 서울 아파트 사전 가격 계산
// 사용법: node scripts/build-apt-prices.mjs [--months=12]
// 출력: public/apt-prices.json (요약+면적별 분포) / public/apt-price-trend.json (월별 시계열)
//
// v2(2026-08-20): 단지당 평균 하나 → 면적별 분포 + 월별 시계열.
//
// 왜 바꾸나:
//  1) 면적을 섞어 평균내고 있었다. 같은 단지의 59㎡와 84㎡를 한 평균에 넣으면
//     어느 평형도 아닌 숫자가 나온다. "이 단지 15.6억"이 실제로는 4억 차이 나는
//     두 평형의 중간값일 수 있다.
//  2) 단일 시점 스냅샷이라 추세가 없었다. "비싼가 싼가"는 말해도
//     "오르는 중인가"는 말 못 했다. 실제로 3개월 만에 +13% 움직인 단지가 있었다.

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const KEY = process.env.MOLIT_API_KEY
if (!KEY) { console.error('MOLIT_API_KEY 환경변수 필요'); process.exit(1) }

const MONTHS = Number((process.argv.find(a => a.startsWith('--months=')) || '--months=12').split('=')[1])

const apts = JSON.parse(readFileSync(join(process.cwd(), 'public/seoul-apt-enriched.json'), 'utf-8'))

// 최근 3개월 YM 리스트
function getYM(n) {
  const result = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

// 이름 유사도 (utils.js와 동일 로직 — 단지/차 마커 검증 포함)
function normNm(s) { return (s || '').replace(/[\s()（）]/g, '').replace(/아파트$/, '') }
function extractMarkers(s) {
  const out = []
  const re = /(\d+)(단지|차)/g
  let m
  while ((m = re.exec(s)) !== null) out.push(m[1])
  return out
}
function nameSim(a, b) {
  const na = normNm(a), nb = normNm(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ma = extractMarkers(na), mb = extractMarkers(nb)
  if (ma.length || mb.length) {
    if (ma.length !== mb.length) return 0
    if (!ma.every(x => mb.includes(x))) return 0
  }
  const shorter = na.length <= nb.length ? na : nb
  if (shorter.length >= 4 && (na.includes(nb) || nb.includes(na))) return 1
  const setB = new Set(nb)
  let overlap = 0
  for (const ch of na) if (setB.has(ch)) overlap++
  return overlap / Math.max(na.length, nb.length)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchTrades(lawdCd, dealYmd) {
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade` +
    `?serviceKey=${KEY}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=1000&pageNo=1&_type=json`
  try {
    const res = await fetch(url)
    const data = await res.json()
    const items = data?.response?.body?.items?.item
    if (!items) return []
    return Array.isArray(items) ? items : [items]
  } catch { return [] }
}

const ymList = getYM(MONTHS)
const lawdCds = [...new Set(apts.filter(a => a.bjdCode).map(a => a.bjdCode.slice(0, 5)))]

console.log(`구 수: ${lawdCds.length}, 조회 기간: ${ymList.join(', ')}`)

// lawdCd별 거래 데이터 수집
const tradesByLawd = {}
for (const lawdCd of lawdCds) {
  tradesByLawd[lawdCd] = []
  for (const ym of ymList) {
    const items = await fetchTrades(lawdCd, ym)
    tradesByLawd[lawdCd].push(...items)
    process.stdout.write('.')
    await sleep(150)
  }
}
console.log('\n거래 데이터 수집 완료')

// 동 단위 인덱스: 같은 동(umdNm) 안에서만 매칭 후보 검색
const aptsByDong = {}
for (const apt of apts) {
  if (!apt.bjdCode || !apt.kaptName) continue
  const lawdCd = apt.bjdCode.slice(0, 5)
  const dong = (apt.dongName || apt.dong || '').trim()
  const key = `${lawdCd}|${dong}`
  if (!aptsByDong[key]) aptsByDong[key] = []
  aptsByDong[key].push(apt)
}

// 거래 1건 = 가장 유사도 높은 아파트 1개에만 귀속
const tradesByApt = {}
for (const lawdCd of Object.keys(tradesByLawd)) {
  for (const t of tradesByLawd[lawdCd]) {
    const nm = (t.aptNm || '').trim()
    const umd = (t.umdNm || '').trim()
    const amt = parseInt((t.dealAmount || '').replace(/,/g, ''))
    const area = parseFloat(t.excluUseAr || 0)
    if (!nm || !umd || isNaN(amt) || area < 40) continue

    const candidates = aptsByDong[`${lawdCd}|${umd}`] || []
    let best = null, bestSim = 0
    for (const apt of candidates) {
      const sim = nameSim(nm, apt.kaptName)
      if (sim > bestSim) { bestSim = sim; best = apt }
    }
    if (best && bestSim >= 0.6) {
      if (!tradesByApt[best.kaptCode]) tradesByApt[best.kaptCode] = []
      tradesByApt[best.kaptCode].push(t)
    }
  }
}

// ── 아파트별 집계 ────────────────────────────────────────────
// 전용면적은 59.94·59.82처럼 미세하게 다르게 들어온다. 정수로 반올림하면
// 같은 평형이 한 구간으로 모인다(59.94→60, 84.97→85).
const areaBand = (a) => Math.round(parseFloat(a))
const amountOf = (t) => parseInt(String(t.dealAmount).replace(/,/g, ''))
const ymOf = (t) => `${t.dealYear}${String(t.dealMonth).padStart(2, '0')}`
const median = (arr) => {
  const s2 = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s2.length / 2)
  return s2.length % 2 ? s2[m] : Math.round((s2[m - 1] + s2[m]) / 2)
}
const perPyOf = (amt, area) => {
  const py = area / 3.3058
  return py > 0 ? Math.round(amt / py) : 0
}

// 최근 3개월 = 기존 필드(avg/perPy/count/ym)의 기준. 소비처 호환을 위해 유지한다.
const RECENT = new Set(ymList.slice(0, 3))

const prices = {}
const trend = {}

for (const apt of apts) {
  const matched = tradesByApt[apt.kaptCode]
  if (!matched || matched.length === 0) continue

  const rows = matched
    .map((t) => ({ amt: amountOf(t), area: parseFloat(t.excluUseAr), ym: ymOf(t) }))
    .filter((r) => r.amt > 0 && r.area > 0)
  if (!rows.length) continue

  // ── 면적별 분포 ────────────────────────────────────────────
  const byArea = new Map()
  for (const r of rows) {
    const b = areaBand(r.area)
    if (!byArea.has(b)) byArea.set(b, [])
    byArea.get(b).push(r)
  }
  const areas = [...byArea.entries()]
    .map(([area, list]) => {
      const amts = list.map((x) => x.amt)
      return {
        area,                                   // 전용 ㎡
        py: Math.round(area / 3.3058),          // 평
        count: list.length,
        avg: Math.round(amts.reduce((s2, x) => s2 + x, 0) / amts.length),
        median: median(amts),
        min: Math.min(...amts),
        max: Math.max(...amts),
        perPy: perPyOf(median(amts), area),
      }
    })
    .sort((a, b) => a.area - b.area)

  // ── 월별 시계열 ────────────────────────────────────────────
  const byYm = new Map()
  for (const r of rows) {
    if (!byYm.has(r.ym)) byYm.set(r.ym, [])
    byYm.get(r.ym).push(r.amt)
  }
  const series = [...byYm.entries()]
    .map(([ym, amts]) => ({ ym, avg: Math.round(amts.reduce((s2, x) => s2 + x, 0) / amts.length), count: amts.length }))
    .sort((a, b) => a.ym.localeCompare(b.ym))
  if (series.length >= 2) trend[apt.kaptCode] = series

  // ── 기존 호환 필드 ─────────────────────────────────────────
  // 최근 3개월 거래가 있으면 그걸로, 없으면 전체로 계산한다.
  // 예전에는 면적을 섞은 평균이었는데, 이제는 거래가 가장 많은 면적을 대표로 쓴다.
  // 평형을 섞은 평균은 어느 평형도 아닌 값이라 인용하면 틀린 말이 된다.
  const recentRows = rows.filter((r) => RECENT.has(r.ym))
  const base = recentRows.length ? recentRows : rows
  const mainArea = [...byArea.entries()].sort((a, b) => b[1].length - a[1].length)[0][0]
  const mainRows = base.filter((r) => areaBand(r.area) === mainArea)
  const use = mainRows.length ? mainRows : base
  const avgAmt = Math.round(use.reduce((s2, r) => s2 + r.amt, 0) / use.length)
  const avgArea = use.reduce((s2, r) => s2 + r.area, 0) / use.length

  prices[apt.kaptCode] = {
    avg: avgAmt,
    perPy: perPyOf(avgAmt, avgArea),
    count: use.length,
    ym: base === recentRows ? ymList[0] : series[series.length - 1].ym,
    mainArea,                    // 대표 면적(거래 최다) — avg가 어느 평형인지 밝힌다
    areas,                       // 면적별 분포
    totalCount: rows.length,     // 수집 기간 전체 거래 수
  }
}

const covered = Object.keys(prices).length
console.log(`가격 계산 완료: ${covered}/${apts.length}개 (${Math.round(covered / apts.length * 100)}%)`)
console.log(`  면적 구간 평균 ${(Object.values(prices).reduce((s2, p) => s2 + p.areas.length, 0) / covered).toFixed(1)}개/단지`)
console.log(`  시계열 보유: ${Object.keys(trend).length}개 단지`)

writeFileSync(join(process.cwd(), 'public/apt-prices.json'), JSON.stringify(prices))
writeFileSync(join(process.cwd(), 'public/apt-price-trend.json'), JSON.stringify(trend))
const kb = (f) => Math.round(readFileSync(join(process.cwd(), f)).length / 1024)
console.log(`저장 완료 — apt-prices.json ${kb('public/apt-prices.json')}KB / apt-price-trend.json ${kb('public/apt-price-trend.json')}KB`)
