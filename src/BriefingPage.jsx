import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

function BriefingDetail({ date, data }) {
  const label = data.date || date
  return (
    <div className="briefing-body">
      <div className="briefing-date">{label}</div>

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

  const [data, setData] = useState(null)
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isDetail = !!date

  useEffect(() => {
    setLoading(true)
    setError(false)
    setData(null)
    setList(null)

    if (isDetail) {
      // 특정 날짜 JSON 파일 직접 로드
      fetch(`/briefings/${date}.json`)
        .then(r => { if (!r.ok) throw new Error(); return r.json() })
        .then(d => { setData(d); setLoading(false) })
        .catch(() => { setError(true); setLoading(false) })
    } else {
      // 오늘 브리핑은 API에서, 목록은 /briefings/ 인덱스
      Promise.all([
        fetch('/api/briefing').then(r => r.json()).catch(() => null),
        fetch('/briefings/index.json').then(r => r.json()).catch(() => []),
      ]).then(([today, idx]) => {
        setData(today)
        setList(Array.isArray(idx) ? idx : [])
        setLoading(false)
      })
    }
  }, [date, isDetail])

  const canonicalDate = isDetail ? date : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const titleDate = isDetail ? date : '오늘'

  return (
    <div className="app">
      <Helmet>
        <title>{titleDate} 부동산 브리핑 · 수군수군 우리집</title>
        <meta name="description" content={`${titleDate} 부동산 뉴스를 실수요자 관점으로 요약합니다. 정부 정책 의도, 시장 변화, 매매·전세·월세 체감.`} />
        <link rel="canonical" href={`https://www.suzip.kr/briefing${isDetail ? `/${date}` : ''}`} />
        <meta property="og:title" content={`${titleDate} 부동산 브리핑 · 수군수군 우리집`} />
        <meta property="og:description" content="실수요자를 위한 오늘의 부동산 뉴스 요약" />
      </Helmet>

      <header onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <div className="brand">
          <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
        </div>
        <div className="brand-en">SuZip · 수집</div>
      </header>

      <nav className="top-nav">
        <Link to="/" className="top-nav-link">아파트 검색</Link>
        <Link to="/briefing" className="top-nav-link top-nav-active">부동산 브리핑</Link>
      </nav>

      <div className="briefing-wrap">
        <div className="briefing-header">
          <h1 className="briefing-title">부동산 브리핑</h1>
          <p className="briefing-sub">실수요자 관점으로 읽는 오늘의 부동산 뉴스</p>
        </div>

        {loading && <div className="loading-msg">브리핑 준비 중이에요...</div>}
        {error && <div className="error-msg">브리핑을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</div>}

        {!loading && !error && data && (
          <BriefingDetail date={isDetail ? date : canonicalDate} data={data} />
        )}

        {!isDetail && list && list.length > 0 && (
          <section className="briefing-archive">
            <h2 className="briefing-section-title">지난 브리핑</h2>
            <ul className="briefing-archive-list">
              {list.map(item => (
                <li key={item.date}>
                  <Link to={`/briefing/${item.date}`} className="briefing-archive-link">
                    {item.date}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button className="briefing-back-btn" onClick={() => navigate('/')}>
          아파트 검색하러 가기
        </button>
      </div>
    </div>
  )
}
