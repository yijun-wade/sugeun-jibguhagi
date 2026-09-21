// /updates — 무엇이 왜 바뀌었는지. 푸터에서만 들어온다.
// 상단 배너로 알리지 않는 이유: 재방문율이 1%대라 '바뀐 것'은 대부분의 방문자에게 정보가 아니다.
// 이 페이지는 "관리되는 서비스"라는 신뢰 신호와 기록을 위한 것이다.
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { UPDATES } from './updates-data.js'
import SiteFooter from './SiteFooter.jsx'

const label = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

export default function UpdatesPage() {
  const navigate = useNavigate()
  return (
    <div className="app">
      <Helmet>
        <title>업데이트 내역 · 수군수군 우리집</title>
        <meta name="description" content="수군수군 우리집에서 무엇이 왜 바뀌었는지 날짜별로 적어 둡니다." />
        <link rel="canonical" href="https://www.suzip.kr/updates" />
      </Helmet>
      <header onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <div className="brand">
          <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
        </div>
        <div className="brand-en">SuZip · 수집</div>
      </header>

      <main className="updates">
        <h1 className="updates-title">업데이트 내역</h1>
        <p className="updates-lead">무엇을 바꿨는지, 왜 바꿨는지 적어 둡니다.</p>

        {UPDATES.map(u => (
          <section key={u.date} className="updates-entry" aria-labelledby={`u-${u.date}`}>
            <time className="updates-date" dateTime={u.date}>{label(u.date)}</time>
            <h2 id={`u-${u.date}`} className="updates-entry-title">{u.title}</h2>
            <ul className="updates-items">
              {u.items.map(it => (
                <li key={it.what}>
                  <p className="updates-what">{it.what}</p>
                  <p className="updates-why">{it.why}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="updates-contact">
          고쳤으면 하는 점이 있으면 <a href="mailto:fiveio27@gmail.com">fiveio27@gmail.com</a>으로 알려주세요.
        </p>
      </main>
      <SiteFooter from="updates" />
    </div>
  )
}
