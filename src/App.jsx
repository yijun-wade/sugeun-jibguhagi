// src/App.jsx
import { useState, useCallback } from 'react'
import { DONG, HINT_SEARCHES } from './data.js'
import { getYM, getLifeConditions, getVerdict, calcPriceSignal, nameSim } from './utils.js'
import EvalCard from './EvalCard.jsx'
import DetailReport from './DetailReport.jsx'

async function buildEvalData(apt) {
  const infoRes = await fetch(`/api/apt-info?kaptCode=${apt.kaptCode}`).then(r => r.json()).catch(() => null)
  const bjdCode = infoRes?.bjdCode || null
  if (!bjdCode) return null

  const lawdCd = bjdCode.slice(0, 5)
  const ymList = getYM(6)

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

  const half = Math.ceil(allTrades.length / 2)
  const { recentAvg, direction } = calcPriceSignal(allTrades.slice(0, half), allTrades.slice(half))

  let priceLabel = '적정'
  if (recentAvg > 80000) priceLabel = '비쌈'
  else if (recentAvg < 40000) priceLabel = '저렴'

  const addrParts = (infoRes?.addr || apt.addr || '').split(' ')
  const dong = addrParts[addrParts.length - 1] || ''
  const regionName = addrParts[addrParts.length - 2] || ''

  const lifeConditions = getLifeConditions(dong)
  const tag = (DONG[dong] || {}).tag || ''
  const verdict = getVerdict(tag, priceLabel)

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

export default function App() {
  const [query, setQuery]       = useState('')
  const [cards, setCards]       = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
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
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다')
    }
    setLoading(false)
  }, [])

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

      {!cards.length && !loading && (
        <div className="hint-searches">
          {HINT_SEARCHES.map(h => (
            <button key={h} className="hint-chip" onClick={() => { setQuery(h); handleSearch(h) }}>
              {h}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="loading-msg">임장 데이터 수집 중...</div>}
      {error   && <div className="error-msg">{error}</div>}

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
