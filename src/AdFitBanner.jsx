import { useEffect, useRef } from 'react'

export default function AdFitBanner({ unit = 'DAN-4PDxK3qPku2wvJjd', width = 320, height = 100 }) {
  const containerRef = useRef(null)
  const injected = useRef(false)

  useEffect(() => {
    if (injected.current || !containerRef.current) return
    injected.current = true

    // ins 태그 직접 생성 + 스크립트 주입 (SPA 환경 대응)
    const ins = document.createElement('ins')
    ins.className = 'kakao_ad_area'
    ins.style.display = 'none'
    ins.setAttribute('data-ad-unit', unit)
    ins.setAttribute('data-ad-width', String(width))
    ins.setAttribute('data-ad-height', String(height))
    containerRef.current.appendChild(ins)

    const script = document.createElement('script')
    script.async = true
    script.type = 'text/javascript'
    script.src = '//t1.kakaocdn.net/kas/static/ba.min.js'
    script.charset = 'utf-8'
    containerRef.current.appendChild(script)
  }, [unit])

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', justifyContent: 'center', minHeight: height, margin: '8px 0' }}
    />
  )
}
