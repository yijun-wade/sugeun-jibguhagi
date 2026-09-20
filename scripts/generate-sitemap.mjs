// 사이트맵 생성 — 아파트 상세 페이지 URL 포함
// 사용법: node scripts/generate-sitemap.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://www.suzip.kr'
const aptList = JSON.parse(readFileSync(join(process.cwd(), 'public', 'seoul-apt-enriched.json'), 'utf-8'))

// 단지 페이지의 lastmod — 요약을 다시 만든 날. 크롤러에게 "이 페이지 바뀌었다"를 알리는 유일한 신호다.
// 전에는 lastmod가 아예 없어서, 본문을 259자에서 1,100자로 채운 뒤에도 재색인을 크롤러 재량에 맡겨야 했다.
const vibePath = join(process.cwd(), 'public', 'apt-vibe.json')
const vibeMap = existsSync(vibePath) ? JSON.parse(readFileSync(vibePath, 'utf-8')) : {}

const briefingIndexPath = join(process.cwd(), 'public', 'briefings', 'index.json')
const briefingDates = existsSync(briefingIndexPath)
  ? JSON.parse(readFileSync(briefingIndexPath, 'utf-8'))
  : []

const TODAY = new Date().toISOString().slice(0, 10)

const staticUrls = [
  { loc: `${BASE_URL}/`, changefreq: 'daily', priority: '1.0', lastmod: TODAY },
  { loc: `${BASE_URL}/briefing`, changefreq: 'daily', priority: '0.9', lastmod: TODAY },
]

const briefingUrls = briefingDates.map(item => ({
  loc: `${BASE_URL}/briefing/${item.date}`,
  changefreq: 'never',
  priority: '0.7',
  lastmod: item.date,
}))

// 실거래가 기반 보강분 — scripts/build-trade-index.mjs 생성 (있을 때만)
//
// 검색은 전국을 다 태우지만 사이트맵은 서울만 올린다.
// 상세페이지에 붙일 살(세대수·점수·요약)이 seoul-apt-enriched.json 뿐이라,
// 지방 1만여 건은 이름·주소만 있는 얇은 페이지가 된다. 그 규모로 한꺼번에
// 색인시키면 크롤 예산만 소모하고 사이트 품질 평가에 되레 손해다.
// 지방 데이터가 채워지면 SITEMAP_REGION을 비우면 된다.
const SITEMAP_REGION = '서울특별시'
const extraPath = join(process.cwd(), 'public', 'apt-list-extra.json')
const extraApts = (existsSync(extraPath) ? JSON.parse(readFileSync(extraPath, 'utf-8')) : [])
  .filter(a => !SITEMAP_REGION || (a.addr || '').startsWith(SITEMAP_REGION))

const seenCodes = new Set(aptList.map(a => a.kaptCode))
const aptUrls = [...aptList, ...extraApts.filter(a => !seenCodes.has(a.kaptCode))].map(apt => {
  const v = vibeMap[apt.kaptCode]
  return {
    loc: `${BASE_URL}/apt/${apt.kaptCode}`,
    // 요약이 있는 단지는 본문이 실하고 갱신 주기도 있다. 없는 단지는 이름·주소뿐이라 우선순위를 낮춘다.
    changefreq: v ? 'monthly' : 'yearly',
    priority: v ? '0.8' : '0.5',
    lastmod: v?.t || undefined,
  }
})

const allUrls = [...staticUrls, ...briefingUrls, ...aptUrls]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `
    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

writeFileSync(join(process.cwd(), 'public', 'sitemap.xml'), xml)
const withMod = allUrls.filter(u => u.lastmod).length
console.log(`사이트맵 생성 완료: ${allUrls.length}개 URL (lastmod ${withMod}개 · 요약 보유 단지 ${Object.keys(vibeMap).length}곳)`)
