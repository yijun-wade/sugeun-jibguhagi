// 공용 푸터. 전에는 홈(App.jsx)에만 있어서 방문의 99%가 들어오는 상세페이지에는 푸터가 없었다 —
// 고지문·문의·사업자정보가 거의 아무에게도 보이지 않았다.
import { track } from './analytics.js'

export default function SiteFooter({ from = 'home' }) {
  return (
    <footer className="site-footer">
      <p className="site-footer-copy">© 2026 수군수군 우리집 · SuZip</p>
      <p className="site-footer-ai">이 서비스는 인터넷 글을 AI가 자동 수집·요약해요. 실제 사실과 다를 수 있으며 투자·거래 참고 자료로 활용할 수 없어요.</p>
      <div className="site-footer-links">
        <a href="/updates" onClick={() => track('updates_link_click', { from })}>업데이트 내역</a>
        <span>·</span>
        <a href="https://blog.naver.com/kaimex" target="_blank" rel="noopener noreferrer">블로그</a>
        <span>·</span>
        <a href="/briefing">속닥속닥 뉴스</a>
        <span>·</span>
        <a href="/terms.html" target="_blank" rel="noopener noreferrer">이용약관</a>
        <span>·</span>
        <a href="mailto:fiveio27@gmail.com">문의하기</a>
      </div>
      <div className="site-footer-biz">
        상호: 준준팩토리 · 대표: 전이준 · 사업자등록번호: 895-24-01970<br/>
        서울특별시 용산구 이촌로 100-8 · 통신판매업 신고: 준비 중<br/>
        고객센터: <a href="mailto:fiveio27@gmail.com">fiveio27@gmail.com</a>
      </div>
    </footer>
  )
}
