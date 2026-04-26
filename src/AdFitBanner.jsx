import { useEffect, useRef } from 'react'

export default function AdFitBanner({ unit = 'DAN-4PDxK3qPku2wvJjd', width = 320, height = 100 }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    // AdFit이 로드되면 ins 요소를 광고로 초기화
    if (window.kakao?.ads) {
      window.kakao.ads.init()
    }
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
      <ins
        ref={ref}
        className="kakao_ad_area"
        style={{ display: 'none' }}
        data-ad-unit={unit}
        data-ad-width={String(width)}
        data-ad-height={String(height)}
      />
    </div>
  )
}
