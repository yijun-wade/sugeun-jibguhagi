import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

const STATUS_STYLE = {
  '시행중': 'policy-status-active',
  '예정': 'policy-status-pending',
  '완화됨': 'policy-status-relaxed',
}

export default function PolicyPage() {
  const [policies, setPolicies] = useState([])
  const [updatedAt, setUpdatedAt] = useState('')

  useEffect(() => {
    fetch('/policies.json')
      .then(r => r.json())
      .then(d => { setPolicies(d.policies || []); setUpdatedAt(d.updatedAt || '') })
      .catch(() => {})
  }, [])

  return (
    <div className="app">
      <Helmet>
        <title>요즘 부동산 정책 · 수군수군 우리집</title>
        <meta name="description" content="지금 시행 중인 주요 부동산 정책을 실수요자 관점으로 쉽게 정리했어요. 대출 규제, 세금, 청약 등 꼭 알아야 할 정책 모음." />
        <link rel="canonical" href="https://www.suzip.kr/policy" />
        <meta property="og:title" content="요즘 부동산 정책 · 수군수군 우리집" />
        <meta property="og:description" content="지금 시행 중인 주요 부동산 정책을 실수요자 관점으로 쉽게 정리했어요." />
      </Helmet>

      <header className="site-header">
        <a href="/" className="site-header-logo">
          <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
        </a>
        <nav className="site-header-nav">
          <a href="/" className="site-nav-link">이불 속 임장</a>
          <a href="/briefing" className="site-nav-link">이불 속 뉴스</a>
          <a href="/policy" className="site-nav-link site-nav-active">이불 속 정책</a>
          <a href="/glossary" className="site-nav-link"><span className="nav-bubble">이불 속</span> 사전</a>
        </nav>
      </header>

      <div className="briefing-wrap">
        <div className="briefing-header">
          <h1 className="briefing-title">요즘 부동산 정책</h1>
          <p className="briefing-sub">지금 알아야 할 정책, 실수요자 눈높이로 정리했어요</p>
          {updatedAt && <div className="briefing-date">최종 업데이트 {updatedAt}</div>}
        </div>

        <div className="policy-list">
          {policies.map((p, i) => (
            <div key={i} className="policy-item">
              <div className="policy-item-header">
                <span className="policy-name">{p.name}</span>
                <span className={`policy-status ${STATUS_STYLE[p.status] || 'policy-status-relaxed'}`}>{p.status}</span>
              </div>
              <p className="policy-summary">{p.summary}</p>
              <p className="policy-detail">{p.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
