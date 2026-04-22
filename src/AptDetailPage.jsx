// src/AptDetailPage.jsx — /apt/:kaptCode 라우트
import { useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { getYM, getLifeConditions, getVerdict, calcPriceSignal, nameSim, buildPriceJudgment } from './utils.js'
import { FETCH_TIMEOUT, MIN_AREA_SQM } from './constants.js'
import { DONG } from './data.js'
import DetailReport from './DetailReport.jsx'
import { track } from './analytics.js'
import { getCollection } from './collection.js'

async function buildEvalData(apt) {
  const bjdCode = apt.bjdCode || null

  const addrParts = (apt.addr || '').split(' ')
  const dong = addrParts.find(p => p.endsWith('동') || p.endsWith('읍') || p.endsWith('면')) || addrParts[addrParts.length - 1] || ''
  const regionName = addrParts.find(p => p.endsWith('구') || p.endsWith('시') || p.endsWith('군')) || addrParts[addrParts.length - 2] || ''

  const storiesRes = await fetch(`/api/stories?aptName=${encodeURIComponent(apt.kaptName)}&location=${encodeURIComponent(dong)}`)
    .then(r => r.json()).catch(() => [])
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
      olderAvg: 0,
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
    buildYear: apt.kaptBuldYy || '-',
    bjdCode,
    addr: apt.addr,
    recentAvg,
    olderAvg,
    direction,
    priceJudgment,
    lifeConditions: getLifeConditions(dong),
    verdict: getVerdict(tag, dong),
    voice,
  }
}

export default function AptDetailPage() {
  const { kaptCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [evalData, setEvalData] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [collection, setCollection] = useState(() => getCollection())

  useEffect(() => {
    // location.state에 이미 evalData가 있으면 바로 사용
    if (location.state?.evalData) {
      setEvalData(location.state.evalData)
      return
    }
    // 직접 URL 접근 시: kaptCode로 apt 정보 조회 후 buildEvalData
    setLoadError(false)
    fetch(`/api/apt?kaptCode=${kaptCode}`)
      .then(r => r.json())
      .then(apt => {
        if (apt.error) throw new Error(apt.error)
        return buildEvalData(apt)
      })
      .then(data => setEvalData(data))
      .catch(() => setLoadError(true))
  }, [kaptCode, location.state])

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }, [navigate])

  if (loadError) {
    return (
      <div className="app">
        <header onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="brand">
            <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
          </div>
          <div className="brand-en">SuZip · 수집</div>
        </header>
        <div className="error-block">
          <div className="error-msg">아파트 정보를 불러오지 못했습니다.</div>
          <button className="retry-btn" onClick={() => navigate('/')}>홈으로 돌아가기</button>
        </div>
      </div>
    )
  }

  if (!evalData) {
    return (
      <div className="app">
        <header onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="brand">
            <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
          </div>
          <div className="brand-en">SuZip · 수집</div>
        </header>
        <div className="loading-msg">아파트 정보를 불러오는 중...</div>
      </div>
    )
  }

  const pageTitle = `${evalData.aptNm} 실거주 후기 · 수군수군 우리집`
  const pageDesc = `${evalData.aptNm}(${evalData.dong}) 실거주자 이야기, 동네 분위기, 실거래가를 한번에 확인하세요. ${evalData.verdict || ''}`
  const pageUrl = `https://www.suzip.kr/apt/${kaptCode}`

  return (
    <div className="app">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Residence",
          "name": evalData.aptNm,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": evalData.dong,
            "addressRegion": evalData.regionName,
            "addressCountry": "KR"
          },
          "description": pageDesc,
          "url": pageUrl
        })}</script>
      </Helmet>
      <header onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <div className="brand">
          <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
        </div>
        <div className="brand-en">SuZip · 수집</div>
      </header>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {evalData.aptNm} {evalData.dong} 실거주 후기 및 동네 분위기
      </h1>
      <DetailReport apt={evalData} onBack={goBack} onCollectionChange={setCollection} />
    </div>
  )
}
