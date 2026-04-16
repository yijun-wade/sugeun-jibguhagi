// GA4 이벤트 트래킹 헬퍼
// window.gtag가 없으면 조용히 무시 (로컬 개발 환경 등)
export function track(eventName, params = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, params)
}
