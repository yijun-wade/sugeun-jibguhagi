// 크롤러(네이버 Yeti·구글봇 등)용 상세페이지 HTML. vercel.json이 UA로 분기해 /api/apt?prerender=1로 보낸다.
//
// 2026-07에 이 프리렌더를 붙인 뒤 주간 착지자가 0 → 500이 됐다(Amplitude 실측) — 유입의 100%가
// 네이버 검색이고, 이 HTML이 그 검색에 걸리는 전부다. 그런데 본문은 단지명만 갈아 끼운 259자
// 문구였고, 사람에게 보여주는 AI 요약·실거래·평형 정보는 하나도 실리지 않았다. 이미 가진 정적
// 데이터(요약 합본·가격·추이·유사단지)를 그대로 싣는다. 새 함수는 필요 없다(12개 한도).
//
// title은 건드리지 않는다. 지금 순위가 걸려 있는 필드라 바꾸는 건 따로 실험할 일이다.
import { parseAddr } from './_addr.js'

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// 만원 → "28억 9,417만"
function won(man) {
  if (!Number.isFinite(man) || man <= 0) return ''
  const eok = Math.floor(man / 10000), rest = Math.round(man % 10000)
  return [eok ? `${eok}억` : '', rest ? `${rest.toLocaleString()}만` : ''].filter(Boolean).join(' ')
}
const ymLabel = (ym) => (/^\d{6}$/.test(String(ym)) ? `${String(ym).slice(0, 4)}년 ${parseInt(String(ym).slice(4), 10)}월` : '')

const FAQ_Q = { 교통: '교통은 어때요?', 학군: '학군은 어때요?', 분위기: '동네 분위기는 어때요?', 이슈: '요즘 무슨 이야기가 나오나요?' }

/**
 * @param {object} apt   { kaptCode, kaptName, addr, kaptdaCnt, useAprDay, kaptBuldYy, summary, aptType }
 * @param {object} data  { vibe:{s,c,l,t}, price, trend, similar }
 */
export function buildPrerenderHtml(apt, data = {}) {
  const { vibe, price, trend, similar } = data
  const name = apt.kaptName || '아파트'
  const addr = apt.addr || ''
  const { gu: region, dong } = parseAddr(addr)
  const year = apt.useAprDay ? String(apt.useAprDay).slice(0, 4) : (apt.kaptBuldYy || '')
  const buildYear = year ? `${year}년` : ''
  const households = apt.kaptdaCnt ? `${Number(apt.kaptdaCnt).toLocaleString()}세대` : ''
  const url = `https://www.suzip.kr/apt/${apt.kaptCode}`
  const loc = [region, dong].filter(Boolean).join(' ')
  const hasPrice = !!(price && price.avg > 0)
  const isRental = apt.aptType === 'rental'

  const title = `${name} 실거주 후기·동네 분위기·실거래가 | 수군수군 우리집`
  const description = [
    vibe?.s || apt.summary ||
      `${name}${loc ? ` (${loc})` : ''} 실거주자 이야기와 동네 분위기를 한눈에 확인하세요`,
    hasPrice && `최근 실거래 평균 ${won(price.avg)}`,
    buildYear && `${buildYear} 준공`,
    households,
  ].filter(Boolean).join(' · ').slice(0, 160)

  const facts = [
    addr && `주소: ${esc(addr)}`,
    buildYear && `준공: ${esc(buildYear)}`,
    households && `세대수: ${esc(households)}`,
    isRental && '유형: 공공임대·청년주택 (분양형태: 임대)',
  ].filter(Boolean).map(f => `<li>${f}</li>`).join('')

  const intro = isRental && !hasPrice
    ? `${esc(name)}${loc ? `은(는) ${esc(loc)}에 있는 공공임대·청년주택 단지입니다. ` : ' '}` +
      `매매 실거래가 없는 단지라, 입주를 고민하는 분이 궁금해하는 동네 분위기·교통·주변 여건과 살아본 사람들의 이야기를 모았어요. ` +
      `입주 자격과 임대료는 모집공고에서 확인하세요.`
    : `${esc(name)}${loc ? `은(는) ${esc(loc)}에 위치한 아파트 단지입니다. ` : ' '}` +
      `이 단지의 동네 분위기, 실거주자들의 이야기, 최근 실거래가를 수군수군 우리집에서 모아 정리했어요.`

  const vibeHtml = vibe ? [
    `<h2>${esc(name)}, 살만해요?</h2>`,
    vibe.s ? `<p><strong>${esc(vibe.s)}</strong></p>` : '',
    ...(vibe.c || []).filter(c => c.lines?.length).map(c =>
      `<h3>${esc(c.label)}</h3><ul>${c.lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`),
    `<p>인터넷에 올라온 블로그·카페·뉴스 글을 AI가 모아 요약했어요${vibe.t ? ` (${esc(vibe.t)} 기준)` : ''}. 실제와 다를 수 있어요.</p>`,
  ].join('\n') : ''

  const priceHtml = hasPrice ? [
    `<h2>${esc(name)} 최근 실거래가</h2>`,
    `<p>최근 실거래가 평균 ${won(price.avg)}${price.perPy ? ` · 평당 ${won(price.perPy)}` : ''}` +
      `${price.ym ? ` (${ymLabel(price.ym)} 기준${price.count ? `, ${price.count}건` : ''})` : ''}</p>`,
    (price.areas || []).length
      ? `<table><thead><tr><th>전용면적</th><th>중앙값</th><th>최저~최고</th><th>거래</th></tr></thead><tbody>${
          price.areas.map(a => `<tr><td>${esc(a.area)}㎡ (${esc(a.py)}평)</td><td>${won(a.median ?? a.avg)}</td><td>${
            a.count >= 2 ? `${won(a.min)}~${won(a.max)}` : '단일 거래'}</td><td>${esc(a.count)}건</td></tr>`).join('')
        }</tbody></table>` : '',
    (trend || []).length >= 2
      ? `<h3>월별 평균 실거래가</h3><ul>${trend.slice(-12).map(t => `<li>${ymLabel(t.ym)}: ${won(t.avg)} (${esc(t.count)}건)</li>`).join('')}</ul>` : '',
    `<p>국토교통부 실거래가 공개시스템 기준이에요.</p>`,
  ].join('\n') : ''

  const linksHtml = (vibe?.l || []).length
    ? `<h2>${esc(name)} 이야기 원문</h2><ul>${vibe.l.map(l =>
        `<li><a href="${esc(l.link)}" rel="nofollow noopener">${esc(l.title)}</a> — ${esc(l.tag)}</li>`).join('')}</ul>` : ''

  const similarHtml = (similar || []).length
    ? `<h2>${isRental && !hasPrice ? `${esc(region || '이 근처')} 다른 공공임대·청년주택` : '이 근처 비슷한 값 단지'}</h2><ul>${similar.map(a =>
        `<li><a href="https://www.suzip.kr/apt/${esc(a.code)}">${esc(a.name)}</a>${a.dong ? ` · ${esc(a.dong)}` : ''}${
          a.avg > 0 ? ` · ${won(a.avg)}` : a.units ? ` · ${Number(a.units).toLocaleString()}세대` : ''}</li>`).join('')}</ul>` : ''

  const jsonLd = [{
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    name,
    url,
    ...(vibe?.s || apt.summary ? { description: vibe?.s || apt.summary } : {}),
    address: { '@type': 'PostalAddress', streetAddress: addr, addressLocality: region, addressCountry: 'KR' },
    ...(apt.kaptdaCnt ? { numberOfAccommodationUnits: Number(apt.kaptdaCnt) } : {}),
  }]
  const faqItems = (vibe?.c || []).filter(c => c.lines?.length && FAQ_Q[c.label])
  if (faqItems.length) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map(c => ({
        '@type': 'Question',
        name: `${name} ${FAQ_Q[c.label]}`,
        acceptedAnswer: { '@type': 'Answer', text: c.lines.join(' ') },
      })),
    })
  }
  // </script> 주입 방지 — JSON 안의 '<'를 이스케이프한다.
  const ld = jsonLd.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="수군수군 우리집" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="https://www.suzip.kr/ogimage.png" />
<meta property="og:locale" content="ko_KR" />
${ld}
</head>
<body>
<h1>${esc(name)} 실거주 후기 및 동네 분위기</h1>
${apt.summary ? `<p>${esc(apt.summary)}</p>` : ''}
<p>${intro}</p>
${facts ? `<ul>${facts}</ul>` : ''}
${vibeHtml}
${priceHtml}
${linksHtml}
${similarHtml}
<p><a href="${url}">${esc(name)} 상세 보기 — 수군수군 우리집</a></p>
</body>
</html>`
}
