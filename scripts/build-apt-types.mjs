// 서울 단지의 분양형태(임대·혼합·분양)를 K-APT 기본정보에서 받아 public/apt-types.json으로 굳힌다.
//
// 사용법: MOLIT_API_KEY=... node scripts/build-apt-types.mjs [--limit=50]
//
// 왜 정적 파일인가: 유형은 거의 바뀌지 않고, 상세 첫 화면이 유형에 따라 갈려야 해서
// 런타임에 K-APT를 기다릴 수 없다. 서버리스 함수도 12개 한도라 새 함수를 못 만든다.
// 출력은 { kaptCode: 'rental' | 'mixed' }만 담는다. 분양(다수)은 생략해 파일을 작게.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { classifyAptType } from '../api/_apt-type.js'

const KEY = (process.env.MOLIT_API_KEY || '').trim()
if (!KEY) { console.error('MOLIT_API_KEY 없음'); process.exit(1) }
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity
const OUT = join(process.cwd(), 'public', 'apt-types.json')
// 이 키는 운영 사이트의 /api/kapt와 공유된다. 초당 제한(코드 23)에 걸리면 운영 페이지의
// 단지정보 카드가 같이 429를 맞는다 — 실제로 동시 6개로 돌렸다가 운영을 잠깐 막았다.
// 그래서 한 번에 하나, 간격을 두고 돈다. 3,345건 ≈ 30분.
const CONCURRENCY = 1
const GAP_MS = 500

const apts = JSON.parse(readFileSync(join(process.cwd(), 'public', 'seoul-apt-enriched.json'), 'utf8')).slice(0, LIMIT)
// 이어 돌리기 — 중간에 끊겨도 받은 만큼은 남는다.
const raw = existsSync(OUT + '.raw') ? JSON.parse(readFileSync(OUT + '.raw', 'utf8')) : {}

async function fetchCode(kaptCode) {
  const url = `https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5?serviceKey=${KEY}&kaptCode=${kaptCode}&_type=json`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await fetch(url).then(r => r.text())
      // 초당 제한은 기다렸다 재시도, 일일 한도·인증 오류는 중단.
      if (/PER_SECOND/.test(text)) { await new Promise(r => setTimeout(r, 3000)); continue }
      if (/LIMITED_NUMBER|SERVICE_KEY|SERVICE_ACCESS_DENIED/.test(text)) throw new Error('quota/auth: ' + text.replace(/\s+/g, ' ').slice(0, 160))
      const item = JSON.parse(text)?.response?.body?.item
      return item?.codeSaleNm ?? null
    } catch (e) {
      if (/quota\/auth/.test(e.message)) throw e
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  return undefined // 3회 실패 — 다음 실행에서 재시도
}

let done = 0, stop = false
const queue = apts.filter(a => raw[a.kaptCode] === undefined)
console.log(`대상 ${apts.length} · 남은 조회 ${queue.length}`)
async function worker() {
  while (queue.length && !stop) {
    const a = queue.shift()
    try {
      const code = await fetchCode(a.kaptCode)
      if (code !== undefined) raw[a.kaptCode] = code
    } catch (e) { console.error(e.message); stop = true }
    await new Promise(r => setTimeout(r, GAP_MS))
    if (++done % 200 === 0) { writeFileSync(OUT + '.raw', JSON.stringify(raw)); console.log(`  ${done}건`) }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
writeFileSync(OUT + '.raw', JSON.stringify(raw))

const out = {}
const count = { rental: 0, mixed: 0, sale: 0, unknown: 0 }
for (const a of apts) {
  const t = classifyAptType({ name: a.kaptName, codeSaleNm: raw[a.kaptCode] })
  count[t]++
  if (t === 'rental' || t === 'mixed') out[a.kaptCode] = t
}
writeFileSync(OUT, JSON.stringify(out))
console.log('완료', count, stop ? '(중단됨 — 다시 실행하면 이어서 받음)' : '')
