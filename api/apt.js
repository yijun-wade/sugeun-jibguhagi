// api/apt.js — kaptCode로 아파트 단건 조회
import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'

let aptList = null
let enrichMap = null

function loadAptList() {
  if (aptList) return aptList
  try {
    const filePath = join(process.cwd(), 'public', 'apt-list.json')
    aptList = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    aptList = []
  }
  // 실거래가 기반 보강분 (K-apt 미등록 소규모 주상복합 등) — scripts/build-trade-index.mjs 생성
  try {
    const extraPath = join(process.cwd(), 'public', 'apt-list-extra.json')
    aptList = aptList.concat(JSON.parse(readFileSync(extraPath, 'utf-8')))
  } catch { /* 파일 없으면 K-apt 목록만 사용 */ }
  return aptList
}

function loadEnrichMap() {
  if (enrichMap) return enrichMap
  try {
    const filePath = join(process.cwd(), 'public', 'seoul-apt-enriched.json')
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    enrichMap = new Map(data.map(a => [a.kaptCode, { kaptdaCnt: a.kaptdaCnt, useAprDay: a.useAprDay }]))
  } catch {
    enrichMap = new Map()
  }
  return enrichMap
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// 크롤러(네이버 Yeti·구글봇 등)용 프리렌더 HTML — apt_detail이 빈 SPA 껍데기로
// 색인되던 문제 해결. 사람은 SPA 그대로(vercel.json에서 UA로 분기).
function buildPrerenderHtml(apt) {
  const name = apt.kaptName || '아파트'
  const addr = apt.addr || ''
  const parts = addr.split(' ')
  const dong = parts.find(p => /[동읍면]$/.test(p)) || ''
  const region = parts.find(p => /[구시군]$/.test(p)) || ''
  const buildYear = apt.kaptBuldYy ? `${apt.kaptBuldYy}년` : ''
  const households = apt.kaptdaCnt ? `${apt.kaptdaCnt}세대` : ''
  const url = `https://www.suzip.kr/apt/${apt.kaptCode}`

  const loc = [region, dong].filter(Boolean).join(' ')
  const title = `${name} 실거주 후기·동네 분위기·실거래가 | 수군수군 우리집`
  const description = [
    `${name}${loc ? ` (${loc})` : ''} 실거주자 이야기, 동네 분위기, 실거래가를 한눈에 확인하세요`,
    buildYear && `${buildYear} 준공`,
    households,
  ].filter(Boolean).join(' · ')

  const facts = [
    addr && `주소: ${esc(addr)}`,
    buildYear && `준공: ${esc(buildYear)}`,
    households && `세대수: ${esc(households)}`,
  ].filter(Boolean).map(f => `<li>${f}</li>`).join('')

  const intro =
    `${esc(name)}${loc ? `은(는) ${esc(loc)}에 위치한 아파트 단지입니다. ` : ' '}` +
    `이 단지의 동네 분위기, 실거주자들의 이야기, 최근 실거래가를 수군수군 우리집에서 모아 정리했어요. ` +
    `${esc(dong || region)} 생활 여건과 교통·학군·주변 상권까지 이불 속에서 미리 임장해보세요.`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    name,
    url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: addr,
      addressRegion: region,
      addressCountry: 'KR',
    },
    ...(households ? { numberOfAccommodationUnits: apt.kaptdaCnt } : {}),
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="수군수군 우리집" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://www.suzip.kr/ogimage.png" />
<meta property="og:locale" content="ko_KR" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<h1>${esc(name)} 실거주 후기 및 동네 분위기</h1>
<p>${intro}</p>
${facts ? `<ul>${facts}</ul>` : ''}
<p><a href="${url}">${esc(name)} 상세 보기 — 수군수군 우리집</a></p>
</body>
</html>`
}

export default function handler(req, res) {
  if (setCors(req, res)) return
  const { kaptCode, prerender } = req.query
  if (!kaptCode) return res.status(400).json({ error: 'kaptCode required' })

  const list = loadAptList()
  const apt = list.find(a => a.kaptCode === kaptCode)
  if (!apt) return res.status(404).json({ error: 'not found' })

  const enrich = loadEnrichMap()
  const extra = enrich.get(kaptCode)
  const full = extra ? { ...apt, kaptdaCnt: extra.kaptdaCnt, useAprDay: extra.useAprDay } : apt

  // 크롤러 프리렌더 모드 (vercel.json UA rewrite로만 진입)
  if (prerender) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).send(buildPrerenderHtml(full))
  }

  return res.json(full)
}
