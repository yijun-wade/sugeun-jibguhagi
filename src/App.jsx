// src/App.jsx
import { useState, useCallback, useEffect, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import { Routes, Route, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { DONG, HINT_SEARCHES } from './data.js'
import { getYM, getLifeConditions, getVerdict, calcPriceSignal, nameSim, buildPriceJudgment } from './utils.js'
import { FETCH_TIMEOUT, MIN_AREA_SQM } from './constants.js'
import EvalCard from './EvalCard.jsx'
import DetailReport from './DetailReport.jsx'
import AptDetailPage from './AptDetailPage.jsx'
import BriefingPage from './BriefingPage.jsx'
import GlossaryPage from './GlossaryPage.jsx'
import PolicyPage from './PolicyPage.jsx'
import { track } from './analytics.js'
import AdUnit from './AdUnit.jsx'
import { getCollection, toggleCollection } from './collection.js'
import CompareView from './CompareView.jsx'

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
      buildYear: apt.useAprDay ? apt.useAprDay.slice(0, 4) : (apt.kaptBuldYy || '-'),
      bjdCode: null,
      addr: apt.addr,
      recentAvg: 0,
      olderAvg: 0,
      direction: '-',
      priceJudgment: { level: null, trend: null, sentence: null },
      lifeConditions: getLifeConditions(dong),
      verdict: apt.summary || '실거래 데이터 없음',
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
    if (!['00', '000'].includes(data?.response?.header?.resultCode)) return
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
  const { recentAvg, olderAvg, direction } = calcPriceSignal(recentTrades, olderTrades)

  const priceJudgment = buildPriceJudgment(recentAvg, direction)

  const tag = (DONG[dong] || {}).tag || ''

  return {
    kaptCode: apt.kaptCode,
    aptNm: apt.kaptName,
    dong,
    regionName,
    buildYear: apt.useAprDay ? apt.useAprDay.slice(0, 4) : (apt.kaptBuldYy || '-'),
    bjdCode,
    addr: apt.addr,
    recentAvg,
    olderAvg,
    direction,
    priceJudgment,
    lifeConditions: getLifeConditions(dong),
    verdict: apt.summary || getVerdict(tag, dong),
    voice,
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/apt/:kaptCode" element={<AptDetailPage />} />
      <Route path="/briefing" element={<BriefingPage />} />
      <Route path="/briefing/:date" element={<BriefingPage />} />
      <Route path="/glossary" element={<GlossaryPage />} />
      <Route path="/policy" element={<PolicyPage />} />
      <Route path="*" element={<SearchApp />} />
    </Routes>
  )
}

function SearchApp() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [query, setQuery]         = useState(() => searchParams.get('q') || '')
  const [searchedQuery, setSearchedQuery] = useState('')
  const [cards, setCards]         = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading]     = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]         = useState(null)
  const [errorType, setErrorType] = useState(null) // 'no-results' | 'load-fail' | 'network' | null
  const [nearbyState, setNearbyState] = useState('idle') // 'idle' | 'loading' | 'done' | 'error' | 'denied'
  const [nearbyApts, setNearbyApts] = useState([])
  const [collection, setCollection] = useState(() => getCollection())
  const [resultTab, setResultTab] = useState('search') // 'search' | 'collection'
  const [compareSelected, setCompareSelected] = useState([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [heroIdx, setHeroIdx] = useState(0)
  const heroImages = ['/hero-1.jpg', '/hero-2.jpg', '/hero-3.jpg']
  const [searchMode, setSearchMode] = useState('name') // 'name' | 'discover'
  const [discoverData, setDiscoverData] = useState(null)
  const [selectedGu, setSelectedGu] = useState(null)
  const [selectedPrice, setSelectedPrice] = useState(null)

  useEffect(() => {
    if (searchMode === 'discover' && !discoverData) {
      fetch('/apt-discovery.json').then(r => r.json()).then(setDiscoverData).catch(() => {})
    }
  }, [searchMode, discoverData])

  // 라우트 변경 시 page_view 이벤트
  useEffect(() => {
    const path = location.pathname
    const pageType = path === '/' ? 'home'
      : path.startsWith('/apt') ? 'apt_detail'
      : path.startsWith('/briefing') ? 'briefing'
      : path === '/policy' ? 'policy'
      : path === '/glossary' ? 'glossary'
      : path.startsWith('/search') ? 'search'
      : 'other'
    track('page_view', { page_path: path, page_type: pageType, search_query: searchParams.get('q') || undefined })
  }, [location.pathname])

  // URL ?q= 파라미터로 진입 시 자동 검색
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      handleSearch(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleCompareSelect(apt) {
    setCompareSelected(prev => {
      const exists = prev.find(a => a.kaptCode === apt.kaptCode)
      if (exists) {
        track('compare_deselect', { apt_name: apt.aptNm, region: apt.regionName })
        return prev.filter(a => a.kaptCode !== apt.kaptCode)
      }
      if (prev.length >= 3) return prev
      track('compare_select', { apt_name: apt.aptNm, region: apt.regionName, total_selected: prev.length + 1 })
      return [...prev, apt]
    })
  }

  function handleRemoveFromCollection(apt) {
    const next = toggleCollection(apt)
    setCollection(next)
    setCompareSelected(prev => prev.filter(a => a.kaptCode !== apt.kaptCode))
    track('collect_delete', { apt_name: apt.aptNm, region: apt.regionName })
  }

  const LOADING_MSGS = [
    '아파트 매매 실거래가 조회 중...',
    '커뮤니티 후기 검색 중...',
    '동네 분위기 파악 중...',
    '여러 정보를 모아 정리하는 중...',
  ]
  const loadingMsgRef = useRef(null)

  // #37: finally로 setLoading 일원화
  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setError('아파트명이나 동네명을 입력해주세요')
      clearTimeout(emptyQueryTimerRef.current)
      emptyQueryTimerRef.current = setTimeout(() => setError(null), 2000)
      inputRef.current?.focus()
      return
    }
    clearTimeout(emptyQueryTimerRef.current)
    // URL 업데이트 (검색 히스토리 생성)
    navigate(`/search?q=${encodeURIComponent(q)}`, { replace: false })
    setLoading(true)
    setLoadingMsg(LOADING_MSGS[0])
    let msgIdx = 1
    loadingMsgRef.current = setInterval(() => {
      setLoadingMsg(LOADING_MSGS[msgIdx % LOADING_MSGS.length])
      msgIdx++
    }, 2000)
    setError(null)
    setErrorType(null)
    setCards([])
    setSearchedQuery('')
    setTotalCount(0)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json())
      const list = Array.isArray(res) ? res.slice(0, 5) : []
      const total = Array.isArray(res) ? res.length : 0
      if (list.length === 0) {
        setError(`'${q}' 검색 결과가 없습니다. 아파트명이나 동네명으로 다시 검색해보세요.\n예: 반포자이, 망원동, 강남구`)
        setErrorType('no-results')
        track('search_no_results', { query: q })
        return
      }
      const results = await Promise.all(list.map(apt => buildEvalData(apt).catch(() => null)))
      const filtered = results.filter(Boolean)
      if (filtered.length === 0) {
        setError('아파트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
        setErrorType('load-fail')
        track('search_error', { query: q, error_type: 'load_fail' })
        return
      }
      setSearchedQuery(q)
      setCards(filtered)
      setTotalCount(total)
      track('search', { query: q, result_count: total })
    } catch {
      setError('데이터를 불러오지 못했습니다. 네트워크를 확인하거나 잠시 후 다시 시도해주세요.')
      setErrorType('network')
      track('search_error', { query: q, error_type: 'network' })
    } finally {
      clearInterval(loadingMsgRef.current)
      setLoading(false)
    }
  }, [navigate])

  const goHome = useCallback(() => {
    setCards([])
    setQuery('')
    setSearchedQuery('')
    setError(null)
    setErrorType(null)
    setTotalCount(0)
    navigate('/')
  }, [navigate])

  const handleNearby = useCallback(() => {
    if (!navigator.geolocation) {
      setNearbyState('error')
      return
    }
    setNearbyState('loading')
    setNearbyApts([])
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const kakao = window.kakao
        if (!kakao?.maps?.services) {
          setNearbyState('error')
          return
        }
        const ps = new kakao.maps.services.Places()
        const center = new kakao.maps.LatLng(lat, lng)
        ps.keywordSearch('아파트', (results, status) => {
          if (status !== kakao.maps.services.Status.OK || !results?.length) {
            setNearbyState('error')
            return
          }
          const names = results.slice(0, 15).map(r => r.place_name).join(',')
          fetch(`/api/nearby?names=${encodeURIComponent(names)}`)
            .then(r => r.json())
            .then(data => {
              if (Array.isArray(data) && data.length > 0) {
                setNearbyApts(data)
                setNearbyState('done')
              } else {
                setNearbyState('error')
              }
            })
            .catch(() => setNearbyState('error'))
        }, { location: center, radius: 3000, sort: kakao.maps.services.SortBy.DISTANCE })
      },
      (err) => {
        setNearbyState(err.code === 1 ? 'denied' : 'error')
      },
      { timeout: 10000 }
    )
  }, [])

  const [suggestions, setSuggestions] = useState([])
  const [showSugg, setShowSugg]       = useState(false)
  const [activeSugg, setActiveSugg]   = useState(-1)
  const searchRef    = useRef(null)
  const inputRef     = useRef(null)
  const suggRef      = useRef(null)
  const debounceRef      = useRef(null)
  const suggAbortRef     = useRef(null) // #36: race condition 방지
  const emptyQueryTimerRef = useRef(null)

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
    clearInterval(loadingMsgRef.current)
    suggAbortRef.current?.abort()
  }, [])

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
    track('suggestion_click', { apt_name: apt.kaptName, addr: apt.addr?.split(' ').slice(1, 3).join(' ') })
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

  useEffect(() => {
    if (!isHome) return
    const timer = setInterval(() => setHeroIdx(i => (i + 1) % 3), 4500)
    return () => clearInterval(timer)
  }, [isHome])

  const metaTitle = searchedQuery
    ? `'${searchedQuery}' 검색 결과 · 수군수군 우리집`
    : '수군수군 우리집 · SuZip — 아파트 실거주 후기 & 동네 분위기'
  const metaDesc = searchedQuery
    ? `${searchedQuery} 아파트 실거주 후기, 동네 분위기, 실거래가를 확인하세요.`
    : '퇴근 후 이불 속에서 하는 임장. 발품 팔기 전에 수군수군 먼저 — 동네 분위기, 실거주 후기, 실거래가까지.'

  return (
    <div className={`app${isHome ? ' app-home' : ''}`}>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        {searchedQuery && <meta name="robots" content="noindex, follow" />}
      </Helmet>

      {/* 항상 표시되는 통합 헤더 */}
      <header className="site-header">
        <a href="/" className="site-header-logo">
          <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
        </a>
        <nav className="site-header-nav">
          <a href="/" className="site-nav-link site-nav-active">이불 속 임장</a>
          <a href="/briefing" className="site-nav-link">이불 속 뉴스</a>
          <a href="/policy" className="site-nav-link">이불 속 정책</a>
          <a href="/glossary" className="site-nav-link"><span className="nav-bubble">이불 속</span> 사전</a>
        </nav>
      </header>

      {/* 홈 서브탭 — 헤더 바로 아래 */}
      {isHome && (
        <div className="home-sub-tabs">
          <button className={`home-sub-tab${searchMode === 'name' ? ' on' : ''}`} onClick={() => { setSearchMode('name'); track('search_mode_switch', { mode: 'name' }) }}>
            이름으로 검색
          </button>
          <button className={`home-sub-tab${searchMode === 'discover' ? ' on' : ''}`} onClick={() => { setSearchMode('discover'); track('search_mode_switch', { mode: 'discover' }) }}>
            동네·가격으로 탐색
          </button>
        </div>
      )}

      {/* 홈: OG 이미지 히어로 */}
      {isHome && (
        <img
          src="/ogimage.png"
          alt="퇴근 후 이불 속에서 하는 임장 — 수군수군 우리집"
          className="hero-og-img"
        />
      )}


      {/* Discovery 모드 */}
      {isHome && searchMode === 'discover' && (
        <DiscoveryPanel
          data={discoverData}
          selectedGu={selectedGu}
          setSelectedGu={setSelectedGu}
          selectedPrice={selectedPrice}
          setSelectedPrice={setSelectedPrice}
          onSelect={(apt) => {
            track('discover_apt_click', { apt_name: apt.name, gu: apt.gu, avg: apt.avg, from: 'discover' })
            setSearchMode('name'); setQuery(apt.name); handleSearch(apt.name)
          }}
        />
      )}

      {/* 검색창 (이름 검색 모드에서만) */}
      <div className="search-wrap" ref={searchRef} style={isHome && searchMode === 'discover' ? { display: 'none' } : {}}>
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
                <span className="sugg-meta">
                  <span className="sugg-addr">{apt.addr?.split(' ').slice(1, 4).join(' ')}</span>
                  {apt.kaptdaCnt && <span className="sugg-cnt">{apt.kaptdaCnt.toLocaleString()}세대</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isHome && (
        <>
          <div className="hint-searches">
            {HINT_SEARCHES.map(h => (
              <button key={h} className="hint-chip" onClick={() => { track('hint_click', { hint_text: h }); setQuery(h); handleSearch(h) }}>
                {h}
              </button>
            ))}
          </div>

          {collection.length > 0 && (
            <div className="collection-section">
              <div className="collection-header">
                <span className="collection-title">★ 내가 수집한 단지</span>
                <span className="collection-count">{collection.length}개</span>
              </div>
              <CollectionList
                collection={collection}
                compareSelected={compareSelected}
                onSearch={(apt) => { setQuery(apt.aptNm); handleSearch(apt.aptNm) }}
                onToggleCompare={toggleCompareSelect}
                onDelete={handleRemoveFromCollection}
              />
            </div>
          )}

          <div className="nearby-section">
            {nearbyState === 'idle' && (
              <button className="nearby-btn" onClick={() => { track('nearby_click'); handleNearby() }}>
                📍 내 주변 아파트 보기
              </button>
            )}
            {nearbyState === 'loading' && (
              <div className="nearby-loading">내 주변 아파트 찾는 중...</div>
            )}
            {nearbyState === 'denied' && (
              <div className="nearby-error">위치 권한이 필요해요. 브라우저 설정에서 위치 접근을 허용해주세요.</div>
            )}
            {nearbyState === 'error' && (
              <div className="nearby-error">
                주변 아파트를 찾지 못했어요.
                <button className="nearby-retry" onClick={handleNearby}>다시 시도</button>
              </div>
            )}
            {nearbyState === 'done' && nearbyApts.length > 0 && (
              <div className="nearby-results">
                <div className="nearby-title">📍 내 주변 아파트</div>
                {nearbyApts.map(apt => (
                  <button
                    key={apt.kaptCode}
                    className="nearby-apt-item"
                    onClick={() => { track('nearby_result_click', { apt_name: apt.kaptName }); setQuery(apt.kaptName); handleSearch(apt.kaptName) }}
                  >
                    <span className="nearby-apt-name">{apt.kaptName}</span>
                    <span className="nearby-apt-addr">{apt.addr?.split(' ').slice(1, 4).join(' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {loading && <div className="loading-msg">{loadingMsg}</div>}
      {error && (
        <div className="error-block">
          <div className="error-msg" style={{ whiteSpace: 'pre-line' }}>{error}</div>
          {(errorType === 'no-results' || errorType === 'load-fail' || errorType === 'network') && (
            <button
              className="retry-btn"
              onClick={() => {
                if (errorType === 'no-results') {
                  setError(null)
                  setErrorType(null)
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
                <button key={h} className="hint-chip" onClick={() => { track('hint_click', { hint_text: h }); setQuery(h); handleSearch(h) }}>
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {cards.length > 0 && (
        <div className="result-section">
          {/* 탭: 검색결과 / 수집 */}
          <div className="result-tabs">
            <button className={`result-tab${resultTab === 'search' ? ' active' : ''}`} onClick={() => { setResultTab('search'); track('result_tab_switch', { tab: 'search' }) }}>
              검색결과
            </button>
            <button className={`result-tab${resultTab === 'collection' ? ' active' : ''}`} onClick={() => { setResultTab('collection'); track('result_tab_switch', { tab: 'collection', collection_count: collection.length }) }}>
              수집 {collection.length > 0 ? `${collection.length}개` : ''}
            </button>
          </div>

          {resultTab === 'search' ? (
            <>
              <div className="search-result-header">
                <span className="search-result-title">'{searchedQuery}' 검색 결과</span>
                <span className="search-result-count">
                  {totalCount <= cards.length ? `${cards.length}개` : `${cards.length}개 / 전체 ${totalCount}개`}
                </span>
              </div>
              {totalCount > cards.length && (
                <div className="search-more-hint">
                  검색 결과가 더 있어요. 아파트명이나 도로명을 함께 입력하면 더 정확하게 찾을 수 있어요.
                </div>
              )}
              <div className="card-list">
                {cards.map((apt, i) => (
                  <>
                    <EvalCard key={apt.kaptCode} apt={apt} onDetail={() => { track('apt_view', { apt_name: apt.aptNm, region: apt.regionName }); navigate(`/apt/${apt.kaptCode}`, { state: { evalData: apt } }) }} onCollectionChange={setCollection} />
                    {i === 1 && cards.length > 2 && (
                      <AdUnit key="ad-mid" adSlot={import.meta.env.VITE_ADSENSE_SLOT_RESULTS} style={{ margin: '8px 0' }} />
                    )}
                  </>
                ))}
              </div>
              <p className="data-disclaimer">실거래 데이터는 국토교통부 실거래가 공개시스템 기준이에요. 분위기·뉴스·커뮤니티 요약은 AI가 웹에서 수집한 정보예요.</p>
            </>
          ) : (
            <div className="collection-tab-body">
              {collection.length === 0 ? (
                <div className="collection-empty">아직 수집한 단지가 없어요.<br/>검색 결과에서 <strong>수집</strong> 버튼을 눌러보세요.</div>
              ) : (
                <>
                  <div className="collection-header">
                    <span className="collection-title">★ 내가 수집한 단지</span>
                    <span className="collection-count">{collection.length}개</span>
                  </div>
                  <CollectionList
                    collection={collection}
                    compareSelected={compareSelected}
                    onSearch={(apt) => { setQuery(apt.aptNm); handleSearch(apt.aptNm) }}
                    onToggleCompare={toggleCompareSelect}
                    onDelete={handleRemoveFromCollection}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* floating 비교 바 — compareSelected 있을 때 항상 노출 */}
      {compareSelected.length > 0 && (
        <div className="compare-bar">
          <div className="compare-bar-chips">
            {compareSelected.map(apt => (
              <span key={apt.kaptCode} className="compare-bar-chip">
                <span className="compare-bar-chip-name">{apt.aptNm}</span>
                <button className="compare-bar-chip-remove" onClick={() => toggleCompareSelect(apt)}>×</button>
              </span>
            ))}
            {compareSelected.length === 1 && (
              <span className="compare-bar-hint">1개 더 선택해요</span>
            )}
          </div>
          <button
            className={`compare-bar-go${compareSelected.length < 2 ? ' disabled' : ''}`}
            onClick={() => {
              if (compareSelected.length < 2) return
              track('compare_open', { count: compareSelected.length, apts: compareSelected.map(a => a.aptNm).join(',') })
              setCompareOpen(true)
            }}
          >
            비교하기 →
          </button>
        </div>
      )}

      {compareOpen && (
        <CompareView
          apts={compareSelected}
          onClose={() => { setCompareOpen(false); setCompareSelected([]) }}
        />
      )}

      <footer className="site-footer">
        <p className="site-footer-copy">© 2026 수군수군 우리집 · SuZip</p>
        <p className="site-footer-ai">이 서비스는 인터넷 글을 AI가 자동 수집·요약해요. 실제 사실과 다를 수 있으며 투자·거래 참고 자료로 활용할 수 없어요.</p>
        <div className="site-footer-links">
          <a href="https://blog.naver.com/kaimex" target="_blank" rel="noopener noreferrer">블로그</a>
          <span>·</span>
          <a href="/briefing">이불 속 뉴스</a>
          <span>·</span>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer">이용약관</a>
          <span>·</span>
          <a href="mailto:fiveio27@gmail.com">문의하기</a>
        </div>
      </footer>
    </div>
  )
}

/* ── 수집 목록 공통 컴포넌트 ─── */
function CollectionList({ collection, compareSelected, onSearch, onToggleCompare, onDelete }) {
  return (
    <div className="collection-list">
      {collection.map(apt => {
        const inCompare = !!compareSelected.find(a => a.kaptCode === apt.kaptCode)
        const compareMaxed = !inCompare && compareSelected.length >= 3
        return (
          <div key={apt.kaptCode} className={`collection-item${inCompare ? ' in-compare' : ''}`}>
            <button className="collection-item-body" onClick={() => onSearch(apt)}>
              <span className="collection-item-name">{apt.aptNm}</span>
              <span className="collection-item-loc">{apt.dong} · {apt.regionName}</span>
            </button>
            <div className="collection-item-actions">
              <button
                className={`collection-compare-btn${inCompare ? ' active' : ''}${compareMaxed ? ' maxed' : ''}`}
                onClick={() => onToggleCompare(apt)}
                title={compareMaxed ? '최대 3개까지 선택 가능해요' : ''}
              >
                {inCompare ? '✓비교' : '+비교'}
              </button>
              <button className="collection-delete-btn" onClick={() => onDelete(apt)} aria-label="수집 삭제">×</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const GU_LIST = ['강남구','서초구','송파구','강동구','용산구','성동구','마포구','영등포구','동작구','관악구','강서구','양천구','구로구','광진구','동대문구','성북구','노원구','은평구','서대문구','강북구','도봉구','중랑구','금천구','종로구','중구']

const PRICE_RANGES = [
  { label: '5억 이하', min: 0, max: 50000 },
  { label: '5~7억', min: 50000, max: 70000 },
  { label: '7~10억', min: 70000, max: 100000 },
  { label: '10~15억', min: 100000, max: 150000 },
  { label: '15억 이상', min: 150000, max: Infinity },
]

function fP(v) {
  if (!v) return '-'
  const uk = Math.round(v / 10000)
  const man = Math.round((v % 10000) / 1000) * 1000
  if (uk > 0 && man > 0) return `${uk}억 ${(man/1000)}천`
  if (uk > 0) return `${uk}억`
  return `${Math.round(v/1000)}천`
}

function DiscoveryPanel({ data, selectedGu, setSelectedGu, selectedPrice, setSelectedPrice, onSelect }) {
  const filtered = (data || []).filter(a => {
    const matchGu = !selectedGu || a.gu === selectedGu
    const matchPrice = !selectedPrice || (a.avg >= selectedPrice.min && a.avg < selectedPrice.max)
    return matchGu && matchPrice
  }).slice(0, 30)

  return (
    <div className="discovery-wrap">
      {/* 구 선택 */}
      <div className="discovery-section">
        <div className="discovery-label">동네 선택</div>
        <div className="discovery-gu-grid">
          {GU_LIST.map(gu => (
            <button
              key={gu}
              className={`discovery-gu-btn${selectedGu === gu ? ' on' : ''}`}
              onClick={() => {
                const next = selectedGu === gu ? null : gu
                setSelectedGu(next)
                if (next) track('discover_gu_select', { gu: next })
              }}
            >{gu.replace('구','')}</button>
          ))}
        </div>
      </div>

      {/* 가격대 선택 */}
      <div className="discovery-section">
        <div className="discovery-label">가격대 (매매 평균)</div>
        <div className="discovery-price-row">
          {PRICE_RANGES.map(r => (
            <button
              key={r.label}
              className={`discovery-price-btn${selectedPrice?.label === r.label ? ' on' : ''}`}
              onClick={() => {
                const next = selectedPrice?.label === r.label ? null : r
                setSelectedPrice(next)
                if (next) track('discover_price_select', { range: next.label })
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>

      {/* 결과 */}
      {(selectedGu || selectedPrice) && (
        <div className="discovery-results">
          {!data && <div className="discovery-loading">데이터 불러오는 중...</div>}
          {data && filtered.length === 0 && (
            <div className="discovery-empty">조건에 맞는 단지가 없어요.<br/>다른 조건으로 찾아보세요.</div>
          )}
          {data && filtered.map(apt => (
            <button key={apt.code} className="discovery-apt-row" onClick={() => onSelect(apt)}>
              <div className="discovery-apt-left">
                <div className="discovery-apt-name">{apt.name}</div>
                <div className="discovery-apt-meta">
                  {apt.dong} · {apt.year ? apt.year + '년' : '-'} · {apt.units ? apt.units.toLocaleString() + '세대' : '-'}
                </div>
              </div>
              <div className="discovery-apt-right">
                <div className="discovery-apt-price">{fP(apt.avg)}</div>
                <div className="discovery-apt-perpy">{fP(apt.perPy)}/평</div>
              </div>
            </button>
          ))}
          {data && filtered.length >= 30 && (
            <div className="discovery-more">상위 30개 표시 중 — 조건을 좁혀보세요</div>
          )}
        </div>
      )}
    </div>
  )
}
