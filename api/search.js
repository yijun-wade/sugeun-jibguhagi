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

// addr에서 동/구 단위 추출 헬퍼
// "서울특별시 마포구 망원동 12-3" → ["마포구", "망원동"]
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
  const query = q.trim()
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
        // 동/구 단위 추출 후 매칭 (Score 2.5)
        // "망원" → 망원동.includes("망원") → 매칭
        // "망원동" → 망원동.includes("망원동") → 매칭
        // "강남구" → 강남구.includes("강남구") → 매칭
        const units = extractAdminUnits(addr)
        const unitMatch = query.length >= 2 && units.some(unit =>
          unit.includes(query) || unit.includes(normalQ) || query.includes(unit)
        )
        if (unitMatch) {
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
