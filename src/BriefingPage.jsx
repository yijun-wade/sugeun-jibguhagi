import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { track } from './analytics.js'

const TODAY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function BriefingDetail({ isToday, data }) {
  return (
    <div className="briefing-body">
      {isToday && <span className="briefing-today-badge">오늘</span>}
      <div className="briefing-date">{data.date || TODAY}</div>
      {data.title && <h2 className="briefing-headline">{data.title}</h2>}

      <section className="briefing-section">
        <h2 className="briefing-section-title">오늘의 핵심 뉴스</h2>
        <ul className="briefing-news-list">
          {data.news.map((item, i) => (
            <li key={i} className="briefing-news-item">{item}</li>
          ))}
        </ul>
      </section>

      <section className="briefing-section">
        <h2 className="briefing-section-title">정부 의도</h2>
        <p className="briefing-text">{data.intent}</p>
      </section>

      <section className="briefing-section">
        <h2 className="briefing-section-title">시장 변화</h2>
        <p className="briefing-text">{data.market}</p>
      </section>

      <section className="briefing-section">
        <h2 className="briefing-section-title">실수요자 체감</h2>
        <div className="briefing-demand">
          <div className="briefing-demand-row">
            <span className="briefing-demand-label">매매</span>
            <span className="briefing-demand-text">{data.demand.buy}</span>
          </div>
          <div className="briefing-demand-row">
            <span className="briefing-demand-label">전세</span>
            <span className="briefing-demand-text">{data.demand.lease}</span>
          </div>
          <div className="briefing-demand-row">
            <span className="briefing-demand-label">월세</span>
            <span className="briefing-demand-text">{data.demand.rent}</span>
          </div>
        </div>
      </section>

      <p className="briefing-disclaimer">
        위 내용은 네이버 뉴스를 AI가 자동 요약한 것입니다. 실제 사실과 다를 수 있으며 투자 판단의 근거로 사용하지 마세요.
      </p>
    </div>
  )
}

export default function BriefingPage() {
  const navigate = useNavigate()
  const { date } = useParams()
  const isDetail = !!date

  const [data, setData] = useState(null)
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // 아카이브 목록: index.json (정적, 빠름)
  useEffect(() => {
    fetch('/briefings/index.json').then(r => r.json()).catch(() => [])
      .then(idx => setList(Array.isArray(idx) ? idx : []))
  }, [])

  // 본문: 정적 파일 먼저 시도 → API fallback
  useEffect(() => {
    setLoading(true)
    setError(false)
    setData(null)

    const targetDate = isDetail ? date : TODAY

    fetch(`/briefings/${targetDate}.json`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setData(d)
        setLoading(false)
        track('briefing_view', { date: targetDate, is_today: !isDetail, source: 'static' })
      })
      .catch(() => {
        if (isDetail) {
          setError(true); setLoading(false)
        } else {
          fetch('/api/briefing').then(r => r.json()).catch(() => null)
            .then(d => {
              setData(d)
              setLoading(false)
              if (d) track('briefing_view', { date: targetDate, is_today: true, source: 'api' })
            })
        }
      })
  }, [date, isDetail])

  const canonicalDate = isDetail ? date : TODAY
  const pageTitle = data?.title
    ? `${data.title} · 수군수군 우리집`
    : `부동산 브리핑 ${canonicalDate} · 수군수군 우리집`
  const pageDesc = data?.title
    ? `${data.title} — 실수요자 관점으로 읽는 부동산 뉴스 요약`
    : '부동산 뉴스를 실수요자 관점으로 요약합니다.'

  const filteredList = list?.filter(item => item.date !== canonicalDate) || []

  return (
    <div className="app">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={`https://www.suzip.kr/briefing/${canonicalDate}`} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
      </Helmet>

      <header className="site-header">
        <Link to="/" className="site-header-logo">
          <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
        </Link>
        <nav className="site-header-nav">
          <Link to="/" className="site-nav-link">동네임장</Link>
          <Link to="/briefing" className="site-nav-link site-nav-active">뉴스 해석과 체감</Link>
          <Link to="/policy" className="site-nav-link">요즘 정책</Link>
          <Link to="/glossary" className="site-nav-link"><span className="nav-bubble">진짜 쉬운</span> 용어사전</Link>
        </nav>
      </header>

      <div className="briefing-wrap">
        <div className="briefing-header">
          {isDetail && (
            <button className="briefing-back" onClick={() => navigate('/briefing')}>← 브리핑 목록</button>
          )}
          <h1 className="briefing-title">뉴스 해석과 체감</h1>
          <p className="briefing-sub">오늘 부동산 뉴스, 내 입장에서 어떤 의미인지 풀어드려요</p>
        </div>

        {/* 본문 먼저 */}
        {loading && <div className="briefing-loading">브리핑 불러오는 중...</div>}
        {error && <div className="error-msg">브리핑을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</div>}
        {!loading && !error && data && (
          <BriefingDetail isToday={!isDetail} data={data} />
        )}

        {/* 지난 브리핑 아래 */}
        {!isDetail && filteredList.length > 0 && (
          <section className="briefing-archive">
            <h2 className="briefing-archive-title-row">지난 브리핑</h2>
            <div className="briefing-archive-tabs">
              {filteredList.map(item => (
                <Link
                  key={item.date}
                  to={`/briefing/${item.date}`}
                  className="briefing-archive-tab"
                  onClick={() => track('briefing_archive_click', { date: item.date, title: item.title || '' })}
                >
                  <span className="briefing-archive-tab-date">{formatDate(item.date)}</span>
                  {item.title && <span className="briefing-archive-tab-title">{item.title}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}

        <button className="briefing-back-btn" onClick={() => { track('briefing_cta_click', { from: isDetail ? date : 'today' }); navigate('/') }}>
          아파트 검색하러 가기
        </button>
      </div>
    </div>
  )
}
