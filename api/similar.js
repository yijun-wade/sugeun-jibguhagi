// 비슷한 가격대 단지 — apt-discovery.json 에서 기준가 근접 단지 반환
import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'
import { pickSimilarApts } from './_similar.js'

export const config = { regions: ['icn1'] }

let discovery = null
function loadDiscovery() {
  if (discovery) return discovery
  try {
    const filePath = join(process.cwd(), 'public', 'apt-discovery.json')
    discovery = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    discovery = []
  }
  return discovery
}

export default function handler(req, res) {
  if (setCors(req, res)) return

  const { kaptCode, avg, gu } = req.query
  if (!kaptCode) return res.status(400).json({ error: 'kaptCode 필요' })

  const list = loadDiscovery()
  const anchorAvg = avg != null && avg !== '' ? Number(avg) : undefined
  const result = pickSimilarApts(list, { kaptCode, avg: anchorAvg, gu }, 6)

  res.json(result)
}
