// 내 주변 아파트 — 카카오 Places에서 받은 이름 목록으로 apt-list.json 매칭
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

const normalize = (s) => (s || '').replace(/\s/g, '').toLowerCase()

export default function handler(req, res) {
  const { names } = req.query
  if (!names) return res.status(400).json({ error: 'names 필요' })

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
