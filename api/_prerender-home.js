// 크롤러용 홈 HTML.
//
// 왜 필요한가: 단지 페이지는 프리렌더해 두었는데 홈은 빈 SPA 껍데기라, 크롤러가 받는 본문이
// 가시 텍스트 28자·내부 링크 0개였다. 사이트의 진입점에 링크가 하나도 없으면 크롤러가
// 구조를 읽을 수 없고, 얇은 홈은 사이트 전체 품질 신호에도 불리하다.
//
// 사람이 보는 홈과 같은 문구·같은 내비게이션을 그대로 낸다. 크롤러 전용 내용을 끼워 넣지 않는다.
// 새 함수는 만들지 않는다(12개 한도) — api/apt.js가 home=1일 때 이걸 부른다.
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const BASE = 'https://www.suzip.kr'

// 사람이 보는 홈의 내비게이션·예시 검색어와 같은 목록
const NAV = [
  ['/', '이불 속 임장'],
  ['/briefing', '속닥속닥 뉴스'],
  ['/policy', '이불 속 정책'],
  ['/glossary', '이불 속 사전'],
  ['/report', '살까말까 보고서'],
]
const HINTS = ['반포자이', '잠실엘스', '상계주공', '강남구', '망원동', '분당구', '목동']

/**
 * @param {Array} featured  [{kaptCode, kaptName, sigungu, dong}] — 홈 '많이 찾는 단지'와 같은 목록
 */
export function buildHomeHtml(featured = []) {
  const title = '수군수군 우리집 — 퇴근 후 이불 속에서 하는 임장'
  const description = '아파트 이름만 넣으면 그 동네 사람들이 실제로 하는 이야기, 최근 실거래가와 가격 흐름, 이 집 살만한지 한 줄 평가를 한눈에 보여드려요.'

  const navHtml = NAV.map(([href, label]) => `<li><a href="${BASE}${href}">${esc(label)}</a></li>`).join('')
  const hintHtml = HINTS.map(h => `<li><a href="${BASE}/search?q=${encodeURIComponent(h)}">${esc(h)}</a></li>`).join('')
  const featuredHtml = featured.length
    ? `<h2>많이 찾는 단지</h2><ul>${featured.map(a =>
        `<li><a href="${BASE}/apt/${esc(a.kaptCode)}">${esc(a.kaptName)}</a>${
          a.sigungu ? ` · ${esc(a.sigungu)} ${esc(a.dong || '')}`.trimEnd() : ''}</li>`).join('')}</ul>`
    : ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '수군수군 우리집',
    url: BASE,
    description,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${BASE}/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="수군수군 우리집" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${BASE}/" />
<meta property="og:image" content="${BASE}/ogimage.png" />
<meta property="og:locale" content="ko_KR" />
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>
<body>
<h1>퇴근 후, 이불 속에서 하는 임장</h1>
<p>발품 팔기 전에 아파트 이름만 넣어보세요.</p>
<ul>
<li>그 동네 사람들이 실제로 하는 이야기</li>
<li>최근 실거래가와 가격 흐름</li>
<li>이 집 살만한지 한 줄 평가</li>
</ul>
<h2>둘러보기</h2>
<ul>${navHtml}</ul>
<h2>이런 걸 검색해요</h2>
<ul>${hintHtml}</ul>
${featuredHtml}
<p>현재 서울 아파트 중심으로 운영되는 베타 서비스예요.</p>
</body>
</html>`
}
