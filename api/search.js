// 국토교통부_공동주택 단지 목록 API — 이름으로 아파트 검색
export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  const { q } = req.query
  const KEY = process.env.MOLIT_API_KEY
  if (!KEY) return res.status(500).json({ error: 'API 키가 없어요' })
  if (!q || q.trim().length < 1) return res.json([])

  const url = `https://apis.data.go.kr/1613000/AptListService3/getTotalAptList3?serviceKey=${KEY}&kaptName=${encodeURIComponent(q.trim())}&numOfRows=20&pageNo=1&_type=json`
  try {
    const r = await fetch(url)
    if (!r.ok) return res.status(502).json({ error: 'API 오류', status: r.status })
    const data = await r.json()
    const items = data?.response?.body?.items?.item
    if (!items) return res.json([])
    const arr = Array.isArray(items) ? items : [items]
    return res.json(arr.slice(0, 20).map(i => ({ kaptCode: i.kaptCode, kaptName: i.kaptName })))
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
