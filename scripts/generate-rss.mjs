// RSS 피드 생성 — 브리핑 콘텐츠 기반
// 사용법: node scripts/generate-rss.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'https://www.suzip.kr'
const SITE_TITLE = '수군수군 우리집 — 뉴스 해석과 체감'
const SITE_DESC = '퇴근 후 이불 속에서 하는 임장. 부동산 뉴스를 실수요자 관점으로 풀어드려요.'

const indexPath = join(process.cwd(), 'public', 'briefings', 'index.json')
const briefings = existsSync(indexPath)
  ? JSON.parse(readFileSync(indexPath, 'utf-8'))
  : []

// 최근 20개만
const recent = briefings.slice(0, 20)

function escapeXml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildDescription(date) {
  const filePath = join(process.cwd(), 'public', 'briefings', `${date}.json`)
  if (!existsSync(filePath)) return ''
  try {
    const d = JSON.parse(readFileSync(filePath, 'utf-8'))
    const newsSummary = (d.news || []).map(n => `• ${n}`).join('\n')
    return escapeXml(`${newsSummary}\n\n정부 의도: ${d.intent || ''}\n\n시장 변화: ${d.market || ''}`)
  } catch {
    return ''
  }
}

const items = recent.map(item => {
  const pubDate = new Date(`${item.date}T07:00:00+09:00`).toUTCString()
  const desc = buildDescription(item.date)
  return `    <item>
      <title>${escapeXml(item.title || `${item.date} 부동산 브리핑`)}</title>
      <link>${BASE_URL}/briefing/${item.date}</link>
      <guid isPermaLink="true">${BASE_URL}/briefing/${item.date}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>
    </item>`
}).join('\n')

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${BASE_URL}/briefing</link>
    <description>${SITE_DESC}</description>
    <language>ko</language>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`

writeFileSync(join(process.cwd(), 'public', 'rss.xml'), rss)
console.log(`RSS 생성 완료: ${recent.length}개 항목`)
