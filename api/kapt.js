// K-APT 공동주택 기본정보 — 세대수, 난방방식, 건축연도
export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  const { kaptCode } = req.query
  if (!kaptCode) return res.status(400).json({ error: 'kaptCode 필요' })

  const key = process.env.MOLIT_API_KEY
  if (!key) return res.status(500).json({ error: 'API 키 없음' })

  try {
    const url = `https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4` +
      `?serviceKey=${key}&kaptCode=${kaptCode}&_type=json`

    const r = await fetch(url)
    if (!r.ok) return res.status(502).json({ error: `API ${r.status}` })

    const data = await r.json()
    const item = data?.response?.body?.items?.item

    if (!item) return res.json(null)

    const obj = Array.isArray(item) ? item[0] : item
    return res.json({
      세대수:   obj.kaptMgCnt  || obj.kaptdaCnt || null,
      난방방식:  obj.heatMethodNm || null,
      난방연료:  obj.heatFuelNm  || null,
      건축연도:  obj.kaptBldYe   || null,
      동수:     obj.kaptDaCnt   || null,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
