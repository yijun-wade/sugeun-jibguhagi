// 서울 아파트 데이터 보강 스크립트
// 기존 apt-list.json에서 서울 아파트만 추출하고 지역 정보 + 점수 추가
// 실행: node scripts/build-seoul-apt.mjs
//
// 출력: public/seoul-apt.json
// 추후 세대수/위도경도는 AptListService2 API 신청 후 enrich-with-detail.mjs 로 추가 예정

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcPath = path.join(__dirname, '../public/apt-list.json')
const outPath = path.join(__dirname, '../public/seoul-apt.json')

// 지역별 검색 우선순위 점수 (regionScore)
// 서울=10, 수도권(경기/인천)=7, 광역시=5, 지방=2
function getRegionScore(sido) {
  if (sido === '서울특별시') return 10
  if (sido === '경기도' || sido === '인천광역시') return 7
  if (sido.endsWith('광역시') || sido === '세종특별자치시') return 5
  return 2
}

const raw = JSON.parse(fs.readFileSync(srcPath, 'utf-8'))

const enriched = raw.map(apt => {
  const parts = (apt.addr || '').split(' ').filter(Boolean)
  const sido     = parts[0] || ''
  const sigungu  = parts[1] || ''
  const dong     = parts[2] || ''

  return {
    kaptCode:    apt.kaptCode,
    kaptName:    apt.kaptName,
    bjdCode:     apt.bjdCode,
    addr:        apt.addr,
    sido,
    sigungu,
    dong,
    regionScore: getRegionScore(sido),
    // 세대수(kaptdaCnt), 위도(lat), 경도(lng), 준공일(useAprDay)은
    // AptListService2 API 신청 후 추가 예정
    kaptdaCnt:   null,
    lat:         null,
    lng:         null,
    useAprDay:   null,
  }
})

// 서울 데이터만 먼저 추출
const seoul = enriched.filter(a => a.sido === '서울특별시')

// 지역별 통계
const byGu = {}
seoul.forEach(a => {
  byGu[a.sigungu] = (byGu[a.sigungu] || 0) + 1
})

console.log(`전체: ${raw.length}개`)
console.log(`서울: ${seoul.length}개`)
console.log('\n구별 아파트 수:')
Object.entries(byGu)
  .sort((a, b) => b[1] - a[1])
  .forEach(([gu, cnt]) => console.log(`  ${gu}: ${cnt}개`))

fs.writeFileSync(outPath, JSON.stringify(seoul, null, 2))
console.log(`\n저장 완료: ${outPath}`)
console.log('\n다음 단계: data.go.kr에서 "공동주택 기본정보 서비스(AptListService2)" 신청 후')
console.log('           scripts/enrich-with-detail.mjs 실행하여 세대수/위도경도 추가')
