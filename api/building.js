// 건축물대장 총괄표제부 — 용적률, 주차대수, 건폐율
export const config = { regions: ['icn1'] }

export default async function handler(req, res) {
  const { bjdCode, aptName } = req.query
  if (!bjdCode) return res.status(400).json({ error: 'bjdCode 필요' })

  const key = (process.env.MOLIT_API_KEY || '').trim()
  if (!key) return res.status(500).json({ error: 'API 키 없음' })

  // bjdCode 10자리 → sigunguCd(5) + bjdongCd(5)
  const sigunguCd = bjdCode.slice(0, 5)
  const bjdongCd  = bjdCode.slice(5, 10)

  try {
    const url = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrRecapTitleInfo` +
      `?serviceKey=${key}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}` +
      `&numOfRows=100&pageNo=1&_type=json`

    const r = await fetch(url)
    if (!r.ok) return res.status(502).json({ error: `API ${r.status}` })

    // 공공데이터포털은 인증 실패도 200 + 본문 오류로 준다. 그대로 두면
    // "데이터 없음(null)"과 구분되지 않아 조용히 빈 화면이 나간다.
    // 실제로 744세대 단지에도 null이 나가고 있었다(2026-08-20).
    const text = await r.text()
    if (/SERVICE_KEY|등록되지 않은|SERVICE_ACCESS_DENIED|LIMITED_NUMBER/.test(text)) {
      console.error('[building] 공공데이터포털 인증 실패')
      return res.status(502).json({ error: '데이터 제공처 인증 실패' })
    }
    let data
    try { data = JSON.parse(text) }
    catch { return res.status(502).json({ error: '데이터 제공처 응답 형식 오류' }) }
    const items = data?.response?.body?.items?.item
    if (!items) return res.json(null)

    const list = Array.isArray(items) ? items : [items]

    // 아파트 이름으로 필터링 (부분 일치)
    const nm = (aptName || '').replace(/\s/g, '')
    const matched = list.find(i => {
      const bldNm = (i.bldNm || '').replace(/\s/g, '')
      return bldNm.includes(nm) || nm.includes(bldNm)
    }) || list[0]  // fallback: 첫 번째 항목

    if (!matched) return res.json(null)

    // 주차대수 = 옥내자주식 + 옥외자주식 + 기계식 합산
    const parking =
      (parseInt(matched.totPkngCnt)     || 0) ||
      (parseInt(matched.indrAutoUtcnt)  || 0) +
      (parseInt(matched.oudrAutoUtcnt)  || 0) +
      (parseInt(matched.indrMechUtcnt)  || 0) +
      (parseInt(matched.oudrMechUtcnt)  || 0)

    const vlRat = parseFloat(matched.vlRat)
    const bcRat = parseFloat(matched.bcRat)

    return res.json({
      용적률:   (vlRat && vlRat > 0) ? Math.round(vlRat) : null,
      건폐율:   (bcRat && bcRat > 0) ? Math.round(bcRat) : null,
      주차대수:  parking || null,
      세대수_건축:  matched.hhldCnt ? parseInt(matched.hhldCnt) : null,
      건물명:   matched.bldNm  || null,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
