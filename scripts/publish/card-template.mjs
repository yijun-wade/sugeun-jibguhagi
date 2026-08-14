// 브리핑 JSON → 카드 5장 HTML. 순수 문자열 생성 — 브라우저·파일 접근 없음.
//
// blog-posts/card-generator.html 에서 카드 마크업·스타일만 추출했다.
// 원본은 수동 카드뉴스용으로 그대로 둔다(브라우저에서 열어 쓰는 경로).
//
// 원본에서 바꾼 것 둘:
//
// 1) html2canvas 제거 — 헤드리스 크롬이 요소를 직접 스크린샷한다.
//    html2canvas는 CSS 재현이 근사치라 자동 발행에는 위험하다.
//
// 2) 카드2·3의 큰 헤드라인이 원본에서 하드코딩이었다:
//      카드2 "투기는 잡되, 실수요자는 보호하겠다는 뜻"
//      카드3 "급매는 끝났다. 가격은 다시 오르는 중"
//    사람이 하루치를 만들 때는 문제가 없지만, 매일 자동 발행하면 그날 브리핑
//    내용과 무관하게 이 문장이 나간다. 사실과 어긋날 수 있다.
//    → intent / market 의 첫 문장을 헤드라인으로 쓴다. 항상 그날 데이터에서 나온다.

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// 첫 문장을 헤드라인으로, 나머지를 본문으로. 문장이 하나뿐이면 본문은 빈다.
export function splitLead(text) {
  const t = String(text ?? '').trim()
  if (!t) return { lead: '', rest: '' }
  const m = t.match(/^(.+?[.!?])\s+(.*)$/s)
  if (!m) return { lead: t, rest: '' }
  return { lead: m[1].trim(), rest: m[2].trim() }
}

const formatDate = (d) => {
  const p = String(d || '').split('-')
  return p.length === 3 ? `${p[0]}. ${parseInt(p[1], 10)}. ${parseInt(p[2], 10)}` : ''
}

// 제목의 쉼표에서 줄을 나눈다(원본 동작 유지)
const titleBr = (t) => esc(t).replace(/,\s*/g, ',<br>')

const STYLE = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif; background:#fff; }
  .card { width:1080px; height:1080px; position:relative; overflow:hidden; }

  .card-1 { background:#1e3a8a; display:flex; flex-direction:column; justify-content:center; padding:80px; }
  .c1-tag { display:inline-block; background:#f97316; color:#fff; font-size:28px; font-weight:700; padding:10px 28px; border-radius:40px; margin-bottom:48px; width:fit-content; }
  .c1-date { font-size:28px; color:#93c5fd; margin-bottom:20px; letter-spacing:.05em; }
  .c1-title { font-size:72px; font-weight:900; color:#fff; line-height:1.25; letter-spacing:-2px; margin-bottom:40px; }
  .c1-sub { font-size:32px; color:#93c5fd; line-height:1.6; }
  .c1-brand { position:absolute; bottom:60px; right:80px; font-size:28px; font-weight:700; color:rgba(255,255,255,.4); }
  .c1-house { position:absolute; right:-40px; bottom:-40px; font-size:380px; opacity:.06; line-height:1; }

  .card-inner { width:100%; height:100%; display:flex; flex-direction:column; padding:80px; }
  .card-header { display:flex; align-items:center; gap:20px; margin-bottom:48px; }
  .card-num { width:64px; height:64px; border-radius:50%; background:#2563eb; color:#fff; font-size:28px; font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .card-label { font-size:36px; font-weight:900; color:#1e3a8a; letter-spacing:-.5px; }
  .accent-bar { width:80px; height:8px; background:#2563eb; border-radius:4px; margin-bottom:40px; }
  .card-body { flex:1; display:flex; flex-direction:column; justify-content:center; min-height:0; }
  .card-big { font-size:54px; font-weight:800; color:#111827; line-height:1.35; letter-spacing:-1.5px; }
  .card-big em { font-style:normal; color:#2563eb; }
  .card-desc { font-size:33px; color:#6b7280; line-height:1.75; letter-spacing:-.5px; margin-top:36px; }
  .card-foot { display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:36px; border-top:2px solid #f3f4f6; }
  .foot-brand { font-size:26px; font-weight:700; color:#2563eb; }
  .foot-page { font-size:24px; color:#d1d5db; }

  .demand-row { display:flex; align-items:flex-start; gap:24px; padding:34px 0; border-bottom:1px solid #f3f4f6; }
  .demand-row:last-child { border-bottom:none; }
  .d-badge { flex-shrink:0; padding:8px 20px; border-radius:20px; font-size:26px; font-weight:700; min-width:100px; text-align:center; }
  .d-blue { background:#dbeafe; color:#1d4ed8; }
  .d-red { background:#fee2e2; color:#dc2626; }
  .d-orange { background:#ffedd5; color:#ea580c; }
  .d-text { font-size:32px; color:#374151; line-height:1.65; letter-spacing:-.5px; }

  .card-5 { background:linear-gradient(145deg,#1e3a8a 0%,#2563eb 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px; text-align:center; }
  .c5-label { font-size:28px; font-weight:700; color:#93c5fd; letter-spacing:.1em; margin-bottom:32px; }
  .c5-summary { font-size:54px; font-weight:900; color:#fff; line-height:1.4; letter-spacing:-1.5px; margin-bottom:56px; }
  .c5-divider { width:60px; height:4px; background:#f97316; border-radius:2px; margin:0 auto 56px; }
  .c5-cta-text { font-size:32px; color:rgba(255,255,255,.75); margin-bottom:32px; line-height:1.6; }
  .c5-btn { display:inline-block; background:#fff; color:#2563eb; font-size:34px; font-weight:900; padding:24px 60px; border-radius:50px; }
`

// 캡처 전 넘침 보정 스크립트. 브리핑 카드와 범용 카드가 같은 것을 쓴다.
const FIT_SCRIPT = '<script>\n// 넘치면 잘린 채로 캡처된다 — 에러도 안 나고 파일도 정상 크기로 생긴다.\n// 캡처 전에 각 카드가 실제로 안 넘치는지 확인하고, 넘치면 폰트를 줄인다.\n// 흐름에 있는 내용만 잰다. 타이틀 카드의 🏠 장식은 position:absolute + bottom:-40px 로\n// 일부러 넘겨서 overflow:hidden 으로 잘라내는 디자인이라, scrollHeight로 재면\n// 항상 "넘쳤다"가 나온다. 실제 잘림과 의도된 잘림을 구분해야 한다.\n// 넘침 판정은 카드 종류마다 다르다.\n//  - .card-inner 가 있는 카드(2·3·4): inner는 카드를 정확히 꽉 채우는 컨테이너다.\n//    자기 bounds로 재면 항상 "넘침"이 나오므로 scrollHeight로 재야 한다.\n//  - inner가 없는 카드(1·5): 흐름에 있는 자식들의 bounds로 잰다. 단 🏠 장식은\n//    position:absolute + bottom:-40px 로 일부러 넘겨 overflow:hidden 으로 자르는\n//    디자인이라 제외한다. 의도된 잘림과 진짜 잘림을 구분해야 한다.\nfunction isOver(card) {\n  var pad = 16 // 여유. 딱 맞으면 렌더 반올림에서 마지막 줄이 잘린다\n  var inner = card.querySelector(\'.card-inner\')\n  if (inner) return inner.scrollHeight > inner.clientHeight + 1\n\n  var rootRect = card.getBoundingClientRect()\n  var top = Infinity, bottom = -Infinity\n  card.querySelectorAll(\'*\').forEach(function (el) {\n    if (getComputedStyle(el).position === \'absolute\') return\n    var r = el.getBoundingClientRect()\n    if (!r.height) return\n    top = Math.min(top, r.top - rootRect.top)\n    bottom = Math.max(bottom, r.bottom - rootRect.top)\n  })\n  if (bottom === -Infinity) return false\n  return bottom > card.clientHeight - pad || top < pad\n}\n\nwindow.__fitCards = function () {\n  var report = []\n  document.querySelectorAll(\'.card\').forEach(function (card) {\n    var shrunk = 0\n    for (var i = 0; i < 14 && isOver(card); i++) {\n      card.querySelectorAll(\'.card-big, .card-desc, .d-text, .c1-title, .c5-summary\').forEach(function (el) {\n        var fs = parseFloat(getComputedStyle(el).fontSize)\n        el.style.fontSize = (fs * 0.94) + \'px\'\n      })\n      shrunk++\n    }\n    report.push({ card: card.dataset.card, shrunk: shrunk, overflow: isOver(card) })\n  })\n  return report\n}\n</script>'

// 카드 키는 layout.mjs의 placement.card와 같아야 한다.
export const CARD_KEYS = ['title', 'intent', 'market', 'demand', 'cta']

export function renderCardsHtml(b) {
  const intent = splitLead(b.intent)
  const market = splitLead(b.market)

  const cards = {
    title: `
      <div class="card card-1" data-card="title">
        <div class="c1-house">🏠</div>
        <span class="c1-tag">부동산 브리핑</span>
        <div class="c1-date">${formatDate(b.date)}</div>
        <div class="c1-title">${titleBr(b.title)}</div>
        <div class="c1-sub">오늘 뉴스, 내 입장에서<br>어떤 의미인지 풀어드려요</div>
        <div class="c1-brand">suzip.kr</div>
      </div>`,

    intent: `
      <div class="card" data-card="intent" style="background:#fff;">
        <div class="card-inner">
          <div class="card-header"><div class="card-num">1</div><div class="card-label">정부 입장</div></div>
          <div class="accent-bar"></div>
          <div class="card-body">
            <div class="card-big">${esc(intent.lead)}</div>
            ${intent.rest ? `<div class="card-desc">${esc(intent.rest)}</div>` : ''}
          </div>
          <div class="card-foot"><div class="foot-brand">수군수군 우리집</div><div class="foot-page">2 / 5</div></div>
        </div>
      </div>`,

    market: `
      <div class="card" data-card="market" style="background:#eff6ff;">
        <div class="card-inner">
          <div class="card-header"><div class="card-num" style="background:#1e40af;">2</div><div class="card-label" style="color:#1e40af;">시장 변화</div></div>
          <div class="accent-bar" style="background:#1e40af;"></div>
          <div class="card-body">
            <div class="card-big" style="color:#0f172a;">${esc(market.lead)}</div>
            ${market.rest ? `<div class="card-desc">${esc(market.rest)}</div>` : ''}
          </div>
          <div class="card-foot" style="border-top-color:#bfdbfe;"><div class="foot-brand" style="color:#1e40af;">수군수군 우리집</div><div class="foot-page">3 / 5</div></div>
        </div>
      </div>`,

    demand: `
      <div class="card" data-card="demand" style="background:#fff;">
        <div class="card-inner">
          <div class="card-header"><div class="card-num" style="background:#f97316;">3</div><div class="card-label" style="color:#ea580c;">실수요자 체감</div></div>
          <div class="accent-bar" style="background:#f97316;"></div>
          <div class="card-body" style="gap:0;">
            <div class="demand-row"><div class="d-badge d-red">매매</div><div class="d-text">${esc(b.demand?.buy)}</div></div>
            <div class="demand-row"><div class="d-badge d-blue">전세</div><div class="d-text">${esc(b.demand?.lease)}</div></div>
            <div class="demand-row"><div class="d-badge d-orange">월세</div><div class="d-text">${esc(b.demand?.rent)}</div></div>
          </div>
          <div class="card-foot"><div class="foot-brand">수군수군 우리집</div><div class="foot-page">4 / 5</div></div>
        </div>
      </div>`,

    cta: `
      <div class="card card-5" data-card="cta">
        <div class="c5-label">오늘의 한줄 정리</div>
        <div class="c5-summary">${titleBr(b.title)}</div>
        <div class="c5-divider"></div>
        <div class="c5-cta-text">내가 보는 단지 가격,<br>지금 어떻게 움직이고 있을까?</div>
        <div class="c5-btn">suzip.kr 바로가기</div>
      </div>`,
  }

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><style>${STYLE}</style></head>
<body>${CARD_KEYS.map((k) => cards[k]).join('\n')}
${FIT_SCRIPT}
</body></html>`
}


// ── 브리핑 외 카테고리용 범용 카드 ──────────────────────────────
// 브리핑은 intent/market/demand 3축이 고정이라 카드가 정형화되지만, 용어·정책·임장은
// 구조가 제각각이다. 그래서 초안의 굵은 소제목을 그대로 카드 본문으로 쓴다.
// 대표 + 소제목 카드 + CTA로 최소 3장(스펙 성공기준)을 항상 채운다.

const ACCENT = {
  '진짜 쉬운 용어사전': { bar: '#0ea5e9', hero: '#075985' },
  '요즘 부동산 정책': { bar: '#7c3aed', hero: '#4c1d95' },
  '동네 임장 가이드': { bar: '#f97316', hero: '#7c2d12' },
}

/**
 * @param {{title:string, date:string, category:string, points:Array<{head:string, body:string}>}} d
 * @returns {{html:string, keys:string[]}} keys는 실제로 들어간 카드 수만큼만 돌려준다
 */
export function renderGenericCardsHtml(d) {
  const points = (d.points || []).slice(0, 3)
  const c = ACCENT[d.category] || { bar: '#2563eb', hero: '#1e3a8a' }
  const keys = ['title', ...points.map((_, i) => `point${i + 1}`), 'cta']

  const pointCard = (p, i) => `
    <div class="card" data-card="point${i + 1}" style="background:${i % 2 ? '#f8fafc' : '#fff'};">
      <div class="card-inner">
        <div class="card-header">
          <div class="card-num" style="background:${c.bar};">${i + 1}</div>
          <div class="card-label" style="color:${c.hero};">${esc(d.category)}</div>
        </div>
        <div class="accent-bar" style="background:${c.bar};"></div>
        <div class="card-body">
          <div class="card-big">${esc(p.head)}</div>
          ${p.body ? `<div class="card-desc">${esc(p.body)}</div>` : ''}
        </div>
        <div class="card-foot"><div class="foot-brand" style="color:${c.hero};">수군수군 우리집</div><div class="foot-page">${i + 2} / ${keys.length}</div></div>
      </div>
    </div>`

  const cards = [
    `<div class="card card-1" data-card="title" style="background:${c.hero};">
       <div class="c1-house">🏠</div>
       <span class="c1-tag" style="background:${c.bar};">${esc(d.category)}</span>
       <div class="c1-date">${formatDate(d.date)}</div>
       <div class="c1-title">${titleBr(d.title)}</div>
       <div class="c1-sub">읽고 나면 한 가지는<br>확실해지도록 정리했어요</div>
       <div class="c1-brand">suzip.kr</div>
     </div>`,
    ...points.map(pointCard),
    `<div class="card card-5" data-card="cta">
       <div class="c5-label">오늘의 한줄 정리</div>
       <div class="c5-summary">${titleBr(d.title)}</div>
       <div class="c5-divider"></div>
       <div class="c5-cta-text">내가 보는 단지 가격,<br>지금 어떻게 움직이고 있을까?</div>
       <div class="c5-btn">suzip.kr 바로가기</div>
     </div>`,
  ]

  return {
    keys,
    html: `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><style>${STYLE}</style></head>
<body>${cards.join('\n')}
${FIT_SCRIPT}
</body></html>`,
  }
}
