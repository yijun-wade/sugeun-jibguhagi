// Vercel 서버리스 함수 — 국토부 실거래가 API 프록시 (단지 상세용, JSON)
export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  const { lawdCd, dealYmd } = req.query
  const serviceKey = process.env.MOLIT_API_KEY
  if (!serviceKey) return res.status(500).json({ error: 'API 키가 설정되지 않았어요' })
  if (!lawdCd || !dealYmd) return res.status(400).json({ error: 'lawdCd, dealYmd 파라미터가 필요해요' })

  const apiUrl = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade` +
    `?serviceKey=${serviceKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=1000&pageNo=1&_type=json`

  try {
    const response = await fetch(apiUrl)
    if (!response.ok) {
      console.warn(`국토부 API ${response.status}: ${lawdCd} ${dealYmd}`)
      return res.status(502).json({ error: 'API 오류', status: response.status })
    }
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { return res.status(502).json({ error: 'JSON 파싱 실패' }) }
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: '실거래가 데이터를 가져오지 못했어요', detail: err.message })
  }
}
