import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { track } from './analytics.js'
import AdFitBanner from './AdFitBanner.jsx'
import CoupangBanner from './CoupangBanner.jsx'
import { getTopRegion, getInterest } from './interest.js'
import { matchRegion } from './interest-core.js'

const TODAY = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

function BriefingNav({ date, list }) {
  const idx = list.findIndex(item => item.date === date)
  if (idx === -1 || list.length < 2) return null
  const newer = idx > 0 ? list[idx - 1] : null          // index 작을수록 최신
  const older = idx < list.length - 1 ? list[idx + 1] : null

  return (
    <nav className="briefing-nav">
      {older ? (
        <Link to={`/briefing/${older.date}`} className="briefing-nav-card briefing-nav-older"
          onClick={() => track('briefing_nav_click', { from: date, to: older.date, direction: 'older' })}>
          <span className="briefing-nav-label">← 이전</span>
          <span className="briefing-nav-date">{older.date}</span>
          {older.title && <span className="briefing-nav-title">{older.title}</span>}
        </Link>
      ) : <div />}
      {newer ? (
        <Link to={`/briefing/${newer.date}`} className="briefing-nav-card briefing-nav-newer"
          onClick={() => track('briefing_nav_click', { from: date, to: newer.date, direction: 'newer' })}>
          <span className="briefing-nav-label">다음 →</span>
          <span className="briefing-nav-date">{newer.date}</span>
          {newer.title && <span className="briefing-nav-title">{newer.title}</span>}
        </Link>
      ) : <div />}
    </nav>
  )
}

function PersonalizedStrip({ region, apts, today }) {
  useEffect(() => {
    track('briefing_personalized_view', { region: region.gu || region.dong || '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region.gu, region.dong])

  const label = [region.dong, region.gu].filter(Boolean).join('·')
  const matched = (today?.news || []).filter(n => matchRegion(n, region.gu, region.dong))

  return (
    <section className="briefing-personal">
      <div className="briefing-personal-hi">
        {region.subscribed
          ? <><b>{label}</b> 저장해두셨죠 — 오늘 소식이에요.</>
          : <><b>{label}</b> 보고 계셨죠? 오늘 소식 챙겨왔어요.</>}
      </div>
      {apts.length > 0 && (
        <div className="briefing-personal-apts">
          {apts.map(a => (
            <Link
              key={a.kaptCode}
              to={`/apt/${a.kaptCode}`}
              className="briefing-personal-chip"
              onClick={() => track('briefing_personal_apt_click', { kapt_code: a.kaptCode, apt_name: a.aptNm })}
            >
              {a.aptNm || '단지'}
            </Link>
          ))}
        </div>
      )}
      {today && (matched.length > 0 ? (
        <div className="briefing-personal-match">
          <span className="briefing-personal-badge">내 지역</span>
          <ul className="briefing-personal-list">
            {matched.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      ) : (
        <div className="briefing-personal-none">
          오늘은 {region.gu || region.dong} 직접 언급은 없어요 — 전국 흐름은 아래에서 확인하세요.
        </div>
      ))}
    </section>
  )
}

function BriefingSkeleton() {
  return (
    <div className="briefing-skeleton">
      <div className="bsk-badge" />
      <div className="bsk-date" />
      <div className="bsk-headline" />
      <div className="bsk-headline bsk-headline--short" />
      {[1,2,3].map(i => (
        <div key={i} className="bsk-section">
          <div className="bsk-section-title" />
          <div className="bsk-line" />
          <div className="bsk-line bsk-line--short" />
          <div className="bsk-line" />
        </div>
      ))}
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const DAY_MS = 86400000

// 로컬 자정 기준(요일·M/D 계산용) — UTC 파싱 시프트 방지
function parseYMD(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
function fmtMD(dt) { return `${dt.getMonth() + 1}/${dt.getDate()}` }
function dowOf(s) { return DOW[parseYMD(s).getDay()] }
function ymLabel(ym) { const [y, m] = ym.split('-'); return `${y}년 ${parseInt(m)}월` }
function mondayOf(dt) { const off = (dt.getDay() + 6) % 7; const mon = new Date(dt); mon.setDate(dt.getDate() - off); return mon }

// 아카이브 목록(최신순)을 월 → 주 계층으로 그룹핑. 오늘 기준 이번주/지난주 태그 부여.
function groupArchive(list, todayStr) {
  const thisMon = mondayOf(parseYMD(todayStr)).getTime()
  const months = new Map() // 'YYYY-MM' -> Map(weekKey -> week)
  for (const item of list) {
    if (!item?.date) continue
    const dt = parseYMD(item.date)
    const ym = item.date.slice(0, 7)
    const mon = mondayOf(dt)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    const monTime = mon.getTime()
    const weekKey = String(monTime)
    if (!months.has(ym)) months.set(ym, new Map())
    const weeks = months.get(ym)
    if (!weeks.has(weekKey)) {
      const rel = monTime === thisMon ? '이번 주' : monTime === thisMon - 7 * DAY_MS ? '지난 주' : null
      weeks.set(weekKey, { monTime, label: `${fmtMD(mon)}–${fmtMD(sun)}`, rel, days: [] })
    }
    weeks.get(weekKey).days.push(item)
  }
  // list가 최신순 → months/weeks 삽입순도 최신순. 방어적으로 주는 monTime 내림차순 정렬.
  return [...months.entries()].map(([ym, weeks]) => ({
    ym,
    label: ymLabel(ym),
    count: [...weeks.values()].reduce((n, w) => n + w.days.length, 0),
    weeks: [...weeks.values()].sort((a, b) => b.monTime - a.monTime),
  }))
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

  // 개인화 스트립: 목록/오늘 화면에서만, 관심 데이터 있을 때만
  const topRegion = useMemo(() => (isDetail ? null : getTopRegion()), [isDetail, date])
  const interestApts = useMemo(() => {
    if (isDetail) return []
    const all = getInterest()
    const inRegion = topRegion?.gu ? all.filter(a => a.gu === topRegion.gu) : []
    return (inRegion.length ? inRegion : all).slice(0, 5)
  }, [isDetail, date, topRegion?.gu])

  const filteredList = list?.filter(item => item.date !== canonicalDate) || []

  // 월 → 주 계층 아카이브 (목록 페이지에서만 사용)
  const groups = useMemo(
    () => (list ? groupArchive(filteredList, TODAY) : []),
    [list, canonicalDate]
  )
  // 최신 월만 기본 펼침. null=아직 초기화 전.
  const [openMonths, setOpenMonths] = useState(null)
  useEffect(() => {
    if (openMonths === null && groups.length) setOpenMonths(new Set([groups[0].ym]))
  }, [groups, openMonths])
  const toggleMonth = (ym) => setOpenMonths(prev => {
    const next = new Set(prev)
    next.has(ym) ? next.delete(ym) : next.add(ym)
    return next
  })

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
          <Link to="/" className="site-nav-link">이불 속 임장</Link>
          <Link to="/briefing" className="site-nav-link site-nav-active">속닥속닥 뉴스</Link>
          <Link to="/policy" className="site-nav-link">이불 속 정책</Link>
          <Link to="/glossary" className="site-nav-link"><span className="nav-bubble">이불 속</span> 사전</Link>
        </nav>
      </header>

      <div className="briefing-wrap">
        <div className="briefing-header">
          {isDetail && (
            <button className="briefing-back" onClick={() => navigate('/briefing')}>← 브리핑 목록</button>
          )}
          <h1 className="briefing-title">속닥속닥 뉴스</h1>
          <p className="briefing-sub">오늘 부동산 뉴스, 내 입장에서 어떤 의미인지 풀어드려요</p>
        </div>

        {/* 개인화 스트립 — 관심 데이터 있을 때만, 본문 위 */}
        {!isDetail && topRegion && (
          <PersonalizedStrip region={topRegion} apts={interestApts} today={data} />
        )}

        {/* 본문 먼저 */}
        {loading && <BriefingSkeleton />}
        {error && <div className="error-msg">브리핑을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</div>}
        {!loading && !error && data && (
          <BriefingDetail isToday={!isDetail} data={data} />
        )}

        {/* 상세 페이지: 이전/다음 날짜 이동 */}
        {isDetail && list && list.length > 1 && (
          <BriefingNav date={date} list={list} />
        )}

        {/* 목록 페이지: 지난 브리핑 — 월 아코디언 → 주 소제목 → 날짜 행 */}
        {!isDetail && groups.length > 0 && (
          <section className="briefing-archive">
            <h2 className="briefing-archive-title-row">지난 브리핑</h2>
            <div className="briefing-archive-months">
              {groups.map(g => {
                const open = openMonths ? openMonths.has(g.ym) : false
                return (
                  <div key={g.ym} className={`briefing-month${open ? ' open' : ''}`}>
                    <button
                      className="briefing-month-head"
                      aria-expanded={open}
                      onClick={() => { toggleMonth(g.ym); track('briefing_month_toggle', { month: g.ym, open: !open }) }}
                    >
                      <span className="briefing-month-label">{g.label}</span>
                      <span className="briefing-month-meta">
                        {g.count}건<span className="briefing-month-arrow" aria-hidden="true">{open ? '▲' : '▼'}</span>
                      </span>
                    </button>
                    {open && (
                      <div className="briefing-month-body">
                        {g.weeks.map(w => (
                          <div key={w.monTime} className="briefing-week">
                            <div className="briefing-week-label">
                              {w.rel && <span className="briefing-week-tag">{w.rel}</span>}
                              <span>{w.label}</span>
                            </div>
                            <ul className="briefing-week-days">
                              {w.days.map(item => (
                                <li key={item.date}>
                                  <Link
                                    to={`/briefing/${item.date}`}
                                    className="briefing-day-row"
                                    onClick={() => track('briefing_archive_click', { date: item.date, title: item.title || '' })}
                                  >
                                    <span className="briefing-day-date">
                                      {formatDate(item.date)}<span className="briefing-day-dow">{dowOf(item.date)}</span>
                                    </span>
                                    <span className="briefing-day-title">{item.title || '브리핑'}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <AdFitBanner />

        <button className="briefing-back-btn" onClick={() => { track('briefing_cta_click', { from: isDetail ? date : 'today' }); navigate('/') }}>
          아파트 검색하러 가기
        </button>
      </div>
    </div>
  )
}
