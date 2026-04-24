// src/DetailReport.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fP, fR, getYM, formatDealDate, nameSim } from './utils.js'
import { FETCH_TIMEOUT, MIN_AREA_SQM, SQM_TO_PYEONG, KR_LAT, KR_LON } from './constants.js'
import { track } from './analytics.js'
import { isCollected, toggleCollection } from './collection.js'

function isValidUrl(url) {
  try { const { protocol } = new URL(url); return protocol === 'http:' || protocol === 'https:' }
  catch { return false }
}

const TABS = ['동네·이야기', '시세']

export default function DetailReport({ apt, onBack, onCollectionChange }) {
  const [tab, setTab] = useState('동네·이야기')
  const [toast, setToast] = useState(null) // 'share' | 'collect' | 'uncollect' | null
  const [collected, setCollected] = useState(() => isCollected(apt.kaptCode))

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(id)
  }, [toast])

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/?q=${encodeURIComponent(apt.aptNm)}`
    navigator.clipboard.writeText(url).then(() => {
      setToast('share')
    }).catch(() => {
      const el = document.createElement('textarea')
      el.value = url
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setToast('share')
    })
  }, [apt.aptNm])

  const handleCollect = useCallback(() => {
    const next = toggleCollection(apt)
    const saving = !collected
    setCollected(saving)
    track(saving ? 'collect_save' : 'collect_remove', { apt_name: apt.aptNm, region: apt.regionName })
    onCollectionChange?.(next)
    setToast(saving ? 'collect' : 'uncollect')
  }, [apt, collected, onCollectionChange])

  return (
    <div className="detail-report">
      {toast === 'share' && (
        <div className="collect-toast">링크 복사 완료! 원하는 곳에 공유하세요.</div>
      )}
      {toast === 'collect' && (
        <div className="collect-toast">수집 목록에 추가했어요 ★</div>
      )}
      {toast === 'uncollect' && (
        <div className="collect-toast">수집 목록에서 제거했어요</div>
      )}
      <div className="detail-header">
        <button className="detail-back" aria-label="목록으로 돌아가기" onClick={onBack}>← 뒤로</button>
        <div className="detail-title">
          <div className="detail-apt-name">{apt.aptNm}</div>
          <div className="detail-apt-loc">{apt.dong} · {apt.regionName}</div>
        </div>
        <div className="detail-header-actions">
          <button className={`collect-btn${collected ? ' collected' : ''}`} aria-label={collected ? '수집 취소' : '수집하기'} onClick={() => { track('detail_collect_click', { apt_name: apt.aptNm }); handleCollect() }}>
            {collected ? '✓ 수집됨' : '★ 수집하기'}
          </button>
          <button className="share-btn" aria-label="공유하기" onClick={() => { track('share_click', { apt_name: apt.aptNm }); handleShare() }}>
            🔗 공유
          </button>
        </div>
      </div>

      <div className="detail-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`detail-tab${tab === t ? ' on' : ''}`}
            aria-pressed={tab === t}
            onClick={() => { track('tab_switch', { tab_name: t, apt_name: apt.aptNm }); setTab(t) }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="detail-body">
        {tab === '시세'       && <PriceTab apt={apt} />}
        {tab === '동네·이야기' && <NeighborhoodStoriesTab dong={apt.dong} aptNm={apt.aptNm} addr={apt.addr} apt={apt} />}
      </div>
    </div>
  )
}

/* ── 아코디언 공통 컴포넌트 ─────────────────── */
function Accordion({ label, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="accordion">
      <button className="accordion-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>{label}{count != null ? ` (${count})` : ''}</span>
        <span className="accordion-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  )
}

/* ── 시세 탭 ─────────────────────────────── */
function PriceTrendChart({ data }) {
  if (!data || data.length < 2) return null
  const W = 300, H = 120
  const PAD = { t: 12, r: 16, b: 26, l: 44 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const n = data.length

  const vals = data.map(d => d.avg)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1

  const toX = i => PAD.l + (i / (n - 1)) * plotW
  const toY = v => PAD.t + plotH - ((v - minV) / range) * plotH

  const points = data.map((d, i) => `${toX(i)},${toY(d.avg)}`).join(' ')

  const fAmt = v => {
    const uk = v / 10000
    return uk >= 1 ? `${uk.toFixed(uk % 1 === 0 ? 0 : 1)}억` : `${Math.round(v / 1000)}천`
  }

  const monthLabel = ym => {
    const parts = ym.split('.')
    return `${parseInt(parts[1])}월`
  }

  return (
    <div className="price-trend-wrap">
      <div className="price-trend-label">월별 평균 실거래가 추이</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="price-trend-svg">
        {/* 수평 가이드라인 */}
        {[minV, (minV + maxV) / 2, maxV].map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={toY(v)} x2={W - PAD.r} y2={toY(v)}
              stroke="#e4eaf4" strokeWidth="1" />
            <text x={PAD.l - 4} y={toY(v) + 4}
              textAnchor="end" fontSize="9" fill="#9ca3af">{fAmt(v)}</text>
          </g>
        ))}
        {/* 라인 */}
        <polyline points={points}
          fill="none" stroke="#2563eb" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {/* 면적 채우기 */}
        <polygon
          points={`${toX(0)},${PAD.t + plotH} ${points} ${toX(n - 1)},${PAD.t + plotH}`}
          fill="url(#priceGrad)" opacity="0.15" />
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 도트 + X축 레이블 */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.avg)} r="3"
              fill="#fff" stroke="#2563eb" strokeWidth="2" />
            {(i === 0 || i === n - 1 || n <= 6) && (
              <text x={toX(i)} y={H - 4}
                textAnchor="middle" fontSize="9" fill="#9ca3af">
                {monthLabel(d.ym)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

function PriceTab({ apt }) {
  const [trades, setTrades] = useState(null)
  const [months, setMonths] = useState(6)
  const [loading, setLoading] = useState(false)
  const [tradeError, setTradeError] = useState(false)

  useEffect(() => {
    if (!apt?.bjdCode) return
    const lawdCd = apt.bjdCode.slice(0, 5)
    const ymList = getYM(months)
    setLoading(true)
    setTradeError(false)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    Promise.all(
      ymList.map(ym =>
        fetch(`/api/trade?lawdCd=${lawdCd}&dealYmd=${ym}`, { signal: controller.signal })
          .then(r => r.json())
          .catch(() => null)
      )
    ).then(results => {
      const all = []
      results.forEach(data => {
        if (!data) return
        if (!['00', '000'].includes(data?.response?.header?.resultCode)) return
        const items = data?.response?.body?.items?.item
        if (!items) return
        const arr = Array.isArray(items) ? items : [items]
        arr.forEach(item => {
          const nm   = (item.aptNm || '').trim()
          const amt  = parseInt((item.dealAmount || '').replace(/,/g, ''), 10)
          const area = parseFloat(item.excluUseAr) || 0
          const date = formatDealDate(item.dealYear, item.dealMonth, item.dealDay)
          const floor = item.floor || '-'
          if (area < MIN_AREA_SQM || isNaN(amt) || amt === 0) return
          const pyeong = Math.round(area / SQM_TO_PYEONG)
          if (pyeong === 0) return
          const perPy = Math.round(amt / pyeong)
          if (nameSim(nm, apt.aptNm) < 0.6 || perPy === 0) return
          all.push({ date, amt, area, floor, nm, pyeong, perPy })
        })
      })
      all.sort((a, b) => b.date.localeCompare(a.date))
      setTrades(all)
    }).catch(e => {
      if (e.name !== 'AbortError') { setTradeError(true); setTrades([]) }
    }).finally(() => {
      clearTimeout(timer)
      setLoading(false)
    })
    return () => { controller.abort(); clearTimeout(timer) }
  }, [apt?.bjdCode, apt?.aptNm, months])

  const avgAmt   = trades?.length ? Math.round(trades.reduce((s, t) => s + t.amt,   0) / trades.length) : 0
  const avgPerPy = trades?.length ? Math.round(trades.reduce((s, t) => s + t.perPy, 0) / trades.length) : 0

  const monthlyData = useMemo(() => {
    if (!trades || trades.length === 0) return []
    const byMonth = {}
    trades.forEach(t => {
      const ym = t.date.slice(0, 7) // "2026.04"
      if (!byMonth[ym]) byMonth[ym] = []
      byMonth[ym].push(t.amt)
    })
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, amts]) => ({
        ym,
        avg: Math.round(amts.reduce((s, v) => s + v, 0) / amts.length),
      }))
  }, [trades])

  const changePct = apt.olderAvg > 0
    ? Math.round((apt.recentAvg - apt.olderAvg) / apt.olderAvg * 100)
    : null
  const dirLabel = { '↑ 상승세': '오름세', '→ 보합': '보합', '↓ 하락세': '내림세' }[apt.direction] || ''
  const dirCls   = apt.direction?.includes('상승') ? 'up' : apt.direction?.includes('하락') ? 'down' : 'flat'
  const levelCls = { '높은 수준': 'high', '중간 수준': 'mid', '낮은 수준': 'low' }[apt.priceJudgment?.level] || ''

  if (!apt.bjdCode) {
    return (
      <div className="price-tab">
        <div className="detail-empty">실거래 데이터가 없는 단지입니다</div>
        <div className="listing-deeplinks">
          <div className="listing-deeplinks-label">실매물 보기</div>
          <div className="listing-deeplinks-btns">
            <a className="listing-btn naver" href={`https://search.naver.com/search.naver?query=${encodeURIComponent(apt.aptNm + ' 아파트 매물')}`} target="_blank" rel="noopener noreferrer" onClick={() => track('listing_link_click', { apt_name: apt.aptNm, service: 'naver' })}>네이버 매물검색</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="price-tab">

      {/* 상단: 가격 요약 Hero */}
      <div className="price-hero">
        <div className="price-tab-months">
          {[3, 6, 12].map(m => (
            <button key={m} className={`months-btn${months === m ? ' on' : ''}`} onClick={() => { track('price_months_change', { months: m, apt_name: apt.aptNm }); setMonths(m) }}>
              {m}개월
            </button>
          ))}
        </div>
        {loading ? (
          <div className="price-hero-loading">평균가 계산 중...</div>
        ) : avgAmt > 0 ? (
          <>
            <div className="price-hero-label">{months}개월 거래 평균</div>
            <div className="price-hero-main">{fP(avgAmt)}</div>
            {avgPerPy > 0 && <div className="price-hero-sub">평당 {fP(avgPerPy)}</div>}
          </>
        ) : null}
      </div>

      {/* 중단: 해석 */}
      {!loading && (dirLabel || apt.priceJudgment?.level || changePct !== null) && (
        <div className="price-interpret">
          <div className="price-interpret-badges">
            {dirLabel && <span className={`price-dir-badge ${dirCls}`}>{dirLabel}</span>}
            {apt.priceJudgment?.level && (
              <span className={`price-ai-label ${levelCls}`}>{apt.priceJudgment.level}</span>
            )}
          </div>
          {changePct !== null && changePct !== 0 && (
            <div className="price-interpret-change">
              직전 3개월 대비 {changePct > 0 ? `+${changePct}` : `${changePct}`}%
            </div>
          )}
          {apt.priceJudgment?.level && (
            <div className="price-interpret-basis">서울·수도권 실거래 기준</div>
          )}
        </div>
      )}

      {/* 가격 추이 차트 */}
      {!loading && monthlyData.length >= 2 && (
        <PriceTrendChart data={monthlyData} />
      )}

      {/* 하단: 근거 */}
      {loading ? (
        <div className="detail-loading">실거래 데이터 불러오는 중...</div>
      ) : tradeError ? (
        <div className="detail-empty">거래 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>
      ) : !trades ? null : trades.length === 0 ? (
        <div className="detail-empty">최근 {months}개월 거래 내역이 없습니다</div>
      ) : (
        <>
          {trades.length <= 2 && (
            <div className="price-sparse-warn">거래 건수가 적어 참고용으로만 확인하세요</div>
          )}

          <AreaBreakdown trades={trades} />

          <Accordion label="실거래 내역" count={trades.length} defaultOpen={trades.length <= 10}>
            <div className="trade-list">
              {trades.map((t, i) => (
                <div key={i} className="trade-row">
                  <div className="trade-date">{t.date}</div>
                  <div className="trade-col-right">
                    <div className="trade-amt">{fP(t.amt)}</div>
                    <div className="trade-per-py">{fP(t.perPy)}/평</div>
                  </div>
                  <div className="trade-meta">{t.area.toFixed(0)}㎡ · 약 {t.pyeong}평형 · {t.floor}층</div>
                </div>
              ))}
            </div>
          </Accordion>

          <div className="listing-deeplinks">
            <div className="listing-deeplinks-label">실매물 보기</div>
            <div className="listing-deeplinks-btns">
              <a className="listing-btn naver" href={`https://search.naver.com/search.naver?query=${encodeURIComponent(apt.aptNm + ' 아파트 매물')}`} target="_blank" rel="noopener noreferrer" onClick={() => track('listing_link_click', { apt_name: apt.aptNm, service: 'naver' })}>네이버 매물검색</a>
            </div>
          </div>
          <p className="data-disclaimer">국토교통부 실거래가 공개시스템에서 직접 조회한 실제 거래 데이터예요.</p>
        </>
      )}
    </div>
  )
}

/* ── 단지 인포 카드 ─────────────────────── */
function AptInfoCard({ apt }) {
  const [kapt, setKapt]         = useState(null)
  const [building, setBuilding] = useState(null)
  const [subway, setSubway]     = useState(null)    // { name, distM }
  const [facilities, setFacilities] = useState(null) // { mart, school, hospital }

  useEffect(() => {
    if (!apt?.kaptCode) return
    fetch(`/api/kapt?kaptCode=${apt.kaptCode}`)
      .then(r => r.json()).then(setKapt).catch(() => {})
  }, [apt?.kaptCode])

  useEffect(() => {
    if (!apt?.bjdCode) return
    fetch(`/api/building?bjdCode=${apt.bjdCode}&aptName=${encodeURIComponent(apt.aptNm)}`)
      .then(r => r.json()).then(setBuilding).catch(() => {})
  }, [apt?.bjdCode, apt?.aptNm])

  // Kakao 클라이언트 검색 — 좌표 먼저 획득 후 지하철·시설 검색
  useEffect(() => {
    if (!apt?.aptNm) return
    const waitKakao = setInterval(() => {
      if (!window.kakao?.maps?.services) return
      clearInterval(waitKakao)

      const ps = new window.kakao.maps.services.Places()
      const addrShort = apt.addr ? apt.addr.split(' ').slice(0, 4).join(' ') : ''
      const q = addrShort ? `${apt.aptNm} ${addrShort}` : apt.aptNm

      ps.keywordSearch(q, (res, status) => {
        if (status !== 'OK' || !res.length) return
        const lat = parseFloat(res[0].y)
        const lng = parseFloat(res[0].x)
        if (isNaN(lat) || isNaN(lng)) return

        const center = new window.kakao.maps.LatLng(lat, lng)
        const opts = { location: center, sort: window.kakao.maps.services.SortBy.DISTANCE }

        ps.categorySearch('SW8', (r, s) => {
          if (s === 'OK' && r.length > 0) {
            const d = parseInt(r[0].distance)
            setSubway({ name: r[0].place_name.replace(/역$/, '').trim() + '역', distM: d })
          }
        }, { ...opts, radius: 2000 })

        ps.categorySearch('SC4', (r, s) => {
          setFacilities(prev => ({ ...prev, school: s === 'OK' ? r.length : 0 }))
        }, { ...opts, radius: 1000 })

        ps.categorySearch('MT1', (r, s) => {
          setFacilities(prev => ({ ...prev, mart: s === 'OK' ? r.length : 0 }))
        }, { ...opts, radius: 500 })

        ps.categorySearch('HP8', (r, s) => {
          setFacilities(prev => ({ ...prev, hospital: s === 'OK' ? r.length : 0 }))
        }, { ...opts, radius: 500 })
      })
    }, 300)
    return () => clearInterval(waitKakao)
  }, [apt?.aptNm, apt?.addr])

  const walkMin = subway?.distM ? Math.round(subway.distM / 67) : null  // 도보 67m/분

  const 세대수 = kapt?.세대수 || building?.세대수_건축 || apt?.kaptdaCnt
  const 동수 = apt?.kaptDongCnt
  const 사용승인일 = (() => {
    const d = apt?.useAprDay
    if (!d || d.length < 6) return null
    const y = d.slice(0, 4)
    const m = parseInt(d.slice(4, 6), 10)
    return m ? `${y}년 ${m}월` : `${y}년`
  })()

  const items = [
    세대수         && { label: '세대수',  value: `${parseInt(세대수).toLocaleString()}세대` },
    동수           && { label: '동 수',   value: `${동수}개 동` },
    사용승인일     && { label: '사용승인', value: 사용승인일 },
    kapt?.난방방식  && { label: '난방',    value: kapt.난방방식 },
    building?.용적률 && { label: '용적률', value: `${building.용적률}%` },
    building?.주차대수 && { label: '주차', value: `${building.주차대수.toLocaleString()}대` },
    subway         && { label: walkMin ? `${subway.name}` : subway.name,
                        value: walkMin ? `도보 ${walkMin}분` : '인근' },
    facilities?.school != null && { label: '초등학교', value: `반경 1km ${facilities.school}개` },
    facilities?.mart   != null && { label: '대형마트',  value: `반경 500m ${facilities.mart}개` },
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div className="apt-info-card">
      <div className="apt-info-title">단지 정보</div>
      <div className="apt-info-grid">
        {items.map(({ label, value }) => (
          <div key={label} className="apt-info-item">
            <span className="apt-info-label">{label}</span>
            <span className="apt-info-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 동네·이야기 통합 탭 ─────────────────── */
function NeighborhoodStoriesTab({ dong, aptNm, addr, apt }) {
  const [vibe, setVibe] = useState(null)
  const [vibeSummary, setVibeSummary] = useState(null)
  const [vibeLoading, setVibeLoading] = useState(true)
  // stories 비노출 중 — API 호출도 중단 (복구 시 아래 주석 해제 + 위 UI 주석도 해제)
  const [stories, setStories] = useState([])
  const [storiesLoading, setStoriesLoading] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    setVibe(null); setVibeSummary(null); setVibeLoading(true)
    fetch(`/api/vibe?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`, { signal })
      .then(r => r.json())
      .then(data => { setVibe(data?.categories || []); setVibeSummary(data?.summary || null); setVibeLoading(false) })
      .catch(e => { if (e.name !== 'AbortError') { setVibe([]); setVibeLoading(false) } })
    // fetch(`/api/stories?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`, { signal })
    //   .then(r => r.json())
    //   .then(data => { setStories(Array.isArray(data) ? data : []); setStoriesLoading(false) })
    //   .catch(e => { if (e.name !== 'AbortError') { setStories([]); setStoriesLoading(false) } })
    return () => controller.abort()
  }, [aptNm, dong])

  return (
    <div className="neighborhood-tab">
      {/* 수군수군 — 동네 이야기 */}
      <div className="vibe-card">
        <div className="vibe-card-header">
          <span className="vibe-card-badge">수군수군</span>
          <span className="vibe-card-sub">인터넷에 떠도는 이야기를 AI가 모아봤어요</span>
        </div>
        {vibeLoading ? (
          <div className="vibe-loading">소문 수집 중이에요...</div>
        ) : vibe && vibe.length > 0 ? (
          <>
            {vibeSummary && (
              <div className="vibe-summary">{vibeSummary}</div>
            )}
            <div className="vibe-feed">
              {vibe.map((cat) => {
                const CAT_ICON = { 교통: '🚇', 학군: '📚', 분위기: '🏘️', 이슈: '📣' }
                return cat.lines.length > 0 && (
                  <div key={cat.label} className="vibe-feed-item">
                    <div className="vibe-feed-label">
                      <span className="vibe-feed-icon">{CAT_ICON[cat.label] || '💬'}</span>
                      {cat.label}
                    </div>
                    <div className="vibe-feed-lines">
                      {cat.lines.map((line, i) => (
                        <p key={i} className="vibe-feed-line">{line}</p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="vibe-source-note">
              직접 임장 가보는 게 제일 정확해요 😊
            </div>
          </>
        ) : (
          <div className="vibe-empty">아직 소문이 없네요</div>
        )}
      </div>

      {/* 단지 인포 카드 */}
      <AptInfoCard apt={apt} />

      {/* 지도 */}
      <KakaoMap aptNm={aptNm} addr={addr} />
      <div className="map-deeplinks">
        {(() => { const q = encodeURIComponent(addr ? `${aptNm} ${addr.split(' ').slice(0, 3).join(' ')}` : aptNm); return (<>
          <a className="map-deeplink-btn" href={`https://map.kakao.com/link/search/${q}`} target="_blank" rel="noopener noreferrer" onClick={() => track('map_deeplink_click', { apt_name: aptNm, service: 'kakao' })}>카카오지도</a>
          <a className="map-deeplink-btn" href={`https://map.naver.com/p/search/${q}`} target="_blank" rel="noopener noreferrer" onClick={() => track('map_deeplink_click', { apt_name: aptNm, service: 'naver' })}>네이버지도</a>
        </>)})()}
      </div>

      {/* 블로그 후기 — 클릭률 낮아 임시 비노출 (SHOW_STORIES=true 로 복구) */}
      {/* <Accordion label="블로그 · 카페 후기" count={storiesLoading ? null : stories.length}>
        {storiesLoading ? (
          <div className="detail-loading">후기 불러오는 중...</div>
        ) : !stories || stories.length === 0 ? (
          <div className="detail-empty">실거주 후기를 찾지 못했습니다</div>
        ) : (
          <div className="stories-tab">
            {stories
              .filter(s => s.link && isValidUrl(s.link))
              .map((s, i) => (
              <a key={i} className="story-card" href={s.link} target="_blank" rel="noopener noreferrer" onClick={() => track('story_link_click', { apt_name: aptNm, source: s.source })}>
                <div className="story-card-title">{s.title}</div>
                {s.description && <div className="story-card-desc">{s.description}</div>}
                <div className="story-card-meta">{s.source}{s.date ? ` · ${s.date}` : ''}</div>
              </a>
            ))}
          </div>
        )}
      </Accordion> */}

      <p className="data-disclaimer">실거래 데이터는 국토교통부 실거래가 공개시스템 기준이에요. 동네 분위기·후기 요약은 AI가 웹에서 수집한 정보예요.</p>
    </div>
  )
}

/* ── 평형 분포 ───────────────────────────── */
function AreaBreakdown({ trades }) {
  // 평수별 그룹핑 (10평 단위)
  const groups = {}
  trades.forEach(t => {
    const bucket = `${Math.floor(t.pyeong / 10) * 10}평형대`
    if (!groups[bucket]) groups[bucket] = { count: 0, totalPerPy: 0 }
    groups[bucket].count++
    groups[bucket].totalPerPy += t.perPy
  })

  const sorted = Object.entries(groups).sort((a, b) => {
    const na = parseInt(a[0], 10), nb = parseInt(b[0], 10)
    return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb)
  })
  if (sorted.length === 0) return null

  return (
    <div className="area-breakdown">
      {sorted.map(([bucket, { count, totalPerPy }]) => (
        <div key={bucket} className="area-bucket">
          <div className="area-bucket-label">{bucket}</div>
          <div className="area-bucket-avg">{fP(Math.round(totalPerPy / count))}<span className="area-bucket-unit">/평</span></div>
          <div className="area-bucket-count">{count}건</div>
        </div>
      ))}
    </div>
  )
}

/* ── 카카오 지도 ─────────────────────────── */
const MAX_COORD_CACHE = 100
const coordCache = new Map()
function setCoordCache(key, val) {
  if (coordCache.size >= MAX_COORD_CACHE) coordCache.delete(coordCache.keys().next().value)
  coordCache.set(key, val)
}

function KakaoMap({ aptNm, addr }) {
  const mapRef = useRef(null)
  const [coords, setCoords] = useState(null)
  const [failed, setFailed] = useState(false)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    const cacheKey = `${aptNm}|${addr}`
    if (coordCache.has(cacheKey)) { setCoords(coordCache.get(cacheKey)); return }

    if (!window.kakao?.maps?.services) { setFailed(true); return }
    const places = new window.kakao.maps.services.Places()

    const tryKeyword = (q, cb) => {
      places.keywordSearch(q, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
          const lat = parseFloat(result[0].y), lon = parseFloat(result[0].x)
          if (!isNaN(lat) && !isNaN(lon)) { cb({ lat, lon }); return }
        }
        cb(null)
      })
    }

    // 1차: 아파트명 + 주소(시 구 동), 2차 fallback: 아파트명만
    const addrShort = addr ? addr.split(' ').slice(0, 4).join(' ') : ''
    const q1 = addrShort ? `${aptNm} ${addrShort}` : aptNm
    const q2 = aptNm

    tryKeyword(q1, c => {
      if (c) { setCoordCache(cacheKey, c); setCoords(c); return }
      tryKeyword(q2, c2 => {
        if (c2) { setCoordCache(cacheKey, c2); setCoords(c2) }
        else setFailed(true)
      })
    })
  }, [aptNm, addr])

  useEffect(() => {
    if (!coords || !mapRef.current) return
    if (!window.kakao?.maps) { setMapError(true); return }
    const { kakao } = window
    const center = new kakao.maps.LatLng(coords.lat, coords.lon)
    const map = new kakao.maps.Map(mapRef.current, { center, level: 3 })
    new kakao.maps.Marker({ position: center, map })
  }, [coords])

  if (failed || mapError) return <div className="osm-map osm-map-loading">지도를 불러올 수 없습니다</div>
  if (!coords) return <div className="osm-map osm-map-loading">지도 불러오는 중...</div>

  return <div ref={mapRef} className="osm-map" />
}

