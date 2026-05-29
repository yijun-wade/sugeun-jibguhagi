// api/og.js — OG 이미지 생성 (카카오톡/SNS 공유 썸네일)
// 외부 폰트 fetch 제거 → Edge runtime에서 안정적 렌더링
import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

export default function handler() {
  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif',
          position: 'relative',
          overflow: 'hidden',
        },
        children: [
          // 배경 장식 원
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', top: '-100px', right: '-80px',
                width: '440px', height: '440px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.07)', display: 'flex',
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', bottom: '-60px', left: '-40px',
                width: '280px', height: '280px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', display: 'flex',
              },
            },
          },
          // 하우스 아이콘
          {
            type: 'div',
            props: {
              style: { fontSize: '96px', marginBottom: '24px', display: 'flex' },
              children: '🏠',
            },
          },
          // 브랜드명
          {
            type: 'div',
            props: {
              style: {
                fontSize: '68px', fontWeight: 900, color: 'white',
                letterSpacing: '-2px', display: 'flex', marginBottom: '20px',
              },
              children: '수군수군 우리집',
            },
          },
          // 태그라인
          {
            type: 'div',
            props: {
              style: {
                fontSize: '28px', color: 'rgba(255,255,255,0.85)',
                display: 'flex', marginBottom: '12px',
              },
              children: '마음에 둔 아파트를 수집하세요',
            },
          },
          // 서브
          {
            type: 'div',
            props: {
              style: {
                fontSize: '20px', color: 'rgba(255,255,255,0.55)',
                display: 'flex', letterSpacing: '0.04em',
              },
              children: '동네 분위기 · 실거주 후기 · 실거래가',
            },
          },
          // SuZip 배지
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute', bottom: '36px', right: '48px',
                fontSize: '18px', fontWeight: 700,
                color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em',
                display: 'flex',
              },
              children: 'SuZip · 수집',
            },
          },
        ],
      },
    },
    { width: 1200, height: 630 }
  )
}
