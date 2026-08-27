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

    // 아파트 이름으로 매칭.
    //
    // 예전 로직은 `bldNm.includes(nm) || nm.includes(bldNm)` 였는데,
    // bldNm이 빈 문자열이면 nm.includes('')가 항상 true라 건물명 없는 레코드가
    // 무조건 먼저 잡혔다. 신천동은 10건 중 5건이 무명이라, 6864세대 파크리오
    // 데이터가 멀쩡히 있는데도 전부 null이 나갔다(2026-08-27 확인).
    const norm = (v) => String(v || '').replace(/\s|아파트|단지/g, '')
    const nm = norm(aptName)
    const named = list.filter((i) => norm(i.bldNm))

    let matched = null
    if (nm) {
      matched = named.find((i) => {
        const b = norm(i.bldNm)
        return b === nm || b.includes(nm) || nm.includes(b)
      }) || null
    }

    // 이름으로 못 찾으면 세대수가 가장 많은 레코드를 쓴다.
    // 무조건 list[0]을 집으면 학교·상가 같은 엉뚱한 건물이 나온다.
    if (!matched) {
      matched = list
        .slice()
        .sort((a, b) => (parseInt(b.hhldCnt) || 0) - (parseInt(a.hhldCnt) || 0))
        .find((i) => (parseInt(i.hhldCnt) || 0) > 0) || null
    }

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
      건물명:   (matched.bldNm || '').trim() || null,
      // 이름으로 찾은 것인지 세대수로 추정한 것인지 밝힌다.
      // 추정값을 확정처럼 보여주면 사용자가 다른 건물 정보를 믿게 된다.
      매칭:     nm && norm(matched.bldNm) && (norm(matched.bldNm).includes(nm) || nm.includes(norm(matched.bldNm))) ? '이름' : '추정',
    })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
