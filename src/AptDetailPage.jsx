// src/AptDetailPage.jsx — /apt/:kaptCode 라우트
import { useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { getYM, getLifeConditions, getVerdict, calcPriceSignal, nameSim, buildPriceJudgment } from './utils.js'
import { FETCH_TIMEOUT, MIN_AREA_SQM } from './constants.js'
import { DONG } from './data.js'
import DetailReport from './DetailReport.jsx'
import { track } from './analytics.js'
import { parseAddr } from './addr.js'
import { isRentalName } from './apt-type.js'
import { getCollection } from './collection.js'
import { recordInterest } from './interest.js'
import NotFoundPage from './NotFoundPage.jsx'

// 실거래 없이 바로 그릴 수 있는 부분. /api/apt 응답만으로 만든다.
// 전에는 stories(네이버 5쿼리)와 trade 6회가 모두 끝나야 페이지 전체가 한 번에 그려졌다.
// stories 결과(voice)는 화면 어디에도 쓰이지 않는 순수 대기였다. 그동안 방문자는
// 단지명도 없는 "불러오는 중..." 한 줄을 봤다 — 평균 세션이 15~27초인 페이지에서.
function buildBaseData(apt) {
  // regionName은 '구'(없으면 시·군). 전에는 '서울특별시'가 먼저 걸려 서울 전 단지가 같은 값이었다 — src/addr.js 참고.
  const { gu: regionName, dong: parsedDong } = parseAddr(apt.addr)
  const dong = parsedDong || (apt.addr || '').split(' ').pop() || ''
  const tag = (DONG[dong] || {}).tag || ''
  return {
    kaptCode: apt.kaptCode,
    aptNm: apt.kaptName,
    dong,
    regionName,
    buildYear: apt.kaptBuldYy || '-',
    bjdCode: apt.bjdCode || null,
    addr: apt.addr,
    kaptdaCnt: apt.kaptdaCnt,
    useAprDay: apt.useAprDay,
    recentAvg: 0,
    olderAvg: 0,
    direction: '-',
    priceJudgment: { level: null, trend: null, sentence: null },
    lifeConditions: getLifeConditions(dong),
    // 단지별 한 줄 요약(3,345단지 전수 보유)이 동 단위 문장보다 먼저다. App.jsx 카드 경로와 동일.
    verdict: apt.summary || getVerdict(tag, dong),
    aptType: apt.aptType || 'unknown',
    // 실거래 조회가 끝나기 전. 이 동안은 "가격 없음"으로 단정하면 안 된다(저장 스냅샷·계측·유사단지 기준).
    priceLoading: !!apt.bjdCode,
  }
}

async function loadPriceData(base) {
  if (!base.bjdCode) return { ...base, priceLoading: false }
  const lawdCd = base.bjdCode.slice(0, 5)
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
      if (nameSim(nm, base.aptNm) < 0.6 || isNaN(amt) || area < MIN_AREA_SQM) return
      const dealYmd = `${item.dealYear}${String(item.dealMonth || 0).padStart(2,'0')}${String(item.dealDay || 0).padStart(2,'0')}`
      allTrades.push({ amt, area, dealYmd })
    })
  })

  allTrades.sort((a, b) => b.dealYmd.localeCompare(a.dealYmd))
  const cutoff = ymList[2]
  const recentTrades = allTrades.filter(t => t.dealYmd.slice(0, 6) >= cutoff)
  const olderTrades  = allTrades.filter(t => t.dealYmd.slice(0, 6) <  cutoff)
  const { recentAvg, olderAvg, direction } = calcPriceSignal(recentTrades, olderTrades)
  return {
    ...base,
    recentAvg,
    olderAvg,
    direction,
    priceJudgment: buildPriceJudgment(recentAvg, direction),
    // 조회가 전부 실패했는지 — 실패를 "거래 없는 단지"로 읽히게 두지 않는다.
    priceFailed: tradeResults.every(d => !d),
    priceLoading: false,
  }
}

export default function AptDetailPage() {
  const { kaptCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [evalData, setEvalData] = useState(null)
  const [loadError, setLoadError] = useState(false) // false | 'notfound' | 'error'
  const [collection, setCollection] = useState(() => getCollection())

  useEffect(() => {
    // location.state에 이미 evalData가 있으면 바로 사용
    if (location.state?.evalData) {
      setEvalData(location.state.evalData)
      return
    }
    // 직접 URL 접근 시: kaptCode로 apt 정보 조회 후 buildEvalData
    setLoadError(false)
    setEvalData(null)
    let alive = true
    fetch(`/api/apt?kaptCode=${kaptCode}`)
      // 없는 단지(404)와 일시적 장애를 구분한다 — 전자는 색인에서 빼야 하고, 후자는 재시도 대상이다.
      .then(r => r.json().then(body => ({ ok: r.ok, status: r.status, body })))
      .then(({ status, body: apt }) => {
        if (status === 404) { const e = new Error('notfound'); e.notFound = true; throw e }
        if (apt.error) throw new Error(apt.error)
        // 1단계: 단지명·위치·한 줄 요약을 바로 그린다. 2단계: 실거래가 오면 가격을 얹는다.
        const base = buildBaseData(apt)
        if (alive) setEvalData(base)
        return loadPriceData(base)
      })
      .then(data => { if (alive) setEvalData(data) })
      .catch((e) => { if (alive) setLoadError(e?.notFound ? 'notfound' : 'error') })
    return () => { alive = false }
  }, [kaptCode, location.state])

  // apt_view는 상세페이지 마운트 시 1회 발화 — SEO 직접 착지 방문자까지 포착.
  // (카드 클릭 유입은 location.state.evalData 존재 → entry='card', 직접 착지 → 'direct')
  useEffect(() => {
    // 가격 조회가 끝난 뒤에 쏜다 — 먼저 쏘면 has_price가 전부 false로 찍힌다.
    if (!evalData || evalData.priceLoading) return
    // apt_type·has_price는 세그먼트 판정용. 전에는 임대 단지 비중을 단지명 키워드로 추정할 수밖에 없었다.
    // region은 2026-09-19 이전까지 서울 전 단지가 '서울특별시'였다(addr.js) — 그 이후 값만 구 단위다.
    const rental = evalData.aptType === 'rental' ||
      ((!evalData.aptType || evalData.aptType === 'unknown') && isRentalName(evalData.aptNm))
    track('apt_view', {
      apt_name: evalData.aptNm,
      kapt_code: evalData.kaptCode,
      region: evalData.regionName,
      dong: evalData.dong,
      apt_type: rental ? 'rental' : (evalData.aptType || 'unknown'),
      has_price: evalData.recentAvg > 0,
      has_verdict: !!evalData.verdict,
      entry: location.state?.evalData ? 'card' : 'direct',
    })
    recordInterest({
      kaptCode: evalData.kaptCode,
      aptNm: evalData.aptNm,
      dong: evalData.dong,
      gu: evalData.regionName,
      avg: evalData.recentAvg,
      direction: evalData.direction,
      verdict: evalData.verdict,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalData?.kaptCode, evalData?.priceLoading])

  const goBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }, [navigate])

  if (loadError === 'notfound') return <NotFoundPage reason="apt" />

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
