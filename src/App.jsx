import { useState, useCallback, useRef, useEffect } from 'react'
import { DONG, SEOUL, METRO, HINT_SEARCHES } from './data.js'
import { fP, fR, getYM, parseXml, calcPriceSignal, getLifeConditions, getVerdict, nameSim } from './utils.js'

/* ═══════════════════════════════════════
   유틸 상수
═══════════════════════════════════════ */
const PRESETS = {
  newlywed: ['노원구','마포구','은평구','강서구','성북구'],
  mayong:   ['마포구','용산구','성동구','광진구'],
  nodog:    ['노원구','도봉구','강북구'],
  gbuk:     ['강북구','노원구','도봉구','성북구','은평구','중랑구','동대문구'],
  gnam:     ['강남구','서초구','송파구','강동구','성동구','광진구'],
}

/* ═══════════════════════════════════════
   유틸 함수
═══════════════════════════════════════ */
function calcScore(c, dong) {
  const d = DONG[dong] || {}
  const age = 2026 - parseInt(c.buildYear || 1988)
  let s = 0
  s += Math.min(Math.round(c.count * 1.2), 20)
  s += age <= 5 ? 20 : age <= 10 ? 17 : age <= 15 ? 13 : age <= 25 ? 8 : 3
  s += Math.min(Math.max(Math.round((60000 - c.avg) / 2500), 0), 20)
  s += c.maxA >= 59 ? 15 : c.maxA >= 40 ? 10 : 3
  const bonus = { 학군최강:25, 역세권:20, 직주근접:20, 재건축기대:18, 교육환경:18, 미래가치:15, 생활편의:12, 대학가:10, 자연환경:8 }
  s += bonus[d.tag] || 0
  return Math.min(Math.round(s), 100)
}

function mkReview(c, dong) {
  const d = DONG[dong] || {}
  const age = 2026 - parseInt(c.buildYear || 1988)
  const parts = []
  if (d.sub) parts.push(d.sub)
  if (d.edu) parts.push(d.edu)
  else if (d.note) parts.push(d.note)
  if (age <= 5) parts.push(`${c.buildYear}년 신축`)
  else if (age >= 33) parts.push('재건축 대상 구축')
  if (c.maxA >= 59 && c.minA <= 59) parts.push('국민평수 59㎡ 보유')
  parts.push(c.avg < 35000 ? '3억대 실속형' : c.avg < 45000 ? '4억대 합리적' : c.avg < 55000 ? '5억대 안정' : '6억 근접 상급지')
  return parts.filter(Boolean).slice(0, 3).join(' · ')
}

function mkReasons(c, dong) {
  const d = DONG[dong] || {}
  const age = 2026 - parseInt(c.buildYear || 1988)
  const r = []
  r.push({ ic: '🚇', txt: d.sub ? d.sub + ' 역세권' : '버스 중심 교통 (현장 확인 권장)' })
  r.push({ ic: '💰', txt: `평균 ${(c.avg / 10000).toFixed(1)}억 · 거래 ${c.count}건으로 시장 검증` })
  if      (d.edu)      r.push({ ic: '🏫', txt: d.edu })
  else if (d.note)     r.push({ ic: '✨', txt: d.note })
  else if (age >= 33)  r.push({ ic: '🔨', txt: '재건축 추진 가능, 장기 보유시 기대' })
  else if (c.maxA >= 59) r.push({ ic: '📐', txt: '전용 59㎡ 이상 보유, 넉넉한 신혼 공간' })
  return r.slice(0, 3)
}

function analyze(trades) {
  const map = new Map()
  trades.forEach(t => {
    const key = `${t.regionName}__${t.dong}__${t.aptNm}`
    if (!map.has(key)) map.set(key, { ...t, prices: [], areas: [], count: 0 })
    const c = map.get(key)
    c.prices.push(t.amt); c.areas.push(t.area); c.count++
    if (t.buildYear && t.buildYear !== '1988') c.buildYear = t.buildYear
  })
  const res = []
  map.forEach(c => {
    if (c.count < 2) return
    c.minP = Math.min(...c.prices); c.maxP = Math.max(...c.prices)
    c.avg  = Math.round(c.prices.reduce((a, b) => a + b, 0) / c.prices.length)
    c.minA = Math.min(...c.areas);  c.maxA = Math.max(...c.areas)
    c.score = calcScore(c, c.dong)
    res.push(c)
  })
  return res.sort((a, b) => b.score - a.score).slice(0, 15)
}

/* ═══════════════════════════════════════
   서브 컴포넌트
═══════════════════════════════════════ */
function Vibe({ aptNm, location }) {
  const [lines, setLines] = useState(null)
  const [loading, setLoading] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    setLoading(true)
    fetch(`/api/vibe?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(location || '')}`)
      .then(r => r.json())
      .then(data => { setLines(data.lines || []); setLoading(false) })
      .catch(() => { setLines([]); setLoading(false) })
  }, [aptNm, location])

  if (loading) return (
    <div className="vibe-wrap">
      <div className="vibe-title">🌡 지금 분위기</div>
      <div className="vibe-loading">AI가 분위기 읽는 중...</div>
    </div>
  )
  if (!lines || lines.length === 0) return null
  return (
    <div className="vibe-wrap">
      <div className="vibe-title">🌡 지금 분위기</div>
      <div className="vibe-lines">
        {lines.map((line, i) => <div key={i} className="vibe-line">{line}</div>)}
      </div>
    </div>
  )
}

function Stories({ aptNm, dong }) {
  const [stories, setStories] = useState(null)
  const [loading, setLoading] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    setLoading(true)
    fetch(`/api/stories?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`)
      .then(r => r.json())
      .then(data => { setStories(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setStories([]); setLoading(false) })
  }, [aptNm, dong])

  if (loading) return <div className="stories-loading">블로그 후기 불러오는 중...</div>
  if (!stories || stories.length === 0) return null
  return (
    <div className="stories-section">
      <div className="sec-title" style={{ marginBottom: 8 }}>🗣 실거주 이야기</div>
      <div className="stories-list">
        {stories.map((s, i) => (
          <a key={i} className="story-item" href={s.link} target="_blank" rel="noopener noreferrer">
            <div className="story-title">{s.title}</div>
            {s.description && <div className="story-desc">{s.description}</div>}
            <div className="story-meta">{s.source}{s.date ? ` · ${s.date}` : ''}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

function RCard({ c, rank, showStories }) {
  const medals = ['', '🥇', '🥈', '🥉']
  const reasons = mkReasons(c, c.dong)
  const review  = mkReview(c, c.dong)
  return (
    <div className="rcard" data-r={String(rank)}>
      <div className="rcard-top">
        <div className="rcard-medal">{medals[rank]}</div>
        <div className="rcard-score">
          <div className="rcard-score-n">{c.score}</div>
          <div className="rcard-score-s">/ 100</div>
        </div>
      </div>
      <div className="rcard-name">{c.aptNm}</div>
      <div className="rcard-loc">{c.dong} · {c.regionName} · {c.buildYear}년식</div>
      <div className="price-box">
        <div className="price-range">{fR(c.minP, c.maxP)}</div>
        <div className="price-meta">
          <span className="avg">평균 {fP(c.avg)}</span>
          <span className="vol">거래 {c.count}건</span>
          <span>전용 {c.minA.toFixed(0)}~{c.maxA.toFixed(0)}㎡</span>
        </div>
      </div>
      <div className="divider" />
      <div className="reasons">
        {reasons.map((r, i) => (
          <div key={i} className="reason">
            <span className="reason-ic">{r.ic}</span>
            <span>{r.txt}</span>
          </div>
        ))}
      </div>
      <div className="review">{review}</div>
      {showStories && <Vibe aptNm={c.aptNm} location={`${c.dong} ${c.regionName}`} />}
      {showStories && <Stories aptNm={c.aptNm} dong={c.dong} />}
    </div>
  )
}

function RegionResults({ results, months, maxPrice }) {
  if (!results) return null
  const { complexes, total, regions } = results
  const rn = regions.map(r => r.name).join('·')
  return (
    <div className="results">
      <div className="res-summary">
        <span className="res-summary-info">🏢 아파트 · {rn} · 최근 {months}개월 · {maxPrice}억 이하</span>
        <span className="res-summary-count">{complexes.length}개 단지 발견</span>
      </div>
      <div className="sec-title">TOP 3 추천 단지</div>
      <div className="top3">
        {complexes.slice(0, 3).map((c, i) => (
          <RCard key={`${c.aptNm}-${i}`} c={c} rank={i + 1} showStories={i === 0} />
        ))}
      </div>
      {complexes.length > 3 && (
        <>
          <div className="sec-title" style={{ marginTop: 6 }}>전체 순위</div>
          <div className="apt-list">
            {complexes.slice(3).map((c, i) => (
              <div key={`${c.aptNm}-${i + 3}`} className="apt-row">
                <div className="apt-rank">{i + 4}</div>
                <div>
                  <div className="apt-name">{c.aptNm}</div>
                  <div className="apt-loc">{c.dong} · {c.regionName}</div>
                  <div className="apt-info">
                    <span className="pr">{fR(c.minP, c.maxP)}</span>
                    <span>평균 {fP(c.avg)}</span>
                    <span>{c.minA.toFixed(0)}~{c.maxA.toFixed(0)}㎡</span>
                    <span>{c.buildYear}년식</span>
                    <span>거래 {c.count}건</span>
                  </div>
                  <div className="apt-rev">{mkReview(c, c.dong)}</div>
                </div>
                <div className="apt-score">{c.score}점</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


function AptDetailView({ apt, tradeMonths, onChangeMonths }) {
  const [trades, setTrades] = useState(null)
  const [matchedNm, setMatchedNm] = useState(null) // 실제 매칭된 aptNm
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!apt?.bjdCode) return
    const lawdCd = apt.bjdCode.slice(0, 5)
    const dong = (apt.addr || '').split(' ').pop() // "종로구 내수동" → "내수동"
    const ymList = getYM(tradeMonths)
    setLoading(true)
    setError(null)
    setMatchedNm(null)
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
          const amt = parseInt((item.dealAmount || '').replace(/,/g, ''))
          if (isNaN(amt)) return
          all.push({
            aptNm: (item.aptNm || '').trim(),
            umdNm: (item.umdNm || '').trim(),
            date: `${item.dealYear}.${String(item.dealMonth).padStart(2,'0')}.${String(item.dealDay).padStart(2,'0')}`,
            amt,
            area: parseFloat(item.excluUseAr) || 0,
            floor: item.floor,
          })
        })
      })

      // 1) 동 필터 (가능하면)
      const byDong = dong ? all.filter(t => t.umdNm === dong) : all
      const pool = byDong.length > 0 ? byDong : all

      // 2) 단지명 유사도로 최선 매칭
      const scoreMap = new Map()
      pool.forEach(t => {
        if (!scoreMap.has(t.aptNm))
          scoreMap.set(t.aptNm, nameSim(t.aptNm, apt.kaptName))
      })
      const best = [...scoreMap.entries()].sort((a, b) => b[1] - a[1])[0]

      let filtered
      if (best && best[1] >= 0.5) {
        filtered = pool.filter(t => t.aptNm === best[0])
        setMatchedNm(best[0] !== apt.kaptName ? best[0] : null)
      } else {
        // 매칭 실패 → 동 전체 거래 표시
        filtered = pool
        setMatchedNm(pool.length > 0 ? '(인근 지역 전체 거래)' : null)
      }

      filtered.sort((a, b) => b.date.localeCompare(a.date))
      setTrades(filtered)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [apt, tradeMonths])

  if (!apt) return null

  return (
    <div className="apt-detail-card">
      <div className="apt-detail-name">{apt.kaptName}</div>
      <div className="apt-detail-addr">{apt.addr || '주소 정보 없음'}</div>
      {matchedNm && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, background: 'var(--blue-lt)', padding: '4px 10px', borderRadius: 8 }}>
          📌 실거래 데이터 기준명: {matchedNm}
        </div>
      )}

      <div className="trade-period-tabs">
        {[3, 6, 12].map(m => (
          <button
            key={m}
            className={`trade-period-tab${tradeMonths === m ? ' on' : ''}`}
            onClick={() => onChangeMonths(m)}
          >
            {m}개월
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <div className="loading-txt">실거래가 불러오는 중...</div>
        </div>
      )}
      {error && <div className="err-box"><b>⚠ 오류</b><p>{error}</p></div>}
      {!loading && trades && (
        trades.length === 0
          ? <div className="no-res">최근 {tradeMonths}개월 거래 내역이 없어요.</div>
          : (
            <>
              <div className="trade-summary">
                <div style={{ fontSize: 11, fontWeight: 700, color: '#78350f', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  최근 {tradeMonths}개월 거래 {trades.length}건
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#78350f' }}>
                  <span>최저 <strong>{fP(Math.min(...trades.map(t => t.amt)))}</strong></span>
                  <span>최고 <strong>{fP(Math.max(...trades.map(t => t.amt)))}</strong></span>
                  <span>평균 <strong>{fP(Math.round(trades.reduce((s, t) => s + t.amt, 0) / trades.length))}</strong></span>
                </div>
              </div>
              <div className="trade-list">
                {trades.slice(0, 20).map((t, i) => (
                  <div key={i} className="trade-row-item">
                    <span className="trade-row-date">{t.date}</span>
                    <span className="trade-row-price">{fP(t.amt)}</span>
                    <span className="trade-row-area">{t.area.toFixed(0)}㎡{t.floor ? ` · ${t.floor}층` : ''}</span>
                  </div>
                ))}
                {trades.length > 20 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0', textAlign: 'center' }}>
                    외 {trades.length - 20}건
                  </div>
                )}
              </div>
            </>
          )
      )}

      <Vibe aptNm={apt.kaptName} location={apt.addr || ''} />
      <Stories aptNm={apt.kaptName} dong="" />
    </div>
  )
}

/* ═══════════════════════════════════════
   메인 앱
═══════════════════════════════════════ */
export default function App() {
  // ─── 모드 ───
  const [mode, setMode] = useState('region') // 'region' | 'search'

  // ─── 지역 탐색 상태 ───
  const [selSeoul, setSelSeoul] = useState(new Set())
  const [selMetro, setSelMetro] = useState(new Set())
  const [curCtab, setCurCtab] = useState('seoul')
  const [chipsOpen, setChipsOpen] = useState(false)
  const [maxPrice, setMaxPrice] = useState(6)
  const [months, setMonths] = useState(3)
  const [loading, setLoading] = useState(false)
  const [loadingTxt, setLoadingTxt] = useState('')
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)

  // ─── 이름 검색 상태 ───
  const [query, setQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [searchList, setSearchList] = useState(null)
  const [selectedApt, setSelectedApt] = useState(null)
  const [aptInfo, setAptInfo] = useState(null)
  const [tradeMonths, setTradeMonths] = useState(3)
  const aptListRef = useRef(null) // 전국 단지 목록 캐시

  // 검색 탭 진입 시 apt-list.json 한 번만 로드
  useEffect(() => {
    if (mode !== 'search' || aptListRef.current) return
    fetch('/apt-list.json')
      .then(r => r.json())
      .then(data => { aptListRef.current = data })
      .catch(() => {})
  }, [mode])

  // ─── 지역 탐색: 지역 토글 ───
  const totalSel = selSeoul.size + selMetro.size

  function toggleChip(tab, name) {
    if (tab === 'seoul') {
      setSelSeoul(prev => {
        const next = new Set(prev)
        next.has(name) ? next.delete(name) : next.add(name)
        return next
      })
    } else {
      setSelMetro(prev => {
        const next = new Set(prev)
        next.has(name) ? next.delete(name) : next.add(name)
        return next
      })
    }
  }

  function quickSel(type) {
    const names = PRESETS[type] || []
    setSelSeoul(prev => {
      const next = new Set(prev)
      names.forEach(n => { if (SEOUL[n]) next.add(n) })
      return next
    })
    setSelMetro(prev => {
      const next = new Set(prev)
      names.forEach(n => { if (METRO[n]) next.add(n) })
      return next
    })
  }

  function clearAll() {
    setSelSeoul(new Set())
    setSelMetro(new Set())
  }

  // ─── 지역 탐색: API 호출 ───
  async function doFetch() {
    const maxAmt = maxPrice * 10000
    const regions = []
    selSeoul.forEach(n => regions.push({ name: n, code: SEOUL[n] }))
    selMetro.forEach(n => regions.push({ name: n, code: METRO[n] }))
    if (!regions.length) return

    const ymList = getYM(months)
    setLoading(true)
    setError(null)
    setResults(null)
    setLoadingTxt(`조회 중... (${regions.length}개 지역 × ${months}개월)`)

    const allTrades = []
    try {
      const tasks = regions.flatMap(r => ymList.map(ym => ({ r, ym, key: `trades_${r.code}_${ym}` })))
      const fetched = await Promise.all(tasks.map(async ({ r, ym, key }) => {
        try {
          const cached = sessionStorage.getItem(key)
          const xml = cached || await (async () => {
            const res = await fetch(`/api/trades?lawd_cd=${r.code}&deal_ymd=${ym}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const text = await res.text()
            try { sessionStorage.setItem(key, text) } catch (e) { /* ignore */ }
            return text
          })()
          return parseXml(xml, r.name)
        } catch (e) { console.warn(r.name, ym, e); return [] }
      }))
      fetched.forEach(t => allTrades.push(...t))

      if (!allTrades.length) { setError('조회된 데이터가 없습니다.'); return }
      const filtered = allTrades.filter(t => t.amt <= maxAmt)
      if (!filtered.length) { setError(`${maxPrice}억 이하 아파트 거래가 없습니다.`); return }

      const complexes = analyze(filtered)
      setResults({ complexes, total: filtered.length, regions })
    } catch (e) {
      setError('API 연결 오류가 발생했습니다.\n로컬 개발 시: npx vercel dev')
    } finally {
      setLoading(false)
    }
  }

  // ─── 이름 검색: 로컬 필터링 ───
  async function doSearch() {
    if (!query.trim()) return
    setSearchLoading(true)
    setSearchError(null)
    setSearchList(null)
    setSelectedApt(null)
    setAptInfo(null)

    // 아직 로드 안 됐으면 기다리기
    if (!aptListRef.current) {
      try {
        const res = await fetch('/apt-list.json')
        aptListRef.current = await res.json()
      } catch (e) {
        setSearchError('단지 목록 로드 실패: ' + e.message)
        setSearchLoading(false)
        return
      }
    }

    const q = query.trim()
    const matched = aptListRef.current
      .filter(i => i.kaptName?.includes(q))
      .slice(0, 20)
    setSearchList(matched)
    if (!matched.length) setSearchError('검색 결과가 없어요. 다른 이름으로 시도해보세요.')
    setSearchLoading(false)
  }

  // ─── 이름 검색: 단지 선택 (bjdCode 이미 포함됨) ───
  function selectApt(item) {
    setSelectedApt(item)
    setAptInfo({ kaptName: item.kaptName, bjdCode: item.bjdCode, addr: item.location })
  }

  // ─── 렌더 ───
  return (
    <div className="app">
      {/* HEADER */}
      <header>
        <div className="brand">🏠 수근수근 집구하기</div>
        <div className="brand-sub">내 집 실거래가 확인부터 이사할 동네 탐색까지</div>
        <div className="brand-tags">
          <span className="brand-tag apt">🏢 아파트 매물</span>
          <span className="brand-tag">📊 국토부 실거래가</span>
          <span className="brand-tag">🗣 실거주 이야기</span>
        </div>
      </header>

      {/* MODE TABS */}
      <div className="mode-tabs">
        <button className={`mode-tab${mode === 'region' ? ' on' : ''}`} onClick={() => setMode('region')}>
          🗺 지역 탐색
        </button>
        <button className={`mode-tab${mode === 'search' ? ' on' : ''}`} onClick={() => setMode('search')}>
          🔍 아파트 검색
        </button>
      </div>

      {/* ──────────────── 지역 탐색 모드 ──────────────── */}
      {mode === 'region' && (
        <>
          <div className="search-card">
            {/* 지역 선택 */}
            <div className="ss">
              <div className="ss-q">어디서 살고 싶어요?</div>
              <div className="quick-row">
                <span className="qlabel">테마</span>
                <button className="qbtn theme" onClick={() => quickSel('newlywed')}>💑 신혼부부 픽</button>
                <button className="qbtn theme" onClick={() => quickSel('mayong')}>🌊 마용성광</button>
                <button className="qbtn theme" onClick={() => quickSel('nodog')}>🍃 노도강</button>
                <span className="qlabel" style={{ marginLeft: 4 }}>지역</span>
                <button className="qbtn" onClick={() => quickSel('gbuk')}>서울 강북권</button>
                <button className="qbtn" onClick={() => quickSel('gnam')}>서울 강남권</button>
              </div>

              <button className={`expand-toggle${chipsOpen ? ' open' : ''}`} onClick={() => setChipsOpen(v => !v)}>
                직접 선택하기 <span className="arr">▾</span>
              </button>

              {chipsOpen && (
                <div style={{ marginTop: 14 }}>
                  <div className="ctabs">
                    <button className={`ctab${curCtab === 'seoul' ? ' on' : ''}`} onClick={() => setCurCtab('seoul')}>서울</button>
                    <button className={`ctab${curCtab === 'metro' ? ' on' : ''}`} onClick={() => setCurCtab('metro')}>경기·인천</button>
                  </div>
                  {curCtab === 'seoul' && (
                    <div className="chip-grid">
                      {Object.keys(SEOUL).map(name => (
                        <button key={name} className={`chip${selSeoul.has(name) ? ' on' : ''}`} onClick={() => toggleChip('seoul', name)}>
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  {curCtab === 'metro' && (
                    <div className="chip-grid">
                      {Object.keys(METRO).map(name => (
                        <button key={name} className={`chip${selMetro.has(name) ? ' on' : ''}`} onClick={() => toggleChip('metro', name)}>
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="sel-row">
                    <span className="sel-count">{totalSel > 0 ? `${totalSel}개 지역 선택됨` : ''}</span>
                    <button className="sel-clear" onClick={clearAll}>전체 해제</button>
                  </div>
                </div>
              )}
            </div>

            {/* 예산/기간 */}
            <div className="ss">
              <div className="cond-grid">
                <div className="cond-col">
                  <div className="ss-label">💰 최대 예산</div>
                  <div className="pill-wrap">
                    <div className="pill-row">
                      {[3, 4, 5, 6, 8, 10].map(v => (
                        <button
                          key={v}
                          className={`pill${v === 6 ? ' rec' : ''}${maxPrice === v ? ' on' : ''}`}
                          onClick={() => setMaxPrice(v)}
                        >
                          {v === 10 ? '10억+' : `${v}억`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pill-hint">신혼 첫 아파트로 가장 많이 선택하는 예산이에요</div>
                </div>
                <div className="cond-col">
                  <div className="ss-label">📅 조회 기간</div>
                  <div className="pill-wrap">
                    <div className="pill-row">
                      {[1, 3, 6, 12].map(v => (
                        <button
                          key={v}
                          className={`pill ppill${months === v ? ' on' : ''}`}
                          onClick={() => setMonths(v)}
                        >
                          {v}개월
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="sc-cta">
              <button className="cta" onClick={doFetch} disabled={totalSel === 0 || loading}>
                {loading ? '🔄 조회 중...' : '🔍 아파트 찾기'}
              </button>
            </div>
          </div>

          {/* 로딩 */}
          {loading && (
            <div className="loading">
              <div className="spinner" />
              <div className="loading-txt">{loadingTxt}</div>
            </div>
          )}

          {/* 에러 */}
          {error && !loading && (
            <div className="err-box">
              <b>⚠ 오류</b>
              <p>{error}</p>
            </div>
          )}

          {/* 결과 */}
          {results && !loading && (
            <RegionResults results={results} months={months} maxPrice={maxPrice} />
          )}
        </>
      )}

      {/* ──────────────── 이름 검색 모드 ──────────────── */}
      {mode === 'search' && (
        <>
          <div className="search-card">
            <div className="ss">
              <div className="ss-q">아파트 이름으로 찾기</div>
              <div className="name-search-wrap">
                <input
                  className="name-input"
                  type="text"
                  placeholder="예: 래미안, 힐스테이트, 자이..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                />
                <button className="name-search-btn" onClick={doSearch} disabled={!query.trim() || searchLoading}>
                  {searchLoading ? '검색 중' : '검색'}
                </button>
              </div>

              {searchLoading && (
                <div className="loading" style={{ padding: '20px 0' }}>
                  <div className="spinner" />
                  <div className="loading-txt">검색 중...</div>
                </div>
              )}

              {searchError && !searchLoading && (
                <div className="err-box" style={{ marginTop: 12 }}>
                  <b>⚠ 오류</b><p>{searchError}</p>
                </div>
              )}

              {searchList && !searchLoading && searchList.length > 0 && (
                <div className="search-results-list">
                  {searchList.map(item => (
                    <div
                      key={item.kaptCode}
                      className={`search-result-item${selectedApt?.kaptCode === item.kaptCode ? ' selected' : ''}`}
                      onClick={() => selectApt(item)}
                    >
                      <span className="search-result-name">{item.kaptName}</span>
                      <span className="search-result-code">{item.kaptCode}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 단지 상세 */}
          {aptInfo && (
            aptInfo.bjdCode
              ? <AptDetailView apt={aptInfo} tradeMonths={tradeMonths} onChangeMonths={setTradeMonths} />
              : (
                <div className="err-box">
                  <b>⚠ 단지 정보 없음</b>
                  <p>{aptInfo.kaptName}의 상세 정보를 가져오지 못했어요.</p>
                </div>
              )
          )}
        </>
      )}
    </div>
  )
}
