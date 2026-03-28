// src/App.jsx
import { useState, useCallback } from 'react'
import { DONG, HINT_SEARCHES } from './data.js'
import { fP, getYM, getLifeConditions, getVerdict, calcPriceSignal, nameSim } from './utils.js'
import EvalCard from './EvalCard.jsx'
import DetailReport from './DetailReport.jsx'

/* ── 검색 API 호출 후 EvalCard에 필요한 데이터 조립 ── */
async function buildEvalData(apt) {
  // 1) apt-info로 bjdCode(lawdCd) 확보
  const infoRes = await fetch(`/api/apt-info?kaptCode=${apt.kaptCode}`).then(r => r.json()).catch(() => null)
  const bjdCode = infoRes?.data?.bjdCode || null
  if (!bjdCode) return null

  const lawdCd = bjdCode.slice(0, 5)
  const ymList = getYM(6) // 6개월치

  // 2) 실거래 데이터
  const tradeResults = await Promise.all(
    ymList.map(ym =>
      fetch(`/api/trade?lawdCd=${lawdCd}&dealYmd=${ym}`)
        .then(r => r.json())
        .catch(() => null)
    )
  )

  const allTrades = []
  tradeResults.forEach(data => {
    if (!data) return
    const items = data?.response?.body?.items?.item
    if (!items) return
    const arr = Array.isArray(items) ? items : [items]
    arr.forEach(item => {
      const nm  = (item.aptNm || '').trim()
      const amt = parseInt((item.dealAmount || '').replace(/,/g, ''))
      if (nameSim(nm, apt.kaptName) < 0.6 || isNaN(amt)) return
      allTrades.push({ amt, area: parseFloat(item.excluUseAr) || 0 })
    })
  })

  // 3) 가격 신호 계산 (앞 3개월 vs 뒤 3개월)
  const recent = allTrades.slice(0, Math.ceil(allTrades.length / 2))
  const older  = allTrades.slice(Math.ceil(allTrades.length / 2))
  const { recentAvg, olderAvg, direction } = calcPriceSignal(recent, older)

  // 4) 가격 레이블 (6억 기준)
  let priceLabel = '적정'
  if (recentAvg > 80000) priceLabel = '비쌈'
  else if (recentAvg < 40000) priceLabel = '저렴'

  // 5) 동 추출 (addr: "서울특별시 양천구 목동")
  const addrParts = (apt.addr || '').split(' ')
  const dong = addrParts[addrParts.length - 1] || ''
  const regionName = addrParts[addrParts.length - 2] || ''

  // 6) 생활 여건 / 한줄 판단
  const lifeConditions = getLifeConditions(dong)
  const tag = (DONG[dong] || {}).tag || ''
  const verdict = getVerdict(tag, priceLabel)

  // 7) 실거주 이야기 (첫 번째 1개만 voice로)
  const storiesRes = await fetch(`/api/stories?aptName=${encodeURIComponent(apt.kaptName)}&location=${encodeURIComponent(dong)}`)
    .then(r => r.json()).catch(() => [])
  const voice = Array.isArray(storiesRes) && storiesRes.length > 0 ? storiesRes[0] : null

  return {
    kaptCode: apt.kaptCode,
    aptNm: apt.kaptName,
    dong,
    regionName,
    buildYear: apt.kaptBuldYy || '-',
    bjdCode,
    addr: apt.addr,
    recentAvg,
    direction,
    priceLabel,
    lifeConditions,
    verdict,
    voice,
  }
}

/* ── 메인 앱 ─────────────────────────────── */
export default function App() {
  const [query, setQuery]         = useState('')
  const [cards, setCards]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [detailApt, setDetailApt] = useState(null)

  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setCards([])
    setDetailApt(null)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json())
      const list = Array.isArray(res) ? res.slice(0, 5) : []
      if (list.length === 0) { setError('검색 결과가 없습니다'); setLoading(false); return }

      const results = await Promise.all(list.map(apt => buildEvalData(apt)))
      setCards(results.filter(Boolean))
    } catch (e) {
      setError('데이터를 불러오는 중 오류가 발생했습니다')
    }
    setLoading(false)
  }, [])

  // 상세 리포트 보기
  if (detailApt) {
    return (
      <div className="app">
        <header>
          <div className="brand">수근수근 집구하기</div>
          <div className="brand-sub">온라인 임장 도구</div>
        </header>
        <DetailReport apt={detailApt} onBack={() => setDetailApt(null)} />
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <div className="brand">수근수근 집구하기</div>
        <div className="brand-sub">아파트 이름을 검색하면 가격·동네·실거주 후기를 한 번에</div>
      </header>

      {/* 검색창 */}
      <div className="search-wrap">
        <input
          className="search-input"
          type="text"
          placeholder="아파트 이름 검색 (예: 래미안 원베일리)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
        />
        <button className="search-btn" onClick={() => handleSearch(query)}>검색</button>
      </div>

      {/* 힌트 검색어 */}
      {!cards.length && !loading && (
        <div className="hint-searches">
          {HINT_SEARCHES.map(h => (
            <button key={h} className="hint-chip" onClick={() => { setQuery(h); handleSearch(h) }}>
              {h}
            </button>
          ))}
        </div>
      )}

      {/* 로딩 */}
      {loading && <div className="loading-msg">임장 데이터 수집 중...</div>}

      {/* 에러 */}
      {error && <div className="error-msg">{error}</div>}

      {/* 카드 목록 */}
      {cards.length > 0 && (
        <div className="card-list">
          {cards.map((apt, i) => (
            <EvalCard key={i} apt={apt} onDetail={() => setDetailApt(apt)} />
          ))}
        </div>
      )}
    </div>
  )
}
