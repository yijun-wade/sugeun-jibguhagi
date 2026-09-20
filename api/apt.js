// api/apt.js — kaptCode로 아파트 단건 조회
import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'
import { parseAddr } from './_addr.js'
import { classifyAptType } from './_apt-type.js'
import { buildPrerenderHtml } from './_prerender.js'
import { buildHomeHtml } from './_prerender-home.js'
import { pickSimilarApts, pickSameTypeApts } from './_similar.js'

let aptList = null
let enrichMap = null
let typeMap = null

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
    enrichMap = new Map(data.map(a => [a.kaptCode, { kaptdaCnt: a.kaptdaCnt, useAprDay: a.useAprDay, summary: a.summary }]))
  } catch {
    enrichMap = new Map()
  }
  return enrichMap
}

// 단지 유형(임대·혼합) — scripts/build-apt-types.mjs가 K-APT 분양형태로 만든 정적 파일.
// 파일이 없거나 단지가 빠져 있으면 단지명 키워드로 추정한다(_apt-type.js).
function loadTypeMap() {
  if (typeMap) return typeMap
  try {
    typeMap = JSON.parse(readFileSync(join(process.cwd(), 'public', 'apt-types.json'), 'utf-8'))
  } catch {
    typeMap = {}
  }
  return typeMap
}

export function resolveAptType(apt, types = loadTypeMap()) {
  const known = types[apt.kaptCode]
  if (known) return known
  // 정적 파일은 임대·혼합만 담는다. 파일이 있는데 없으면 분양, 파일 자체가 없으면 이름으로 추정.
  const byName = classifyAptType({ name: apt.kaptName })
  if (byName === 'rental') return 'rental'
  return Object.keys(types).length > 0 ? 'sale' : 'unknown'
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// 프리렌더에 실을 정적 데이터. 전부 고정 경로라 함수 번들에 같이 실린다.
const cache = {}
function loadPublic(name, fallback) {
  if (name in cache) return cache[name]
  try { cache[name] = JSON.parse(readFileSync(join(process.cwd(), 'public', name), 'utf-8')) }
  catch { cache[name] = fallback }
  return cache[name]
}

function prerenderData(apt) {
  const price = loadPublic('apt-prices.json', {})[apt.kaptCode] || null
  const { gu } = parseAddr(apt.addr)
  const rentalNoPrice = apt.aptType === 'rental' && !(price?.avg > 0)
  const similar = rentalNoPrice
    ? pickSameTypeApts(loadPublic('seoul-apt-enriched.json', []), loadTypeMap(), { kaptCode: apt.kaptCode, gu }, 6)
    : pickSimilarApts(loadPublic('apt-discovery.json', []), { kaptCode: apt.kaptCode, avg: price?.avg, gu }, 6)
  return {
    vibe: loadPublic('apt-vibe.json', {})[apt.kaptCode] || null,
    price,
    trend: loadPublic('apt-price-trend.json', {})[apt.kaptCode] || null,
    similar,
  }
}

export default function handler(req, res) {
  if (setCors(req, res)) return
  const { kaptCode, prerender, home } = req.query

  // 크롤러용 홈 (vercel.json이 UA로 분기). 새 함수를 만들지 않으려고 여기에 얹었다 — 12개 한도.
  if (home) {
    // '많이 찾는 단지' = 요약을 만들어 둔 단지 중 세대수 상위. 사람이 보는 목록과 같은 기준이다.
    const vibe = loadPublic('apt-vibe.json', {})
    const featured = loadPublic('seoul-apt-enriched.json', [])
      .filter(a => vibe[a.kaptCode])
      .sort((x, y) => (y.kaptdaCnt || 0) - (x.kaptdaCnt || 0))
      .slice(0, 60)
      .map(a => ({ kaptCode: a.kaptCode, kaptName: a.kaptName, sigungu: a.sigungu, dong: a.dong }))
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).send(buildHomeHtml(featured))
  }

  if (!kaptCode) return res.status(400).json({ error: 'kaptCode required' })

  const list = loadAptList()
  const apt = list.find(a => a.kaptCode === kaptCode)
  if (!apt) return res.status(404).json({ error: 'not found' })

  const enrich = loadEnrichMap()
  const extra = enrich.get(kaptCode)
  const full = {
    ...apt,
    ...(extra ? { kaptdaCnt: extra.kaptdaCnt, useAprDay: extra.useAprDay, summary: extra.summary } : {}),
    aptType: resolveAptType(apt),
  }

  // 크롤러 프리렌더 모드 (vercel.json UA rewrite로만 진입)
  if (prerender) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    return res.status(200).send(buildPrerenderHtml(full, prerenderData(full)))
  }

  return res.json(full)
}
