import * as amplitude from '@amplitude/analytics-browser'
import { sessionReplayPlugin } from '@amplitude/plugin-session-replay-browser'

const AMP_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY

if (AMP_KEY) {
  // 1) 플러그인 먼저 등록 (init 전에 add해야 deviceId 공유됨)
  amplitude.add(sessionReplayPlugin({ sampleRate: 1.0 }))

  // 2) init — defaultTracking 대신 autocapture로 통일
  //    sessions: true 는 세션 리플레이 필수 옵션
  //    나머지는 false로 막아 수동 track()만 사용
  amplitude.init(AMP_KEY, {
    autocapture: {
      sessions: true,
      pageViews: false,
      formInteractions: false,
      fileDownloads: false,
      attribution: false,
    },
  })
}

// Meta Pixel 표준 이벤트 매핑 — 핵심 전환만 표준 이벤트로, 나머지는 Custom
const META_STANDARD_EVENTS = {
  saju_start: 'Lead',           // 사주 시작 = 리드
  collect_save: 'AddToWishlist', // 단지 수집 = 관심
  search: 'Search',
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
  // Meta Pixel
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    const standard = META_STANDARD_EVENTS[eventName]
    if (standard) {
      window.fbq('track', standard, params)
    } else {
      window.fbq('trackCustom', eventName, params)
    }
  }
}
