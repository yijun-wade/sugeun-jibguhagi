// 서울 아파트 사전 가격 계산
// 사용법: node scripts/build-apt-prices.mjs
// 출력: public/apt-prices.json

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const KEY = process.env.MOLIT_API_KEY
if (!KEY) { console.error('MOLIT_API_KEY 환경변수 필요'); process.exit(1) }

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

const ymList = getYM(3)
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

// 아파트별 평균가 계산
const prices = {}
for (const apt of apts) {
  const matched = tradesByApt[apt.kaptCode]
  if (!matched || matched.length === 0) continue

  const avgAmt = Math.round(matched.reduce((s, t) => s + parseInt(t.dealAmount.replace(/,/g,'')), 0) / matched.length)
  const avgArea = matched.reduce((s, t) => s + parseFloat(t.excluUseAr), 0) / matched.length
  const avgPy = Math.round(avgArea / 3.3058)
  const perPy = avgPy > 0 ? Math.round(avgAmt / avgPy) : 0

  prices[apt.kaptCode] = {
    avg: avgAmt,       // 만원 단위
    perPy,             // 평당가 만원
    count: matched.length,
    ym: ymList[0],     // 기준 월
  }
}

const covered = Object.keys(prices).length
console.log(`가격 계산 완료: ${covered}/${apts.length}개 (${Math.round(covered/apts.length*100)}%)`)

writeFileSync(join(process.cwd(), 'public/apt-prices.json'), JSON.stringify(prices))
console.log('public/apt-prices.json 저장 완료')
