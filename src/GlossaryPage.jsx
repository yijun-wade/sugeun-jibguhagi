import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

const CATEGORIES = ['전체', '계약', '대출', '세금', '시장', '기타']

export default function GlossaryPage() {
  const navigate = useNavigate()
  const [terms, setTerms] = useState([])
  const [category, setCategory] = useState('전체')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetch('/glossary.json').then(r => r.json()).then(setTerms).catch(() => {})
  }, [])

  const filtered = terms.filter(t => {
    const matchCat = category === '전체' || t.category === category
    const matchQ = !query || t.term.includes(query) || t.definition.includes(query)
    return matchCat && matchQ
  })

  return (
    <div className="app">
      <Helmet>
        <title>부동산 용어사전 · 수군수군 우리집</title>
        <meta name="description" content="아파트 매매·전세·월세에서 꼭 알아야 할 부동산 용어를 쉽게 설명합니다. 예시와 함께 이해하는 부동산 용어사전." />
        <link rel="canonical" href="https://www.suzip.kr/glossary" />
        <meta property="og:title" content="부동산 용어사전 · 수군수군 우리집" />
        <meta property="og:description" content="매매·전세·월세·대출·세금 용어를 예시와 함께 쉽게 설명합니다." />
      </Helmet>

      <header className="site-header">
        <a href="/" className="site-header-logo">
          <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
        </a>
        <nav className="site-header-nav">
          <a href="/" className="site-nav-link">아파트 검색</a>
          <a href="/briefing" className="site-nav-link">부동산 브리핑</a>
          <a href="/policy" className="site-nav-link">요즘 정책</a>
          <a href="/glossary" className="site-nav-link site-nav-active">용어사전</a>
        </nav>
      </header>

      <div className="briefing-wrap">
        <div className="briefing-header">
          <h1 className="briefing-title">부동산 용어사전</h1>
          <p className="briefing-sub">매매·전세·월세, 처음이라도 괜찮아요</p>
        </div>

        <input
          className="glossary-search"
          placeholder="용어 검색..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className="glossary-cats">
          {CATEGORIES.map(c => (
            <button
              key={c}
              className={`glossary-cat-btn${category === c ? ' glossary-cat-active' : ''}`}
              onClick={() => setCategory(c)}
            >{c}</button>
          ))}
        </div>

        <div className="glossary-list">
          {filtered.map((t, i) => (
            <div
              key={t.term}
              className={`glossary-item${expanded === i ? ' glossary-item-open' : ''}`}
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div className="glossary-item-header">
                <div className="glossary-item-left">
                  <span className="glossary-term">{t.term}</span>
                  <span className="glossary-cat-badge">{t.category}</span>
                </div>
                <span className="glossary-definition">{t.definition}</span>
                <span className="glossary-chevron">{expanded === i ? '∧' : '∨'}</span>
              </div>
              {expanded === i && (
                <div className="glossary-item-body">
                  <p className="glossary-explain">{t.explain}</p>
                  <p className="glossary-example">{t.example}</p>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="glossary-empty">검색 결과가 없어요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
