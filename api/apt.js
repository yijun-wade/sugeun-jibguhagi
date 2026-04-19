// api/apt.js — kaptCode로 아파트 단건 조회
import { readFileSync } from 'fs'
import { join } from 'path'
import { setCors } from './_utils.js'

let aptList = null
let enrichMap = null

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
    enrichMap = new Map(data.map(a => [a.kaptCode, { kaptdaCnt: a.kaptdaCnt, useAprDay: a.useAprDay }]))
  } catch {
    enrichMap = new Map()
  }
  return enrichMap
}

export default function handler(req, res) {
  if (setCors(req, res)) return
  const { kaptCode } = req.query
  if (!kaptCode) return res.status(400).json({ error: 'kaptCode required' })

  const list = loadAptList()
  const apt = list.find(a => a.kaptCode === kaptCode)
  if (!apt) return res.status(404).json({ error: 'not found' })

  const enrich = loadEnrichMap()
  const extra = enrich.get(kaptCode)
  return res.json(extra ? { ...apt, kaptdaCnt: extra.kaptdaCnt, useAprDay: extra.useAprDay } : apt)
}
