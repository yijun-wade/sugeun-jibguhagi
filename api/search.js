// 아파트 검색 — 정적 JSON(public/apt-list.json)을 서버에서 읽어 이름 필터링
// MOLIT API 직접 호출 제거 (28초 타임아웃 문제 해결)
import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'
import { rankResults } from './_search-rank.js'

export const config = { regions: ['icn1'] }

let aptList = null
let enrichMap = null  // kaptCode → { kaptdaCnt, useAprDay }

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

// 브랜드명 오타 보정 (예: 프루지오 → 푸르지오)
const BRAND_ALIASES = {
  '프루지오': '푸르지오',
  '레미안': '래미안',
  '힐스테잇': '힐스테이트',
  '힐스테잇': '힐스테이트',
  '아이파크': '아이파크',
  '캐슬': '캐슬',
}

function normalizeQuery(q) {
  let result = q
  // 불필요한 접미사 제거 ("아파트", "단지", "빌라", "주상복합" 등)
  result = result.replace(/\s*(아파트|단지|빌라|주상복합|오피스텔|아파트먼트)\s*$/g, '').trim()
  for (const [wrong, right] of Object.entries(BRAND_ALIASES)) {
    if (result.includes(wrong)) result = result.replaceAll(wrong, right)
  }
  return result
}

export default function handler(req, res) {
  if (setCors(req, res)) return
  const { q } = req.query
  if (!q || q.trim().length < 1) return res.json([])

  const list = loadAptList()
  const enrich = loadEnrichMap()
  const rawQuery = q.trim()
  const query = normalizeQuery(rawQuery)

  const ranked = rankResults(list, query, (code) => enrich.get(code)?.kaptdaCnt || 0)
  const results = ranked
    .map(apt => {
      const extra = enrich.get(apt.kaptCode)
      if (!extra) return apt
      return { ...apt, kaptdaCnt: extra.kaptdaCnt, useAprDay: extra.useAprDay, summary: extra.summary }
    })
    .slice(0, 20)

  return res.json(results)
}
