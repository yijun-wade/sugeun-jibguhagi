// src/App.jsx
import { useState, useCallback, useEffect, useRef } from 'react'
import { DONG, HINT_SEARCHES } from './data.js'
import { getYM, getLifeConditions, getVerdict, calcPriceSignal, nameSim, buildPriceJudgment } from './utils.js'
import { FETCH_TIMEOUT, MIN_AREA_SQM } from './constants.js'
import EvalCard from './EvalCard.jsx'
import DetailReport from './DetailReport.jsx'

async function buildEvalData(apt) {
  const bjdCode = apt.bjdCode || null

  const addrParts = (apt.addr || '').split(' ')
  const dong = addrParts.find(p => p.endsWith('동') || p.endsWith('읍') || p.endsWith('면')) || addrParts[addrParts.length - 1] || ''
  const regionName = addrParts.find(p => p.endsWith('구') || p.endsWith('시') || p.endsWith('군')) || addrParts[addrParts.length - 2] || ''

  // stories는 bjdCode 유무와 무관하게 한 번만 호출 (#35)
  const storiesRes = await fetch(`/api/stories?aptName=${encodeURIComponent(apt.kaptName)}&location=${encodeURIComponent(dong)}`)
    .then(r => r.json()).catch(() => [])
  // 후기 대표 선택 — 임시 품질 기준: description이 가장 긴 결과 우선
  // (긴 본문 = 실거주 경험 서술 가능성 높음, 짧은 제목만 있는 광고성 글 후순위)
  // TODO: 향후 반복 언급 기반 요약(키워드 빈도 집계)으로 교체 예정.
  //       이 로직을 별도 함수 selectVoice(stories) 로 분리하면 교체가 쉬움.
  const voice = Array.isArray(storiesRes) && storiesRes.length > 0
    ? storiesRes.reduce((best, s) =>
        (s.description?.length || 0) > (best.description?.length || 0) ? s : best
      , storiesRes[0])
    : null

  if (!bjdCode) {
    return {
      kaptCode: apt.kaptCode,
      aptNm: apt.kaptName,
      dong,
      regionName,
      buildYear: apt.kaptBuldYy || '-',
      bjdCode: null,
      addr: apt.addr,
      recentAvg: 0,
      direction: '-',
      priceJudgment: { level: null, trend: null, sentence: null },
      lifeConditions: getLifeConditions(dong),
      verdict: '실거래 데이터 없음',
      voice,
    }
  }

  const lawdCd = bjdCode.slice(0, 5)
  const ymList = getYM(6)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  const tradeResults = await Promise.all(
    ymList.map(ym =>
      fetch(`/api/trade?lawdCd=${lawdCd}&dealYmd=${ym}`, { signal: controller.signal })
        .then(r => r.json())
        .catch(() => null)
    )
  ).finally(() => clearTimeout(timeout))

  const allTrades = []
  tradeResults.forEach(data => {
    if (!data) return
    if (data?.response?.header?.resultCode !== '00') return
    const items = data?.response?.body?.items?.item
    if (!items) return
    const arr = Array.isArray(items) ? items : [items]
    arr.forEach(item => {
      const nm   = (item.aptNm || '').trim()
      const amt  = parseInt((item.dealAmount || '').replace(/,/g, ''), 10)
      const area = parseFloat(item.excluUseAr) || 0
      if (nameSim(nm, apt.kaptName) < 0.6 || isNaN(amt) || area < MIN_AREA_SQM) return
      const dealYmd = `${item.dealYear}${String(item.dealMonth || 0).padStart(2,'0')}${String(item.dealDay || 0).padStart(2,'0')}`
      allTrades.push({ amt, area, dealYmd })
    })
  })

  allTrades.sort((a, b) => b.dealYmd.localeCompare(a.dealYmd))

  const cutoff = ymList[2]
  const recentTrades = allTrades.filter(t => t.dealYmd.slice(0, 6) >= cutoff)
  const olderTrades  = allTrades.filter(t => t.dealYmd.slice(0, 6) <  cutoff)
  const { recentAvg, direction } = calcPriceSignal(recentTrades, olderTrades)

  const priceJudgment = buildPriceJudgment(recentAvg, direction)

  const tag = (DONG[dong] || {}).tag || ''

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
    priceJudgment,
    lifeConditions: getLifeConditions(dong),
    verdict: getVerdict(tag),
    voice,
  }
}

export default function App() {
  const [query, setQuery]         = useState('')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [cards, setCards]         = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [errorType, setErrorType] = useState(null) // 'no-results' | 'load-fail' | 'network' | null
  const [detailApt, setDetailApt] = useState(null)

  // #37: finally로 setLoading 일원화
  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setError('아파트명이나 동네명을 입력해주세요')
      setTimeout(() => setError(null), 2000)
      inputRef.current?.focus()
      return
    }
    setLoading(true)
    setError(null)
    setErrorType(null)
    setCards([])
    setSearchedQuery('')
    setTotalCount(0)
    setDetailApt(null)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json())
      const list = Array.isArray(res) ? res.slice(0, 5) : []
      const total = Array.isArray(res) ? res.length : 0
      if (list.length === 0) {
        setError(`'${q}' 검색 결과가 없습니다. 아파트명이나 동네명으로 다시 검색해보세요.\n예: 반포자이, 망원동, 강남구`)
        setErrorType('no-results')
        return
      }
      const results = await Promise.all(list.map(apt => buildEvalData(apt).catch(() => null)))
      const filtered = results.filter(Boolean)
      if (filtered.length === 0) {
        setError('아파트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
        setErrorType('load-fail')
        return
      }
      setSearchedQuery(q)
      setCards(filtered)
      setTotalCount(total)
    } catch {
      setError('데이터를 불러오지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해주세요.')
      setErrorType('network')
    } finally {
      setLoading(false)
    }
  }, [])

  const goHome = useCallback(() => {
    setDetailApt(null)
    setCards([])
    setQuery('')
    setSearchedQuery('')
    setError(null)
    setErrorType(null)
    setTotalCount(0)
  }, [])

  const [suggestions, setSuggestions] = useState([])
  const [showSugg, setShowSugg]       = useState(false)
  const [activeSugg, setActiveSugg]   = useState(-1)
  const searchRef    = useRef(null)
  const inputRef     = useRef(null)
  const suggRef      = useRef(null)
  const debounceRef  = useRef(null)
  const suggAbortRef = useRef(null) // #36: race condition 방지

  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target) &&
          !(suggRef.current && suggRef.current.contains(e.target))) {
        setShowSugg(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => () => {
    clearTimeout(debounceRef.current)
    suggAbortRef.current?.abort()
  }, [])

  if (detailApt) {
    return (
      <div className="app">
        <header onClick={goHome} style={{ cursor: 'pointer' }}>
          <div className="brand">수근수근 우리집</div>
          <div className="brand-en">SooZip</div>
        </header>
        <DetailReport apt={detailApt} onBack={() => setDetailApt(null)} />
      </div>
    )
  }

  // #36: 이전 요청 abort 후 새 요청 시작
  const handleQueryChange = (e) => {
    const v = e.target.value
    setQuery(v)
    setActiveSugg(-1)
    clearTimeout(debounceRef.current)
    if (v.trim().length < 1) { setSuggestions([]); setShowSugg(false); return }
    debounceRef.current = setTimeout(async () => {
      suggAbortRef.current?.abort()
      const controller = new AbortController()
      suggAbortRef.current = controller
      const res = await fetch(`/api/search?q=${encodeURIComponent(v)}`, { signal: controller.signal })
        .then(r => r.json())
        .catch(e => (e.name === 'AbortError' ? null : []))
      if (res !== null) {
        setSuggestions(Array.isArray(res) ? res.slice(0, 6) : [])
        setShowSugg(true)
      }
    }, 200)
  }

  const pickSuggestion = (apt) => {
    setQuery(apt.kaptName)
    setSuggestions([])
    setShowSugg(false)
    handleSearch(apt.kaptName)
  }

  const handleKeyDown = (e) => {
    if (!showSugg || suggestions.length === 0) {
      if (e.key === 'Enter') handleSearch(query)
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSugg(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSugg(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeSugg >= 0) pickSuggestion(suggestions[activeSugg])
      else { setShowSugg(false); handleSearch(query) }
    }
    else if (e.key === 'Escape') setShowSugg(false)
  }

  const isHome = !cards.length && !loading && !error

  return (
    <div className={`app${isHome ? ' app-home' : ''}`}>

      {/* 홈: 구글식 히어로 */}
      {isHome && (
        <div className="hero">
          <div className="hero-brand" onClick={goHome} style={{ cursor: 'pointer' }}>
            <div className="hero-logo">수근수근 우리집</div>
            <div className="hero-logo-en">SooZip</div>
          </div>
          <div className="hero-sub">
            마음에 둔 아파트를 <em>수집</em>하세요<br />
            동네 분위기 · 실거주 후기 · 실거래가까지
          </div>
        </div>
      )}

      {/* 결과 있을 때만 상단 헤더 */}
      {!isHome && (
        <header onClick={goHome} style={{ cursor: 'pointer' }}>
          <div className="brand">수근수근 우리집</div>
          <div className="brand-en">SooZip</div>
        </header>
      )}

      <div className="search-wrap" ref={searchRef}>
        <div className="search-box">
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            aria-label="아파트 이름으로 검색"
            placeholder="아파트 이름으로 검색 (예: 반포자이)"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSugg(true)}
            autoComplete="off"
          />
          <button className="search-btn" onClick={() => { setShowSugg(false); handleSearch(query) }}>검색</button>
        </div>
        {showSugg && suggestions.length > 0 && (
          <ul className="sugg-list" ref={suggRef}>
            {suggestions.map((apt, i) => (
              <li
                key={apt.kaptCode}
                className={`sugg-item${i === activeSugg ? ' active' : ''}`}
                onPointerDown={(e) => { e.preventDefault(); pickSuggestion(apt) }}
              >
                <span className="sugg-name">{apt.kaptName}</span>
                <span className="sugg-addr">{apt.addr?.split(' ').slice(0, 3).join(' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isHome && (
        <div className="hint-searches">
          {HINT_SEARCHES.map(h => (
            <button key={h} className="hint-chip" onClick={() => { setQuery(h); handleSearch(h) }}>
              {h}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="loading-msg">임장 데이터 수집 중...</div>}
      {error && (
        <div className="error-block">
          <div className="error-msg" style={{ whiteSpace: 'pre-line' }}>{error}</div>
          {(errorType === 'no-results' || errorType === 'load-fail' || errorType === 'network') && (
            <button
              className="retry-btn"
              onClick={() => {
                if (errorType === 'no-results') {
                  inputRef.current?.focus()
                } else {
                  handleSearch(query)
                }
              }}
            >
              {errorType === 'no-results' ? '다시 검색하기' : '다시 시도하기'}
            </button>
          )}
          {errorType === 'no-results' && (
            <div className="hint-searches hint-searches--error">
              {HINT_SEARCHES.map(h => (
                <button key={h} className="hint-chip" onClick={() => { setQuery(h); handleSearch(h) }}>
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {cards.length > 0 && (
        <div className="result-section">
          <div className="search-result-header">
            <span className="search-result-title">
              '{searchedQuery}' 검색 결과
            </span>
            <span className="search-result-count">
              {totalCount <= cards.length
                ? `${cards.length}개`
                : `${cards.length}개 표시 / 전체 ${totalCount}개`}
            </span>
          </div>
          {totalCount > cards.length && (
            <div className="search-more-hint">
              검색 결과가 더 있어요. 아파트명이나 도로명을 함께 입력하면 더 정확하게 찾을 수 있어요.
            </div>
          )}
          <div className="card-list">
            {cards.map((apt) => (
              <EvalCard key={apt.kaptCode} apt={apt} onDetail={() => setDetailApt(apt)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
