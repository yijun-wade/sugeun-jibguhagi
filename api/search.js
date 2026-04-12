// 아파트 검색 — 정적 JSON(public/apt-list.json)을 서버에서 읽어 이름 필터링
// MOLIT API 직접 호출 제거 (28초 타임아웃 문제 해결)
import { readFileSync } from 'fs'
import { join } from 'path'

export const config = { regions: ['icn1'] }

let aptList = null

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
  const { q } = req.query
  if (!q || q.trim().length < 1) return res.json([])

  const list = loadAptList()
  const rawQuery = q.trim()
  // 브랜드 오타 보정 후 검색
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
        // 시/구/동 이름이 쿼리로 시작하면 강한 지역 매칭 (예: "광명" → "광명시")
        const strongUnitMatch = query.length >= 2 && units.some(unit => unit.startsWith(query))
        // 부분 지역 매칭 (예: "망원동" ↔ "망원")
        const weakUnitMatch = query.length >= 2 && units.some(unit =>
          unit.includes(query) || query.includes(unit)
        )

        if (strongUnitMatch) {
          score = 3.5  // 지역명 시작 매칭 — 아파트명 매칭과 동급에 가깝게
        } else if (weakUnitMatch) {
          score = 2.5
        } else if (addr.includes(query)) {
          score = 2  // 주소 전체 포함
        } else if (addr.replace(/\s+/g, '').includes(normalQ)) {
          score = 1  // 주소 공백제거 포함
        }
      }

      return score > 0 ? { apt: i, score } : null
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score  // 1차: 점수 내림차순
      return (a.apt.kaptName || '').localeCompare(b.apt.kaptName || '', 'ko')  // 2차: 가나다 오름차순
    })
    .map(m => m.apt)
    .slice(0, 20)

  return res.json(results)
}
