// src/DetailReport.jsx
import { useState, useEffect, useRef } from 'react'
import { fP, fR, getYM, nameSim, getLifeConditions } from './utils.js'
import { DONG } from './data.js'

const TABS = ['가격', '동네', '이야기']

export default function DetailReport({ apt, onBack }) {
  const [tab, setTab] = useState('가격')

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
        {tab === '가격'    && <PriceTab apt={apt} />}
        {tab === '동네'    && <NeighborhoodTab dong={apt.dong} />}
        {tab === '이야기'  && <StoriesTab aptNm={apt.aptNm} dong={apt.dong} />}
      </div>
    </div>
  )
}

/* ── 가격 탭 ─────────────────────────────── */
function PriceTab({ apt }) {
  const [trades, setTrades] = useState(null)
  const [months, setMonths] = useState(3)
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

  if (loading) return <div className="detail-loading">실거래 데이터 불러오는 중...</div>
  if (!trades) return null

  const avg = trades.length ? Math.round(trades.reduce((s, t) => s + t.amt, 0) / trades.length) : 0
  const minP = trades.length ? Math.min(...trades.map(t => t.amt)) : 0
  const maxP = trades.length ? Math.max(...trades.map(t => t.amt)) : 0

  return (
    <div className="price-tab">
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

      {trades.length > 0 ? (
        <>
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

          <div className="trade-list">
            {trades.map((t, i) => (
              <div key={i} className="trade-row">
                <div className="trade-date">{t.date}</div>
                <div className="trade-amt">{fP(t.amt)}</div>
                <div className="trade-meta">{t.area.toFixed(0)}㎡ · {t.floor}층</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="detail-empty">최근 {months}개월 거래 내역이 없습니다</div>
      )}
    </div>
  )
}

/* ── 동네 탭 ─────────────────────────────── */
function NeighborhoodTab({ dong }) {
  const d = DONG[dong] || {}
  const conditions = getLifeConditions(dong)

  return (
    <div className="neighborhood-tab">
      {conditions.length > 0 ? (
        <div className="nbr-list">
          {conditions.map((item, i) => (
            <div key={i} className="nbr-row">
              <span className="nbr-icon">{item.icon}</span>
              <span className="nbr-text">{item.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="detail-empty">동네 정보를 준비 중입니다</div>
      )}

      {d.tag && (
        <div className="nbr-tag-row">
          <span className="nbr-tag">{d.tag}</span>
        </div>
      )}
    </div>
  )
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
      {/* 지금 분위기 요약 카드 */}
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

      {/* 블로그/카페 후기 목록 */}
      {storiesLoading ? (
        <div className="detail-loading">블로그 후기 불러오는 중...</div>
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
    </div>
  )
}
