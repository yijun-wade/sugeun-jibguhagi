import * as amplitude from '@amplitude/analytics-browser'

const AMP_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY

if (AMP_KEY) {
  amplitude.init(AMP_KEY, {
    defaultTracking: false, // page_view 등 자동 트래킹 off (수동으로 통일)
    autocapture: false,
  })
}

export function track(eventName, params = {}) {
  // GA4
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
  // Amplitude
  if (AMP_KEY) {
    amplitude.track(eventName, params)
  }
}
