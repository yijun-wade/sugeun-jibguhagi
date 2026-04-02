// api/og.js — OG 이미지 생성 (카카오톡/SNS 공유 썸네일)
import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

export default async function handler() {
  try {
    // Noto Sans KR 폰트 fetch (한글 렌더링)
    const fontRes = await fetch(
      'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@900&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' } }
    )
    const css = await fontRes.text()
    const urlMatch = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)
    const fontData = urlMatch
      ? await fetch(urlMatch[1]).then(r => r.arrayBuffer())
      : null

    const fonts = fontData
      ? [{ name: 'NotoSans', data: fontData, weight: 900, style: 'normal' }]
      : []

    const fontFamily = fonts.length ? 'NotoSans' : 'sans-serif'

    const el = {
      type: 'div',
      props: {
        style: {
          width: '1200px', height: '630px',
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 65%, #3b82f6 100%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily, position: 'relative', overflow: 'hidden',
        },
        children: [
          // 배경 원형 장식
          { type: 'div', props: { style: { position: 'absolute', top: '-120px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex' } } },
          { type: 'div', props: { style: { position: 'absolute', bottom: '-80px', left: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex' } } },
          // 하우스 아이콘
          { type: 'div', props: { style: { fontSize: '88px', marginBottom: '20px', display: 'flex' }, children: '🏠' } },
          // 브랜드명
          { type: 'div', props: { style: { fontSize: '72px', fontWeight: 900, color: 'white', letterSpacing: '-2px', display: 'flex', marginBottom: '18px' }, children: '수근수근 우리집' } },
          // 태그라인
          { type: 'div', props: { style: { fontSize: '30px', color: 'rgba(255,255,255,0.85)', display: 'flex', marginBottom: '10px' }, children: '마음에 둔 아파트를 수집하세요' } },
          // 서브
          { type: 'div', props: { style: { fontSize: '22px', color: 'rgba(255,255,255,0.55)', display: 'flex', letterSpacing: '0.03em' }, children: '동네 분위기 · 실거주 후기 · 실거래가' } },
          // SooZip 배지
          { type: 'div', props: { style: { position: 'absolute', bottom: '36px', right: '48px', fontSize: '20px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', display: 'flex' }, children: 'SooZip · 수집' } },
        ],
      },
    }

    return new ImageResponse(el, { width: 1200, height: 630, fonts })
  } catch {
    // 폰트 실패 시 fallback
    const fallback = {
      type: 'div',
      props: {
        style: {
          width: '1200px', height: '630px', background: '#2563eb',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'white', fontFamily: 'sans-serif',
        },
        children: [
          { type: 'div', props: { style: { fontSize: '80px', display: 'flex', marginBottom: '24px' }, children: '🏠' } },
          { type: 'div', props: { style: { fontSize: '56px', fontWeight: 900, display: 'flex' }, children: 'SooZip' } },
        ],
      },
    }
    return new ImageResponse(fallback, { width: 1200, height: 630 })
  }
}
