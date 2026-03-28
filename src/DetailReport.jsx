// src/DetailReport.jsx
import { useState, useEffect, useRef } from 'react'
import { fP, fR, getYM, nameSim, getLifeConditions } from './utils.js'
import { DONG } from './data.js'

const TABS = ['시세', '동네·이야기']

export default function DetailReport({ apt, onBack }) {
  const [tab, setTab] = useState('시세')

  return (
    <div className="detail-report">
      <div className="detail-header">
        <button className="detail-back" onClick={onBack}>← 뒤로</button>
        <div className="detail-title">
          <div className="detail-apt-name">{apt.aptNm}</div>
          <div className="detail-apt-loc">{apt.dong} · {apt.regionName}</div>
        </div>
      </div>

      <div className="detail-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`detail-tab${tab === t ? ' on' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="detail-body">
        {tab === '시세'       && <PriceTab apt={apt} />}
        {tab === '동네·이야기' && <NeighborhoodStoriesTab dong={apt.dong} aptNm={apt.aptNm} addr={apt.addr} />}
      </div>
    </div>
  )
}

/* ── 아코디언 공통 컴포넌트 ─────────────────── */
function Accordion({ label, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="accordion">
      <button className="accordion-toggle" onClick={() => setOpen(o => !o)}>
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

  useEffect(() => {
    if (!apt?.bjdCode) return
    const lawdCd = apt.bjdCode.slice(0, 5)
    const ymList = getYM(months)
    setLoading(true)
    Promise.all(
      ymList.map(ym =>
        fetch(`/api/trade?lawdCd=${lawdCd}&dealYmd=${ym}`)
          .then(r => r.json())
          .catch(() => null)
      )
    ).then(results => {
      const all = []
      results.forEach(data => {
        if (!data) return
        const items = data?.response?.body?.items?.item
        if (!items) return
        const arr = Array.isArray(items) ? items : [items]
        arr.forEach(item => {
          const nm   = (item.aptNm || '').trim()
          const amt  = parseInt((item.dealAmount || '').replace(/,/g, ''))
          const area = parseFloat(item.excluUseAr) || 0
          const date = `${item.dealYear}-${String(item.dealMonth).padStart(2,'0')}-${String(item.dealDay).padStart(2,'0')}`
          const floor = item.floor || '-'
          if (nameSim(nm, apt.aptNm) < 0.6 || isNaN(amt)) return
          all.push({ date, amt, area, floor, nm })
        })
      })
      all.sort((a, b) => b.date.localeCompare(a.date))
      setTrades(all)
      setLoading(false)
    })
  }, [apt, months])

  const avg = trades?.length ? Math.round(trades.reduce((s, t) => s + t.amt, 0) / trades.length) : 0
  const minP = trades?.length ? Math.min(...trades.map(t => t.amt)) : 0
  const maxP = trades?.length ? Math.max(...trades.map(t => t.amt)) : 0

  return (
    <div className="price-tab">
      {/* AI 요약 카드 */}
      <div className="price-ai-card">
        <div className="price-ai-verdict">{apt.verdict}</div>
        <div className="price-ai-signals">
          <span className="price-ai-dir">{apt.direction}</span>
          <span className={`price-ai-label ${apt.priceLabel}`}>{apt.priceLabel}</span>
        </div>
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
      ) : !trades ? null : trades.length === 0 ? (
        <div className="detail-empty">최근 {months}개월 거래 내역이 없습니다</div>
      ) : (
        <>
          {/* 핵심 요약 — 항상 노출 */}
          <div className="price-tab-summary">
            <div className="price-summary-item">
              <div className="price-summary-label">평균</div>
              <div className="price-summary-val">{fP(avg)}</div>
            </div>
            <div className="price-summary-item">
              <div className="price-summary-label">범위</div>
              <div className="price-summary-val">{fR(minP, maxP)}</div>
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
                  <div className="trade-amt">{fP(t.amt)}</div>
                  <div className="trade-meta">{t.area.toFixed(0)}㎡ · 약 {Math.round(t.area / 3.3)}평 · {t.floor}층</div>
                </div>
              ))}
            </div>
          </Accordion>

          {/* 실매물 바로가기 */}
          <div className="listing-deeplinks">
            <div className="listing-deeplinks-label">실매물 보기</div>
            <div className="listing-deeplinks-btns">
              <a className="listing-btn naver" href={`https://land.naver.com/search?query=${encodeURIComponent(apt.aptNm)}`} target="_blank" rel="noopener noreferrer">네이버 부동산</a>
              <a className="listing-btn hogang" href={`https://hogangnono.com/apt/search?query=${encodeURIComponent(apt.aptNm)}`} target="_blank" rel="noopener noreferrer">호갱노노</a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── 동네·이야기 통합 탭 ─────────────────── */
function NeighborhoodStoriesTab({ dong, aptNm, addr }) {
  const d = DONG[dong] || {}
  const conditions = getLifeConditions(dong)
  const [vibe, setVibe] = useState(null)
  const [vibeLoading, setVibeLoading] = useState(true)
  const [stories, setStories] = useState(null)
  const [storiesLoading, setStoriesLoading] = useState(true)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    fetch(`/api/vibe?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`)
      .then(r => r.json())
      .then(data => { setVibe(data?.lines || []); setVibeLoading(false) })
      .catch(() => { setVibe([]); setVibeLoading(false) })
    fetch(`/api/stories?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`)
      .then(r => r.json())
      .then(data => { setStories(Array.isArray(data) ? data : []); setStoriesLoading(false) })
      .catch(() => { setStories([]); setStoriesLoading(false) })
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
      {conditions.length > 0 && (
        <div className="nbr-list">
          {conditions.map((item, i) => (
            <div key={i} className="nbr-row">
              <span className="nbr-icon">{item.icon}</span>
              <span className="nbr-text">{item.text}</span>
            </div>
          ))}
          {d.tag && <div className="nbr-tag-row"><span className="nbr-tag">{d.tag}</span></div>}
        </div>
      )}

      {/* 지도 */}
      <OSMMap aptNm={aptNm} addr={addr} />
      <div className="map-deeplinks">
        <a className="map-deeplink-btn" href={`https://map.kakao.com/link/search/${encodeURIComponent(aptNm)}`} target="_blank" rel="noopener noreferrer">카카오지도</a>
        <a className="map-deeplink-btn" href={`https://map.naver.com/p/search/${encodeURIComponent(aptNm)}`} target="_blank" rel="noopener noreferrer">네이버지도</a>
      </div>

      {/* 블로그 후기 — 아코디언 (기본 닫힘) */}
      <Accordion label="블로그 · 카페 후기" count={stories?.length ?? null}>
        {storiesLoading ? (
          <div className="detail-loading">후기 불러오는 중...</div>
        ) : !stories || stories.length === 0 ? (
          <div className="detail-empty">실거주 후기를 찾지 못했습니다</div>
        ) : (
          <div className="stories-tab">
            {stories.map((s, i) => (
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
    const py = Math.round(t.area / 3.3)
    const bucket = `${Math.floor(py / 10) * 10}평대`
    if (!groups[bucket]) groups[bucket] = { count: 0, total: 0 }
    groups[bucket].count++
    groups[bucket].total += t.amt
  })

  const sorted = Object.entries(groups).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
  if (sorted.length === 0) return null

  return (
    <div className="area-breakdown">
      {sorted.map(([bucket, { count, total }]) => (
        <div key={bucket} className="area-bucket">
          <div className="area-bucket-label">{bucket}</div>
          <div className="area-bucket-avg">{fP(Math.round(total / count))}</div>
          <div className="area-bucket-count">{count}건</div>
        </div>
      ))}
    </div>
  )
}

/* ── OpenStreetMap 지도 ──────────────────── */
function OSMMap({ aptNm, addr }) {
  const [coords, setCoords] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const q = addr ? `${aptNm} ${addr}` : aptNm
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=kr`, {
      headers: { 'User-Agent': 'sugeun-jibguhagi/1.0' }
    })
      .then(r => r.json())
      .then(data => {
        if (data?.[0]) setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) })
        else setFailed(true)
      })
      .catch(() => setFailed(true))
  }, [aptNm, addr])

  if (failed) return null
  if (!coords) return <div className="osm-map osm-map-loading">지도 불러오는 중...</div>

  const d = 0.006
  const bbox = `${coords.lon - d},${coords.lat - d},${coords.lon + d},${coords.lat + d}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat},${coords.lon}`

  return <iframe className="osm-map" src={src} title="지도" loading="lazy" />
}

