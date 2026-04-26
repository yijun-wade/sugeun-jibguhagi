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

// 이름 유사도 (utils.js와 동일 로직)
function nameSim(a, b) {
  a = a.replace(/\s/g, '').toLowerCase()
  b = b.replace(/\s/g, '').toLowerCase()
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.85
  let common = 0
  for (const ch of a) if (b.includes(ch)) common++
  return common / Math.max(a.length, b.length)
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

// 아파트별 평균가 계산
const prices = {}
for (const apt of apts) {
  if (!apt.bjdCode) continue
  const lawdCd = apt.bjdCode.slice(0, 5)
  const trades = tradesByLawd[lawdCd] || []

  const matched = trades.filter(t => {
    const nm = (t.aptNm || '').trim()
    const amt = parseInt((t.dealAmount || '').replace(/,/g, ''))
    const area = parseFloat(t.excluUseAr || 0)
    return nameSim(nm, apt.kaptName) >= 0.6 && !isNaN(amt) && area >= 40
  })

  if (matched.length === 0) continue

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
