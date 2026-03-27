// 전국 공동주택 단지 목록을 public/apt-list.json 으로 저장
// 실행: MOLIT_API_KEY=xxx node scripts/fetch-apt-list.mjs
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const KEY = process.env.MOLIT_API_KEY
if (!KEY) { console.error('MOLIT_API_KEY 환경변수를 설정해주세요'); process.exit(1) }
const BASE = 'https://apis.data.go.kr/1613000/AptListService3/getTotalAptList3'

async function fetchPage(pageNo) {
  const r = await fetch(`${BASE}?serviceKey=${KEY}&numOfRows=1000&pageNo=${pageNo}&_type=json`)
  return (await r.json())?.response?.body
}

const body1 = await fetchPage(1)
const totalCount = parseInt(body1.totalCount)
const numPages = Math.ceil(totalCount / 1000)
console.log(`총 ${totalCount}개 단지, ${numPages}페이지 로드 시작...`)

function extractItems(body) {
  const items = body?.items
  if (!Array.isArray(items)) return []
  return items.map(i => ({ kaptCode: i.kaptCode, kaptName: i.kaptName, bjdCode: i.bjdCode, location: [i.as2, i.as3].filter(Boolean).join(' ') }))
}

let all = extractItems(body1)
for (let start = 2; start <= numPages; start += 5) {
  const pages = Array.from({ length: Math.min(5, numPages - start + 1) }, (_, i) => start + i)
  const bodies = await Promise.all(pages.map(p => fetchPage(p)))
  bodies.forEach(b => { all = all.concat(extractItems(b)) })
  process.stdout.write(`\r${all.length}/${totalCount} 완료`)
}
console.log()
const outPath = path.join(__dirname, '../public/apt-list.json')
fs.writeFileSync(outPath, JSON.stringify(all))
console.log(`저장 완료: ${all.length}개 → public/apt-list.json`)
