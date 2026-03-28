// src/DetailReport.jsx
import { useState, useEffect, useRef } from 'react'
import { fP, fR, getYM, nameSim, getLifeConditions } from './utils.js'
import { DONG } from './data.js'

const TABS = ['시세', '동네', '이야기']

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
        {tab === '시세'    && <PriceTab apt={apt} />}
        {tab === '동네'    && <NeighborhoodTab dong={apt.dong} aptNm={apt.aptNm} addr={apt.addr} />}
        {tab === '이야기'  && <StoriesTab aptNm={apt.aptNm} dong={apt.dong} />}
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

          {/* 실거래 내역 — 아코디언 */}
          <Accordion label="실거래 내역" count={trades.length}>
            <div className="trade-list">
              {trades.map((t, i) => (
                <div key={i} className="trade-row">
                  <div className="trade-date">{t.date}</div>
                  <div className="trade-amt">{fP(t.amt)}</div>
                  <div className="trade-meta">{t.area.toFixed(0)}㎡ · {t.floor}층</div>
                </div>
              ))}
            </div>
          </Accordion>
        </>
      )}
    </div>
  )
}

/* ── 동네 탭 ─────────────────────────────── */
function NeighborhoodTab({ dong, aptNm, addr }) {
  const d = DONG[dong] || {}
  const conditions = getLifeConditions(dong)

  return (
    <div className="neighborhood-tab">
      {/* 지도 — 항상 노출 */}
      <KakaoMap aptNm={aptNm} addr={addr} />

      {/* 외부 지도 링크 */}
      <div className="map-deeplinks">
        <a
          className="map-deeplink-btn"
          href={`https://map.kakao.com/link/search/${encodeURIComponent(aptNm)}`}
          target="_blank" rel="noopener noreferrer"
        >카카오지도</a>
        <a
          className="map-deeplink-btn"
          href={`https://map.naver.com/p/search/${encodeURIComponent(aptNm)}`}
          target="_blank" rel="noopener noreferrer"
        >네이버지도</a>
      </div>

      {/* 생활 여건 — 아코디언 */}
      {conditions.length > 0 && (
        <Accordion label="생활 여건" defaultOpen={true}>
          <div className="nbr-list">
            {conditions.map((item, i) => (
              <div key={i} className="nbr-row">
                <span className="nbr-icon">{item.icon}</span>
                <span className="nbr-text">{item.text}</span>
              </div>
            ))}
          </div>
          {d.tag && (
            <div className="nbr-tag-row">
              <span className="nbr-tag">{d.tag}</span>
            </div>
          )}
        </Accordion>
      )}
    </div>
  )
}

/* ── 카카오 지도 ─────────────────────────── */
function KakaoMap({ aptNm, addr }) {
  const mapRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current || !window.kakao) return

    window.kakao.maps.load(() => {
      const kakao = window.kakao
      const query = addr || aptNm

      function renderMap(coords) {
        if (!mapRef.current) return
        const map = new kakao.maps.Map(mapRef.current, { center: coords, level: 4 })
        new kakao.maps.Marker({ map, position: coords })
      }

      const geocoder = new kakao.maps.services.Geocoder()
      geocoder.addressSearch(query, (result, status) => {
        if (status === kakao.maps.services.Status.OK) {
          renderMap(new kakao.maps.LatLng(result[0].y, result[0].x))
        } else {
          const places = new kakao.maps.services.Places()
          places.keywordSearch(aptNm, (res, st) => {
            if (st !== kakao.maps.services.Status.OK || !res.length) return
            renderMap(new kakao.maps.LatLng(res[0].y, res[0].x))
          })
        }
      })
    })
  }, [aptNm, addr])

  return <div ref={mapRef} className="kakao-map" />
}

/* ── 이야기 탭 ───────────────────────────── */
function StoriesTab({ aptNm, dong }) {
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
    <div className="stories-tab">
      {/* Claude 요약 — 항상 노출 */}
      <div className="vibe-card">
        <div className="vibe-card-title">지금 이 동네 분위기</div>
        {vibeLoading ? (
          <div className="vibe-loading">AI 요약 생성 중...</div>
        ) : vibe && vibe.length > 0 ? (
          <ul className="vibe-lines">
            {vibe.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        ) : (
          <div className="vibe-empty">요약을 생성하지 못했습니다</div>
        )}
      </div>

      {/* 블로그 후기 — 아코디언 */}
      <Accordion label="블로그 · 카페 후기" count={stories?.length ?? null} defaultOpen={true}>
        {storiesLoading ? (
          <div className="detail-loading">후기 불러오는 중...</div>
        ) : !stories || stories.length === 0 ? (
          <div className="detail-empty">실거주 후기를 찾지 못했습니다</div>
        ) : (
          stories.map((s, i) => (
            <a key={i} className="story-card" href={s.link} target="_blank" rel="noopener noreferrer">
              <div className="story-card-title">{s.title}</div>
              {s.description && <div className="story-card-desc">{s.description}</div>}
              <div className="story-card-meta">{s.source}{s.date ? ` · ${s.date}` : ''}</div>
            </a>
          ))
        )}
      </Accordion>
    </div>
  )
}
