import * as amplitude from '@amplitude/analytics-browser'
import { sessionReplayPlugin } from '@amplitude/plugin-session-replay-browser'

const AMP_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY

if (AMP_KEY) {
  amplitude.add(sessionReplayPlugin({
    sampleRate: 1.0,  // 초기엔 100% — 트래픽 늘면 0.5 등으로 낮추기
  }))

  amplitude.init(AMP_KEY, {
    defaultTracking: false,
    autocapture: { sessions: true }, // 세션 리플레이에 필수
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
