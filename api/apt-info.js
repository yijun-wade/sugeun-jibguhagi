// 국토교통부_공동주택 기본 정보 API — 단지코드로 bjdCode 조회
export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  const { kaptCode } = req.query
  const KEY = process.env.MOLIT_API_KEY
  if (!KEY) return res.status(500).json({ error: 'API 키가 없어요' })
  if (!kaptCode) return res.status(400).json({ error: 'kaptCode가 필요해요' })

  const url = `https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4?serviceKey=${KEY}&kaptCode=${kaptCode}&numOfRows=1&pageNo=1&_type=json`
  try {
    const r = await fetch(url)
    if (!r.ok) return res.status(502).json({ error: 'API 오류', status: r.status })
    const data = await r.json()
    const item = data?.response?.body?.items?.item
    if (!item) return res.json(null)
    const info = Array.isArray(item) ? item[0] : item
    return res.json({ kaptName: info.kaptName, bjdCode: info.bjdCode, addr: info.kaptAddr })
  } catch (e) { return res.status(500).json({ error: e.message }) }
}
