// 아파트 검색 — 정적 JSON(public/apt-list.json)을 서버에서 읽어 이름 필터링
// MOLIT API 직접 호출 제거 (28초 타임아웃 문제 해결)
import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'

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

// addr에서 동/구/시 단위 추출 헬퍼
// "경기도 광명시 철산동" → ["광명시", "철산동"]
function extractAdminUnits(addr) {
  return (addr || '').split(' ').filter(part =>
    part.endsWith('동') || part.endsWith('구') || part.endsWith('시') ||
    part.endsWith('군') || part.endsWith('읍') || part.endsWith('면')
  )
}

export default function handler(req, res) {
  if (setCors(req, res)) return
  const { q } = req.query
  if (!q || q.trim().length < 1) return res.json([])

  const list = loadAptList()
  const enrich = loadEnrichMap()
  const rawQuery = q.trim()
  const query = normalizeQuery(rawQuery)
  const normalQ = query.replace(/\s+/g, '')

  const results = list
    .map(i => {
      const nm = i.kaptName || ''
      const addr = i.addr || ''
      const nmNorm = nm.replace(/\s+/g, '')
      let score = 0

      if (nm === query) {
        score = 5  // 아파트명 정확 일치
      } else if (nm.includes(query)) {
        score = 4  // 아파트명 포함
      } else if (nmNorm.includes(normalQ)) {
        score = 3  // 아파트명 공백제거 포함
      } else {
        const units = extractAdminUnits(addr)
        const strongUnitMatch = query.length >= 2 && units.some(unit => unit.startsWith(query))
        const weakUnitMatch = query.length >= 2 && units.some(unit =>
          unit.includes(query) || query.includes(unit)
        )
        if (strongUnitMatch) score = 3.5
        else if (weakUnitMatch) score = 2.5
        else if (addr.includes(query)) score = 2
        else if (addr.replace(/\s+/g, '').includes(normalQ)) score = 1
      }

      const isMetro = /^(서울|경기)/.test(addr)
      const finalScore = score + (isMetro ? 1 : 0)  // 서울/경기 +1 보너스
      return score > 0 ? { apt: i, score: finalScore } : null
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score  // 1차: 복합점수 내림차순
      // 2차: 세대수 내림차순
      const aCnt = enrich.get(a.apt.kaptCode)?.kaptdaCnt || 0
      const bCnt = enrich.get(b.apt.kaptCode)?.kaptdaCnt || 0
      if (bCnt !== aCnt) return bCnt - aCnt
      return (a.apt.kaptName || '').localeCompare(b.apt.kaptName || '', 'ko')  // 3차: 가나다
    })
    .map(m => {
      const extra = enrich.get(m.apt.kaptCode)
      if (!extra) return m.apt
      return { ...m.apt, kaptdaCnt: extra.kaptdaCnt, useAprDay: extra.useAprDay, summary: extra.summary }
    })
    .slice(0, 20)

  return res.json(results)
}
