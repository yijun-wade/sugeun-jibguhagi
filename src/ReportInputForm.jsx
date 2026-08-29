import { useState, useEffect, useRef } from 'react'
import { track } from './analytics.js'

// 입력 폼: 단지 검색 + 매가 + 보유 기간 + 추가 저축
// props: initial { kaptCode, aptName, price, years, savings }, onSubmit({ kaptCode, aptName, price, years, savings })

export default function ReportInputForm({ initial, onSubmit }) {
  const [aptQuery, setAptQuery]       = useState(initial?.aptName || '')
  const [aptCode, setAptCode]         = useState(initial?.kaptCode || '')
  const [priceManwon, setPriceManwon] = useState(initial?.price || 50000)
  const [years, setYears]             = useState(initial?.years || 5)
  const [savings, setSavings]         = useState(initial?.savings ?? 10000)
  const [suggestions, setSuggestions] = useState([])
  const [showSugg, setShowSugg]       = useState(false)
  const debounceRef = useRef(null)
  const abortRef    = useRef(null)

  // 자동완성 (App.jsx의 handleQueryChange 패턴 재활용)
  useEffect(() => {
    if (!aptQuery || aptQuery.length < 1 || aptCode) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(aptQuery)}`, { signal: controller.signal })
        const data = await res.json()
        // 리포트 입력은 목록 높이가 더 작으므로(46dvh) 10개로 둔다
        setSuggestions(Array.isArray(data) ? data.slice(0, 10) : [])
        setShowSugg(true)
      } catch {}
    }, 200)
    return () => clearTimeout(debounceRef.current)
  }, [aptQuery, aptCode])

  // 단지 선택 시 매가 prefill (apt-prices.json 활용)
  async function pickApt(apt) {
    setAptCode(apt.kaptCode)
    setAptQuery(apt.kaptName)
    setShowSugg(false)
    setSuggestions([])
    track('report_apt_select', { apt_name: apt.kaptName, kapt_code: apt.kaptCode })

    // prefill 매가: apt-discovery.json에서 검색
    try {
      const r = await fetch('/apt-discovery.json').then(r => r.json())
      const found = r.find(a => a.code === apt.kaptCode)
      if (found?.avg) setPriceManwon(found.avg)
    } catch {}
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!aptCode) {
      alert('단지를 검색해서 선택해주세요')
      return
    }
    track('report_input_submit', {
      kapt_code: aptCode,
      apt_name: aptQuery,
      price_manwon: priceManwon,
      years,
      savings_manwon: savings,
    })
    onSubmit({ kaptCode: aptCode, aptName: aptQuery, price: priceManwon, years, savings })
  }

  function fmtEok(manwon) {
    return (manwon / 10000).toFixed(1).replace(/\.0$/, '') + '억'
  }

  return (
    <form className="report-input-form" onSubmit={handleSubmit}>
      <div className="report-field">
        <label className="report-label">어떤 아파트가 궁금하세요?</label>
        <p className="report-hint">아파트 이름을 검색해서 골라주세요</p>
        <div className="report-input-wrap">
          <input
            type="text"
            className="report-input"
            placeholder="예: 잠실파크리오, 아크로타워스퀘어"
            value={aptQuery}
            onChange={(e) => { setAptQuery(e.target.value); setAptCode(''); }}
            onFocus={() => suggestions.length > 0 && setShowSugg(true)}
            onBlur={() => setTimeout(() => setShowSugg(false), 200)}
          />
          {showSugg && suggestions.length > 0 && (
            <ul className="report-sugg-list">
              {suggestions.map(apt => (
                <li
                  key={apt.kaptCode}
                  className="report-sugg-item"
                  // pointerdown은 손가락이 닿는 순간 발생해, 목록을 스크롤하려고 터치만 해도
                  // 즉시 선택돼버린다(모바일에서 목록을 내려볼 수 없었다).
                  // preventDefault만 남겨 입력창 blur로 목록이 닫히는 것을 막고,
                  // 실제 선택은 click에서 한다 — 스크롤한 손가락에는 click이 발생하지 않는다.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pickApt(apt)}
                >
                  <span className="report-sugg-name">{apt.kaptName}</span>
                  <span className="report-sugg-addr">{apt.addr?.split(' ').slice(1, 4).join(' ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="report-field">
        <label className="report-label">얼마에 살까 고민 중이세요? <span className="report-label-value">{fmtEok(priceManwon)}</span></label>
        <p className="report-hint">호가나 실거래가를 보고 슬라이더로 조정하세요</p>
        <input
          type="range"
          min={10000} max={300000} step={5000}
          value={priceManwon}
          onChange={(e) => setPriceManwon(parseInt(e.target.value, 10))}
          className="report-slider"
        />
      </div>

      <div className="report-field">
        <label className="report-label">몇 년 정도 살 생각이세요?</label>
        <p className="report-hint">3년 / 5년 후 시점의 시나리오 가격을 계산해드려요</p>
        <div className="report-radios">
          {[3, 5].map(y => (
            <label key={y} className={`report-radio${years === y ? ' on' : ''}`}>
              <input
                type="radio" name="years" value={y}
                checked={years === y}
                onChange={() => setYears(y)}
              />
              {y}년
            </label>
          ))}
        </div>
      </div>

      <div className="report-field">
        <label className="report-label">그 사이 얼마나 더 모을 수 있어요? <span className="report-label-value">{fmtEok(savings)}</span></label>
        <p className="report-hint">집값 + 저축 합쳐서 다음 집 갈아타기까지 같이 계산해요</p>
        <input
          type="range"
          min={0} max={30000} step={5000}
          value={savings}
          onChange={(e) => setSavings(parseInt(e.target.value, 10))}
          className="report-slider"
        />
      </div>

      <button type="submit" className="report-submit-btn">이 집 살까말까 진단하기</button>
    </form>
  )
}
