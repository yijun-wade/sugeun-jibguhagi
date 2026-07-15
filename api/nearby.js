// 내 주변 아파트 — 두 가지 모드
//  1) names=... : 카카오 Places 이름 목록으로 apt-list.json 매칭 (기존)
//  2) kaptCode=... : 비슷한 가격대 단지(같은 구 우선) apt-discovery.json 기반 (상세페이지 하단)
import { readFileSync } from 'fs'
import { join } from 'path'
import { pickSimilarApts } from './_similar.js'

export const config = { regions: ['icn1'] }

let aptList = null
let discovery = null

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

const normalize = (s) => (s || '').replace(/\s/g, '').toLowerCase()

export default function handler(req, res) {
  const { names, kaptCode, avg, gu } = req.query

  // 모드 2: 비슷한 가격대 단지
  if (kaptCode) {
    const anchorAvg = avg != null && avg !== '' ? Number(avg) : undefined
    const result = pickSimilarApts(loadDiscovery(), { kaptCode, avg: anchorAvg, gu }, 6)
    return res.json(result)
  }

  // 모드 1: 이름 목록 매칭 (기존)
  if (!names) return res.status(400).json({ error: 'names 또는 kaptCode 필요' })

  const nameList = names.split(',').map(n => n.trim()).filter(Boolean)
  if (nameList.length === 0) return res.json([])

  const list = loadAptList()
  const matched = []
  const seen = new Set()

  for (const name of nameList) {
    const nm = normalize(name)
    if (!nm) continue
    const apt = list.find(a => {
      const kn = normalize(a.kaptName)
      return kn === nm || kn.includes(nm) || nm.includes(kn)
    })
    if (apt && !seen.has(apt.kaptCode)) {
      seen.add(apt.kaptCode)
      matched.push(apt)
    }
    if (matched.length >= 5) break
  }

  res.json(matched)
}
