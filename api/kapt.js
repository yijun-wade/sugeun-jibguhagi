// K-APT 공동주택 기본정보 — 세대수, 난방방식, 건축연도
export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  const { kaptCode } = req.query
  if (!kaptCode) return res.status(400).json({ error: 'kaptCode 필요' })

  const key = (process.env.MOLIT_API_KEY || '').trim()
  if (!key) return res.status(500).json({ error: 'API 키 없음' })

  try {
    const url = `https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4` +
      `?serviceKey=${key}&kaptCode=${kaptCode}&_type=json`

    const r = await fetch(url)
    if (!r.ok) return res.status(502).json({ error: `API ${r.status}` })

    // 공공데이터포털은 인증 실패도 200 + 본문 오류로 준다. 그대로 두면
    // "데이터 없음(null)"과 구분되지 않아 조용히 빈 화면이 나간다.
    // 실제로 744세대 단지에도 null이 나가고 있었다(2026-08-20).
    const text = await r.text()
    if (/SERVICE_KEY|등록되지 않은|SERVICE_ACCESS_DENIED|LIMITED_NUMBER/.test(text)) {
      console.error('[kapt] 공공데이터포털 인증 실패')
      return res.status(502).json({ error: '데이터 제공처 인증 실패' })
    }
    let data
    try { data = JSON.parse(text) }
    catch { return res.status(502).json({ error: '데이터 제공처 응답 형식 오류' }) }
    // K-APT(AptBasisInfoService)는 body.item(단수)로 준다. 다른 공공데이터 API가
    // body.items.item(복수 래퍼)인 것과 달라서, 후자만 읽으면 항상 undefined가 되고
    // "데이터 없음(null)"으로 나간다. 키와 무관하게 계속 null이었다(2026-08-20 확인).
    const item = data?.response?.body?.items?.item ?? data?.response?.body?.item

    if (!item) return res.json(null)

    const obj = Array.isArray(item) ? item[0] : item
    const 세대수 = obj.kaptdaCnt || obj.hoCnt || null
    const 건축연도 = obj.kaptUsedate
      ? parseInt(obj.kaptUsedate.slice(0, 4)) || null
      : null

    return res.json({
      세대수:   세대수 ? Math.round(세대수) : null,
      난방방식:  obj.codeHeatNm || null,
      건축연도,
      동수:     obj.kaptDongCnt ? parseInt(obj.kaptDongCnt) : null,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
