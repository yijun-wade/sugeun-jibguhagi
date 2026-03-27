// Vercel 서버리스 함수 — 국토부 실거래가 API 프록시 (지역 탐색용, XML 대량 조회)
export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  const { lawd_cd, deal_ymd } = req.query
  const serviceKey = process.env.MOLIT_API_KEY
  if (!serviceKey) return res.status(500).json({ error: 'API 키가 설정되지 않았어요' })
  if (!lawd_cd || !deal_ymd) return res.status(400).json({ error: 'lawd_cd, deal_ymd 파라미터가 필요합니다' })

  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev` +
    `?serviceKey=${serviceKey}&LAWD_CD=${lawd_cd}&DEAL_YMD=${deal_ymd}&pageNo=1&numOfRows=9999`

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/xml' },
    })
    const xml = await response.text()
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
    res.send(xml)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
