// src/DetailReport.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { fP, fR, getYM, formatDealDate, nameSim } from './utils.js'
import { FETCH_TIMEOUT, MIN_AREA_SQM, SQM_TO_PYEONG, KR_LAT, KR_LON } from './constants.js'
import { DONG } from './data.js'

function isValidUrl(url) {
  try { const { protocol } = new URL(url); return protocol === 'http:' || protocol === 'https:' }
  catch { return false }
}

const TABS = ['동네·이야기', '시세']

export default function DetailReport({ apt, onBack }) {
  const [tab, setTab] = useState('동네·이야기')
  const [toast, setToast] = useState(false)
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(false), 2800)
    return () => clearTimeout(id)
  }, [toast])

  const handleCollect = useCallback(() => {
    const url = `${window.location.origin}/?q=${encodeURIComponent(apt.aptNm)}`
    navigator.clipboard.writeText(url).then(() => {
      setToast(true)
    }).catch(() => {
      // clipboard API 미지원 fallback
      const el = document.createElement('textarea')
      el.value = url
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setToast(true)
    })
  }, [apt.aptNm])

  return (
    <div className="detail-report">
      {toast && (
        <div className="collect-toast">
          주소 복사가 완료되었어요. 원하는 곳에 수집하세요.
        </div>
      )}
      <div className="detail-header">
        <button className="detail-back" aria-label="목록으로 돌아가기" onClick={onBack}>← 뒤로</button>
        <div className="detail-title">
          <div className="detail-apt-name">{apt.aptNm}</div>
          <div className="detail-apt-loc">{apt.dong} · {apt.regionName}</div>
        </div>
        <button className="collect-btn" aria-label="수집하기" onClick={handleCollect}>
          📌 수집하기
        </button>
      </div>

      <div className="detail-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`detail-tab${tab === t ? ' on' : ''}`}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="detail-body">
        {tab === '시세'       && <PriceTab apt={apt} />}
        {tab === '동네·이야기' && <NeighborhoodStoriesTab dong={apt.dong} aptNm={apt.aptNm} addr={apt.addr} lifeConditions={apt.lifeConditions} />}
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
        if (data?.response?.header?.resultCode !== '00') return
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

  const avgPerPy = trades?.length ? Math.round(trades.reduce((s, t) => s + t.perPy, 0) / trades.length) : 0
  const minPerPy = trades?.length ? Math.min(...trades.map(t => t.perPy)) : 0
  const maxPerPy = trades?.length ? Math.max(...trades.map(t => t.perPy)) : 0

  return (
    <div className="price-tab">
      {/* 가격 판단 카드 */}
      <div className="price-ai-card">
        <div className="price-ai-verdict">{apt.verdict}</div>
        <div className="price-ai-signals">
          <span className="price-ai-dir">{apt.direction}</span>
          {apt.priceJudgment?.level && (
            <span className={`price-ai-label ${{ '높은 수준': 'high', '중간 수준': 'mid', '낮은 수준': 'low' }[apt.priceJudgment.level] || ''}`}>
              {apt.priceJudgment.level}
            </span>
          )}
        </div>
        {apt.priceJudgment?.sentence && (
          <div className="price-ai-judgment">{apt.priceJudgment.sentence}</div>
        )}
      </div>

      {/* 기간 토글 */}
      <div className="price-tab-months">
        {[3, 6, 12].map(m => (
          <button
            key={m}
            className={`months-btn${months === m ? ' on' : ''}`}
            onClick={() => setMonths(m)}
          >
            {m}개월
          </button>
        ))}
      </div>

      {loading ? (
        <div className="detail-loading">실거래 데이터 불러오는 중...</div>
      ) : tradeError ? (
        <div className="detail-empty">거래 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>
      ) : !trades ? null : trades.length === 0 ? (
        <div className="detail-empty">최근 {months}개월 거래 내역이 없습니다</div>
      ) : (
        <>
          {/* 핵심 요약 — 항상 노출 */}
          <div className="price-tab-summary">
            <div className="price-summary-item">
              <div className="price-summary-label">평당 평균</div>
              <div className="price-summary-val">{fP(avgPerPy)}<span className="price-summary-unit">/평</span></div>
            </div>
            <div className="price-summary-item">
              <div className="price-summary-label">평당 범위</div>
              <div className="price-summary-val">{fR(minPerPy, maxPerPy)}</div>
            </div>
            <div className="price-summary-item">
              <div className="price-summary-label">거래</div>
              <div className="price-summary-val">{trades.length}건</div>
            </div>
          </div>

          {/* 평형 분포 */}
          <AreaBreakdown trades={trades} />

          {/* 실거래 내역 — 아코디언 */}
          <Accordion label="실거래 내역" count={trades.length}>
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

          {/* 실매물 바로가기 */}
          <div className="listing-deeplinks">
            <div className="listing-deeplinks-label">실매물 보기</div>
            <div className="listing-deeplinks-btns">
              <a className="listing-btn naver" href={`https://search.naver.com/search.naver?query=${encodeURIComponent(apt.aptNm + ' 아파트 매물')}`} target="_blank" rel="noopener noreferrer">네이버 매물검색</a>
              <a className="listing-btn hogang" href={`https://hogangnono.com/?q=${encodeURIComponent(apt.aptNm)}`} target="_blank" rel="noopener noreferrer">호갱노노</a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── 동네·이야기 통합 탭 ─────────────────── */
function NeighborhoodStoriesTab({ dong, aptNm, addr, lifeConditions }) {
  const d = DONG[dong] || {}
  const conditions = lifeConditions || {}
  const [vibe, setVibe] = useState(null)
  const [vibeLoading, setVibeLoading] = useState(true)
  const [stories, setStories] = useState([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    setVibe(null); setVibeLoading(true)
    setStories([]); setStoriesLoading(true)
    fetch(`/api/vibe?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`, { signal })
      .then(r => r.json())
      .then(data => { setVibe(data?.lines || []); setVibeLoading(false) })
      .catch(e => { if (e.name !== 'AbortError') { setVibe([]); setVibeLoading(false) } })
    fetch(`/api/stories?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`, { signal })
      .then(r => r.json())
      .then(data => { setStories(Array.isArray(data) ? data : []); setStoriesLoading(false) })
      .catch(e => { if (e.name !== 'AbortError') { setStories([]); setStoriesLoading(false) } })
    return () => controller.abort()
  }, [aptNm, dong])

  return (
    <div className="neighborhood-tab">
      {/* AI 분위기 요약 — 최상단 */}
      <div className="vibe-card">
        <div className="vibe-card-title">지금 이 동네 분위기</div>
        {vibeLoading ? (
          <div className="vibe-loading">AI 요약 생성 중...</div>
        ) : vibe && vibe.length > 0 ? (
          <ul className="vibe-lines">{vibe.map((line, i) => <li key={i}>{line}</li>)}</ul>
        ) : (
          <div className="vibe-empty">요약을 생성하지 못했습니다</div>
        )}
      </div>

      {/* 생활 여건 */}
      {(() => {
        const lc = conditions
        if (!lc || (!lc.mobility && !lc.infra && !lc.risk)) return null
        return (
          <div className="nbr-list">
            {lc.mobility && (
              <div className="nbr-row">
                <span className="nbr-row-label">이동</span>
                <span>{lc.mobility}</span>
              </div>
            )}
            {lc.infra && (
              <div className="nbr-row">
                <span className="nbr-row-label">생활</span>
                <span>{lc.infra}</span>
              </div>
            )}
            {lc.risk && (
              <div className="nbr-row nbr-row--risk">
                <span className="nbr-row-label">주의</span>
                <span>{lc.risk}</span>
              </div>
            )}
            {d.tag && <div className="nbr-tag-row"><span className="nbr-tag">{d.tag}</span></div>}
          </div>
        )
      })()}

      {/* 지도 */}
      <KakaoMap aptNm={aptNm} addr={addr} />
      <div className="map-deeplinks">
        {(() => { const q = encodeURIComponent(addr ? `${aptNm} ${addr.split(' ').slice(0, 3).join(' ')}` : aptNm); return (<>
          <a className="map-deeplink-btn" href={`https://map.kakao.com/link/search/${q}`} target="_blank" rel="noopener noreferrer">카카오지도</a>
          <a className="map-deeplink-btn" href={`https://map.naver.com/p/search/${q}`} target="_blank" rel="noopener noreferrer">네이버지도</a>
        </>)})()}
      </div>

      {/* 블로그 후기 — 아코디언 (기본 닫힘) */}
      <Accordion label="블로그 · 카페 후기" count={stories?.length ?? null}>
        {storiesLoading ? (
          <div className="detail-loading">후기 불러오는 중...</div>
        ) : !stories || stories.length === 0 ? (
          <div className="detail-empty">실거주 후기를 찾지 못했습니다</div>
        ) : (
          <div className="stories-tab">
            {stories
              .filter(s => s.link && isValidUrl(s.link))
              .map((s, i) => (
              <a key={i} className="story-card" href={s.link} target="_blank" rel="noopener noreferrer">
                <div className="story-card-title">{s.title}</div>
                {s.description && <div className="story-card-desc">{s.description}</div>}
                <div className="story-card-meta">{s.source}{s.date ? ` · ${s.date}` : ''}</div>
              </a>
            ))}
          </div>
        )}
      </Accordion>
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
    const q = addr ? `${aptNm} ${addr}` : aptNm
    fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => {
        if (data?.[0]) {
          const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon)
          if (isNaN(lat) || isNaN(lon) || lat < KR_LAT.min || lat > KR_LAT.max || lon < KR_LON.min || lon > KR_LON.max) {
            setFailed(true)
          } else {
            const c = { lat, lon }
            setCoordCache(cacheKey, c)
            setCoords(c)
          }
        } else setFailed(true)
      })
      .catch(() => setFailed(true))
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

