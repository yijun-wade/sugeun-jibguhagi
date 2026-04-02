// api/og.jsx — OG 이미지 생성 (카카오톡/SNS 공유 썸네일)
import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

export default async function handler() {
  try {
    // Noto Sans KR Bold 폰트 fetch (한글 렌더링용)
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

    return new ImageResponse(
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 65%, #3b82f6 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: fonts.length ? 'NotoSans' : 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 원형 장식 */}
        <div style={{
          position: 'absolute', top: -120, right: -100,
          width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)', display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -60,
          width: 320, height: 320, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', display: 'flex',
        }} />

        {/* 하우스 아이콘 */}
        <div style={{ fontSize: 88, marginBottom: 20, display: 'flex' }}>🏠</div>

        {/* 브랜드명 */}
        <div style={{
          fontSize: 72, fontWeight: 900, color: 'white',
          letterSpacing: '-2px', display: 'flex', marginBottom: 18,
        }}>
          수근수근 우리집
        </div>

        {/* 태그라인 */}
        <div style={{
          fontSize: 30, color: 'rgba(255,255,255,0.85)',
          display: 'flex', marginBottom: 10,
        }}>
          마음에 둔 아파트를 수집하세요
        </div>

        <div style={{
          fontSize: 22, color: 'rgba(255,255,255,0.55)',
          display: 'flex', letterSpacing: '0.03em',
        }}>
          동네 분위기 · 실거주 후기 · 실거래가
        </div>

        {/* SooZip 배지 */}
        <div style={{
          position: 'absolute', bottom: 36, right: 48,
          fontSize: 20, fontWeight: 700,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.08em', display: 'flex',
        }}>
          SooZip · 수집
        </div>
      </div>,
      { width: 1200, height: 630, fonts }
    )
  } catch {
    return new ImageResponse(
      <div style={{
        width: '1200px', height: '630px',
        background: '#2563eb',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        color: 'white', fontFamily: 'sans-serif',
      }}>
        <div style={{ fontSize: 80, display: 'flex', marginBottom: 24 }}>🏠</div>
        <div style={{ fontSize: 56, fontWeight: 900, display: 'flex' }}>SooZip</div>
      </div>,
      { width: 1200, height: 630 }
    )
  }
}
