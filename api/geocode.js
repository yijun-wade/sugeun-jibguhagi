// Nominatim 프록시 — 서버 사이드 캐싱(최대 200개) + 쓰로틀링
export const config = { regions: ['icn1'] }

const MAX_CACHE = 200
const cache = new Map()
let lastCall = 0 // 서버리스 인스턴스 내 스로틀 (다중 인스턴스 간 비공유 — 최선 노력)

function setCache(key, value) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value) // FIFO
  cache.set(key, value)
}

export default async function handler(req, res) {
  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'q 파라미터가 필요해요' })

  if (cache.has(q)) return res.json(cache.get(q))

  const now = Date.now()
  const wait = 1100 - (now - lastCall)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastCall = Date.now()

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=kr`,
      { headers: { 'User-Agent': 'sugeun-jibguhagi/1.0' } }
    )
    if (!r.ok) return res.status(502).json([])
    const data = await r.json()
    setCache(q, data)
    return res.json(data)
  } catch (e) {
    return res.status(500).json([])
  }
}
