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
  const results = list
    .filter(i => i.kaptName?.includes(query))
    .slice(0, 20)

  return res.json(results)
}
