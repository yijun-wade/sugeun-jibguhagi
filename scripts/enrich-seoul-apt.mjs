// 서울 아파트 세대수·준공일·도로명주소 보강 스크립트
// 실행: MOLIT_API_KEY=xxx node scripts/enrich-seoul-apt.mjs
// 입력: public/seoul-apt.json (build-seoul-apt.mjs 결과)
// 출력: public/seoul-apt-enriched.json

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const KEY = process.env.MOLIT_API_KEY
if (!KEY) { console.error('MOLIT_API_KEY 환경변수를 설정해주세요'); process.exit(1) }

const BASE = 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4'

const srcPath = path.join(__dirname, '../public/seoul-apt.json')
const outPath = path.join(__dirname, '../public/seoul-apt-enriched.json')

const seoulApts = JSON.parse(fs.readFileSync(srcPath, 'utf-8'))
console.log(`서울 아파트 ${seoulApts.length}개 보강 시작...`)

async function fetchDetail(kaptCode) {
  const url = `${BASE}?serviceKey=${KEY}&kaptCode=${kaptCode}&_type=json`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const r = await fetch(url, { signal: controller.signal })
    if (!r.ok) return null
    const data = await r.json()
    return data?.response?.body?.item || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// 배치 처리 (동시 10개)
const BATCH = 10
const enriched = []
let success = 0, fail = 0

for (let i = 0; i < seoulApts.length; i += BATCH) {
  const batch = seoulApts.slice(i, i + BATCH)
  const results = await Promise.all(batch.map(apt => fetchDetail(apt.kaptCode)))

  for (let j = 0; j < batch.length; j++) {
    const apt = batch[j]
    const detail = results[j]

    if (detail) {
      enriched.push({
        ...apt,
        kaptdaCnt:  detail.kaptdaCnt  ? Math.round(detail.kaptdaCnt) : null,
        kaptDongCnt: detail.kaptDongCnt ? parseInt(detail.kaptDongCnt) : null,
        useAprDay:  detail.kaptUsedate || null,
        doroJuso:   detail.doroJuso   || null,
        codeHeatNm: detail.codeHeatNm || null,
      })
      success++
    } else {
      enriched.push(apt)
      fail++
    }
  }

  const done = Math.min(i + BATCH, seoulApts.length)
  process.stdout.write(`\r진행: ${done}/${seoulApts.length} (성공 ${success}, 실패 ${fail})`)

  // API 부하 방지: 10개마다 200ms 대기
  if (i + BATCH < seoulApts.length) await new Promise(r => setTimeout(r, 200))
}

console.log('\n')
fs.writeFileSync(outPath, JSON.stringify(enriched, null, 2))

// 결과 통계
const withCnt = enriched.filter(a => a.kaptdaCnt !== null)
const avgCnt = withCnt.reduce((s, a) => s + a.kaptdaCnt, 0) / withCnt.length

console.log(`저장 완료: ${outPath}`)
console.log(`총 ${enriched.length}개 중 세대수 있음: ${withCnt.length}개`)
console.log(`평균 세대수: ${Math.round(avgCnt)}세대`)
console.log(`\n샘플 (세대수 내림차순 5개):`)
enriched
  .filter(a => a.kaptdaCnt)
  .sort((a, b) => b.kaptdaCnt - a.kaptdaCnt)
  .slice(0, 5)
  .forEach(a => console.log(`  ${a.kaptName} (${a.sigungu}) — ${a.kaptdaCnt}세대`))
