// 사이트맵 생성 — 아파트 상세 페이지 URL 포함
// 사용법: node scripts/generate-sitemap.mjs

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://www.suzip.kr'
const aptList = JSON.parse(readFileSync(join(process.cwd(), 'public', 'seoul-apt-enriched.json'), 'utf-8'))

const staticUrls = [
  { loc: `${BASE_URL}/`, changefreq: 'daily', priority: '1.0' },
]

const aptUrls = aptList.map(apt => ({
  loc: `${BASE_URL}/apt/${apt.kaptCode}`,
  changefreq: 'weekly',
  priority: '0.8',
}))

const allUrls = [...staticUrls, ...aptUrls]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

writeFileSync(join(process.cwd(), 'public', 'sitemap.xml'), xml)
console.log(`사이트맵 생성 완료: ${allUrls.length}개 URL`)
