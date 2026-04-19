// src/AdUnit.jsx
// Google AdSense 광고 단위 컴포넌트
// adSlot은 AdSense 콘솔에서 발급받은 슬롯 ID
import { useEffect, useRef } from 'react'

export default function AdUnit({ adSlot, style }) {
  const adRef = useRef(null)
  const pushed = useRef(false)

  // adSlot 또는 client ID 없으면 렌더링 안 함 (빈 공간 방지)
  if (!adSlot || !import.meta.env.VITE_ADSENSE_CLIENT_ID) return null

  useEffect(() => {
    if (pushed.current) return
    if (!window.adsbygoogle) return
    try {
      window.adsbygoogle.push({})
      pushed.current = true
    } catch {
      // AdSense 로드 전이거나 차단된 경우 조용히 무시
    }
  }, [])

  return (
    <div className="ad-unit" style={style}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={import.meta.env.VITE_ADSENSE_CLIENT_ID}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
