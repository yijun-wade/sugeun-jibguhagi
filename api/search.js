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
      if (nm === query)                          score = 5  // 우선순위 5: 아파트명 정확 일치
      else if (nm.includes(query))               score = 4  // 우선순위 4: 아파트명 포함
      else if (nmNorm.includes(normalQ))         score = 3  // 우선순위 3: 아파트명 공백제거 포함
      else if (addr.includes(query))             score = 2  // 우선순위 2: 주소 포함
      else if (addr.replace(/\s+/g,'').includes(normalQ)) score = 1  // 우선순위 1: 주소 공백제거
      return score > 0 ? { apt: i, score } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map(m => m.apt)
    .slice(0, 20)

  return res.json(results)
}
