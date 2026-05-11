import { Helmet } from 'react-helmet-async'

const SECTION_STYLE = { marginTop: 24, marginBottom: 12 }
const H2_STYLE = { fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 8 }
const P_STYLE = { fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 8 }
const UL_STYLE = { fontSize: 14, color: '#374151', lineHeight: 1.8, paddingLeft: 20, marginBottom: 8 }

export default function TermsPage() {
  return (
    <div className="app">
      <Helmet>
        <title>이용약관 · 수군수군 우리집</title>
        <meta name="description" content="수군수군 우리집(suzip.kr)의 이용약관입니다. 서비스 이용 조건, 책임 한계, 분쟁 해결 절차를 안내합니다." />
        <link rel="canonical" href="https://www.suzip.kr/terms" />
        <meta name="robots" content="index,follow" />
      </Helmet>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 80px' }}>
        <a href="/" style={{ display: 'inline-block', marginBottom: 24, color: '#2563eb', textDecoration: 'none', fontSize: 14 }}>← 홈으로</a>

        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 6 }}>이용약관</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>시행일: 2026년 5월 11일</p>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제1조 (목적)</h2>
          <p style={P_STYLE}>
            본 약관은 준준팩토리(이하 "회사")가 운영하는 "수군수군 우리집"(suzip.kr, 이하 "서비스")의
            이용 조건과 절차, 이용자와 회사의 권리·의무 및 책임을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제2조 (정의)</h2>
          <ul style={UL_STYLE}>
            <li>"서비스"란 회사가 제공하는 부동산 단지 정보, 동네 후기 요약, 부동산 정책·뉴스 브리핑, 사주 기반 동네 추천 등 일체의 기능을 의미합니다.</li>
            <li>"이용자"란 본 약관에 따라 서비스를 이용하는 모든 사람을 의미합니다.</li>
            <li>"콘텐츠"란 서비스 내에서 제공되는 텍스트, 이미지, 데이터, 분석 결과 등을 의미합니다.</li>
          </ul>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제3조 (약관의 효력 및 변경)</h2>
          <p style={P_STYLE}>본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.</p>
          <p style={P_STYLE}>회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 시행 7일 전 본 페이지를 통해 공지합니다. 이용자에게 불리한 변경은 시행 30일 전 공지합니다.</p>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제4조 (서비스 내용)</h2>
          <p style={P_STYLE}>회사는 다음 서비스를 제공합니다.</p>
          <ul style={UL_STYLE}>
            <li>전국 아파트 단지 검색 및 동네·실거주 후기 요약</li>
            <li>국토교통부 공공데이터 기반 실거래가 정보 조회</li>
            <li>부동산 정책·뉴스 일일 브리핑</li>
            <li>부동산 용어 사전</li>
            <li>사주 기반 동네 추천 (참고·엔터테인먼트 목적)</li>
            <li>기타 회사가 추가로 제공하는 부가 서비스</li>
          </ul>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제5조 (서비스 이용)</h2>
          <p style={P_STYLE}>이용자는 별도의 회원가입 없이 서비스를 이용할 수 있습니다.</p>
          <p style={P_STYLE}>서비스는 원칙적으로 24시간 제공되나, 시스템 점검·장애·천재지변 등 불가피한 사유로 일시 중단될 수 있습니다.</p>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제6조 (이용자의 의무)</h2>
          <p style={P_STYLE}>이용자는 다음 행위를 해서는 안 됩니다.</p>
          <ul style={UL_STYLE}>
            <li>서비스의 자동화 도구를 통한 비정상적 접근 또는 크롤링</li>
            <li>타인의 정보 도용</li>
            <li>회사가 제공하는 콘텐츠를 무단으로 복제·배포·상업적 이용</li>
            <li>법령 또는 공서양속에 반하는 행위</li>
            <li>서비스 운영을 방해하는 행위</li>
          </ul>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제7조 (콘텐츠의 정확성과 책임 한계)</h2>
          <p style={P_STYLE}>
            <b>실거래가 정보</b>는 국토교통부 공공데이터 API에서 제공되며, 회사는 데이터 정확성·최신성·완전성을 보장하지 않습니다.
            거래·계약 등 중요한 의사결정은 반드시 원본 출처(국토교통부 실거래가 공개시스템)와 공인된 기관을 통해 확인하시기 바랍니다.
          </p>
          <p style={P_STYLE}>
            <b>동네 후기·실거주 요약</b>은 공개된 블로그·카페·뉴스 등을 AI가 자동 요약한 결과이며, 개별 사용자의 주관적 견해를 반영한 정보입니다.
            객관적 사실로 받아들이지 마시고 참고용으로만 활용하시기 바랍니다.
          </p>
          <p style={P_STYLE}>
            <b>부동산 정책·뉴스 브리핑</b>은 일반적인 정보 제공 목적이며, 법률·세무 자문이 아닙니다.
            실제 적용은 관련 전문가의 자문을 받으시기 바랍니다.
          </p>
          <p style={P_STYLE}>
            <b>사주 기반 동네 추천은 전적으로 참고·엔터테인먼트 목적입니다.</b>
            이사·계약·투자 등 실질적 의사결정의 근거로 사용해서는 안 되며, 회사는 이로 인한 어떠한 결과에도 책임을 지지 않습니다.
            본 기능은 전통 명리학을 AI로 해석한 결과로, 과학적 사실이나 운명을 결정짓는 것이 아닙니다.
          </p>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제8조 (회사의 면책)</h2>
          <ul style={UL_STYLE}>
            <li>회사는 천재지변, 시스템 장애, 외부 데이터 소스의 오류 등 불가항력으로 인한 서비스 중단·정보 오류에 대해 책임지지 않습니다.</li>
            <li>회사는 이용자가 서비스를 통해 얻은 정보로 인한 손해에 대해 책임지지 않습니다.</li>
            <li>회사는 이용자 간 또는 이용자와 제3자 간 분쟁에 개입하지 않으며, 이로 인한 손해를 배상할 책임이 없습니다.</li>
            <li>본 서비스에 표시되는 광고는 광고주의 책임이며, 회사는 광고 내용을 검증하지 않습니다.</li>
          </ul>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제9조 (지식재산권)</h2>
          <p style={P_STYLE}>서비스 내 제공되는 콘텐츠의 저작권은 회사 또는 원 저작권자에게 있습니다. 이용자는 회사의 사전 동의 없이 영리 목적으로 복제·배포할 수 없습니다.</p>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>제10조 (분쟁 해결 및 준거법)</h2>
          <p style={P_STYLE}>본 약관과 관련된 분쟁은 대한민국 법령에 따라 해석되며, 분쟁이 발생할 경우 회사 소재지를 관할하는 법원을 합의 관할로 합니다.</p>
        </section>

        <section style={SECTION_STYLE}>
          <h2 style={H2_STYLE}>부칙</h2>
          <ul style={UL_STYLE}>
            <li>본 약관은 2026년 5월 11일부터 시행합니다.</li>
            <li>사업자: 준준팩토리 (등록번호 895-24-01970)</li>
            <li>문의: fiveio27@gmail.com</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
