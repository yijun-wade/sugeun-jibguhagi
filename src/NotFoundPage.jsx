// 없는 주소 — 전에는 와일드카드가 전부 홈(SearchApp)으로 흡수해서 오타 URL·없어진 단지 코드가
// 모두 200에 같은 홈 내용으로 색인됐다. 단지 페이지가 6,887개라 중복 후보도 그만큼 많다.
// SPA라 상태 코드는 못 바꾸지만 noindex로 색인은 막고, 사람에게는 되돌아갈 길을 준다.
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { track } from './analytics.js'
import { useEffect } from 'react'

export default function NotFoundPage({ reason = 'route' }) {
  const navigate = useNavigate()
  useEffect(() => {
    track('not_found', { reason, path: window.location.pathname })
  }, [reason])

  return (
    <div className="app">
      <Helmet>
        <title>페이지를 찾을 수 없어요 · 수군수군 우리집</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <header onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <div className="brand">
          <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
        </div>
        <div className="brand-en">SuZip · 수집</div>
      </header>
      <div className="notfound">
        <h1 className="notfound-title">
          {reason === 'apt' ? '이 단지를 찾지 못했어요' : '페이지를 찾을 수 없어요'}
        </h1>
        <p className="notfound-desc">
          {reason === 'apt'
            ? '주소가 바뀌었거나 없어진 단지일 수 있어요. 단지 이름으로 다시 찾아보세요.'
            : '주소를 다시 확인해 주세요.'}
        </p>
        <Link className="notfound-cta" to="/" onClick={() => track('not_found_action', { reason, action: 'search' })}>
          단지 이름으로 검색하기
        </Link>
      </div>
    </div>
  )
}
