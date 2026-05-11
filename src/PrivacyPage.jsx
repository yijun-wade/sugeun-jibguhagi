import { Helmet } from 'react-helmet-async'

const SECTION_STYLE = { marginTop: 24, marginBottom: 12 }
const H2_STYLE = { fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 8 }
const P_STYLE = { fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 8 }
const UL_STYLE = { fontSize: 14, color: '#374151', lineHeight: 1.8, paddingLeft: 20, marginBottom: 8 }

export default function PrivacyPage() {
  return (
    <div className="app">
      <Helmet>
        <title>개인정보 처리방침 · 수군수군 우리집</title>
        <meta name="description" content="수군수군 우리집(suzip.kr)의 개인정보 처리방침입니다. 수집 항목, 이용 목적, 보유 기간, 제3자 제공 내역을 안내합니다." />
        <link rel="canonical" href="https://www.suzip.kr/privacy" />
        <meta name="robots" content="index,follow" />
      </Helmet>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>
        <a href="/" style={{ display: 'inline-block', marginBottom: 24, color: '#2563eb', textDecoration: 'none', fontSize: 14 }}>← 홈으로</a>

        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 6 }}>개인정보 처리방침</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>시행일: 2026년 5월 11일</p>

        <p style={P_STYLE}>
          준준팩토리(이하 "회사")는 "수군수군 우리집"(suzip.kr, 이하 "서비스")의 이용자 개인정보를 중요하게 생각하며,
          「개인정보 보호법」 등 관련 법령을 준수하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
        </p>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>1. 수집하는 개인정보 항목</h2>
          <p style={P_STYLE}>회사는 다음의 항목을 수집·처리합니다.</p>
          <ul style={UL_STYLE}>
            <li><b>사주 분석 기능 이용 시</b>: 생년월일, 출생 시간(선택), 성별</li>
            <li><b>서비스 이용 과정에서 자동 수집</b>: 기기 식별자(브라우저 단위 무작위 ID), 접속 IP, 접속 일시, 페이지 이동 경로, 검색어, 광고 식별자</li>
            <li><b>문의 시</b>: 이메일 주소, 문의 내용</li>
          </ul>
          <p style={P_STYLE}>회사는 회원가입을 요구하지 않으며, 이름·전화번호·주민등록번호 등 직접적 식별정보는 수집하지 않습니다.</p>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>2. 개인정보의 수집 및 이용 목적</h2>
          <ul style={UL_STYLE}>
            <li>사주 기반 동네 추천 결과 산출 및 제공</li>
            <li>서비스 개선을 위한 이용 통계 분석</li>
            <li>맞춤형 광고 노출 (Google AdSense, Meta Pixel)</li>
            <li>부정 이용 방지 및 보안</li>
            <li>이용자 문의 응대</li>
          </ul>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>3. 개인정보의 보유 및 이용 기간</h2>
          <ul style={UL_STYLE}>
            <li>사주 입력값(생년월일·시간·성별): 분석 결과 산출 즉시 폐기. 서버에 저장되지 않습니다.</li>
            <li>이용 통계(기기 식별자, 접속 로그): 수집일로부터 최대 24개월 후 자동 삭제</li>
            <li>문의 이메일: 처리 완료 후 1년간 보관 후 삭제</li>
          </ul>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>4. 개인정보의 제3자 제공 및 처리 위탁</h2>
          <p style={P_STYLE}>회사는 다음과 같이 일부 정보 처리를 위탁합니다. 위탁받은 업체는 위탁받은 업무 수행 목적 외에 개인정보를 이용할 수 없습니다.</p>
          <ul style={UL_STYLE}>
            <li><b>Amplitude, Inc.</b> (미국): 이용 행동 분석. 기기 식별자, 페이지 이동, 이벤트 로그</li>
            <li><b>Google LLC</b> (미국): Google Analytics(이용 통계), Google AdSense(맞춤 광고), Search Console(검색 최적화)</li>
            <li><b>Meta Platforms, Inc.</b> (미국): Meta Pixel을 통한 광고 효과 측정</li>
            <li><b>Anthropic, PBC</b> (미국): 사주·콘텐츠 분석을 위한 AI 처리. 입력값은 분석 후 즉시 폐기</li>
            <li><b>Vercel Inc.</b> (미국): 서비스 호스팅 및 서버 운영</li>
          </ul>
          <p style={P_STYLE}>해외 위탁에 따른 개인정보의 국외 이전이 발생하며, 이는 「개인정보 보호법」 제28조의8에 따른 동의·계약 등 법적 근거에 의해 이루어집니다.</p>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>5. 정보주체의 권리와 행사 방법</h2>
          <p style={P_STYLE}>이용자는 다음 권리를 행사할 수 있습니다.</p>
          <ul style={UL_STYLE}>
            <li>개인정보 열람·정정·삭제·처리정지 요구</li>
            <li>광고 추적 거부: 브라우저의 광고 추적 차단 기능, 또는 Google·Meta 광고 설정 페이지에서 거부 가능</li>
            <li>쿠키 거부: 브라우저 설정에서 쿠키 차단 가능 (단 일부 기능 제한 가능)</li>
          </ul>
          <p style={P_STYLE}>권리 행사는 아래 문의처로 연락 주시면 지체 없이 처리합니다.</p>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>6. 개인정보의 안전성 확보 조치</h2>
          <ul style={UL_STYLE}>
            <li>HTTPS를 통한 모든 통신 암호화</li>
            <li>관리자 접근 권한 제한 및 정기 점검</li>
            <li>개인정보 보호를 위한 내부 관리 계획 수립·시행</li>
          </ul>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>7. 개인정보 보호책임자</h2>
          <ul style={UL_STYLE}>
            <li>책임자: 전이준</li>
            <li>사업자명: 준준팩토리 (등록번호 895-24-01970)</li>
            <li>연락처: fiveio27@gmail.com</li>
          </ul>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>8. 권익침해 구제 방법</h2>
          <p style={P_STYLE}>개인정보 침해 신고는 아래 기관에 문의할 수 있습니다.</p>
          <ul style={UL_STYLE}>
            <li>개인정보분쟁조정위원회: 1833-6972 / www.kopico.go.kr</li>
            <li>개인정보침해신고센터: 118 / privacy.kisa.or.kr</li>
            <li>대검찰청 사이버수사과: 1301 / spo.go.kr</li>
            <li>경찰청 사이버수사국: 182 / ecrm.police.go.kr</li>
          </ul>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>9. 처리방침의 변경</h2>
          <p style={P_STYLE}>본 처리방침은 시행일로부터 적용되며, 변경 시 시행 7일 전 본 페이지를 통해 공지합니다.</p>
        </section>
      </div>
    </div>
  )
}
