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
      attribution: true,
    },
  })
}

/**
 * 유입 출처를 이벤트로 남긴다.
 *
 * Amplitude의 autocapture attribution이 UTM을 "유저 속성"으로 잡아주긴 하지만,
 * 그것만으로는 "블로그에서 몇 명이 왔고 그중 몇 명이 저장까지 갔나"를 보기 번거롭다.
 * 첫 진입에 이벤트를 한 번 찍어두면 퍼널 시작점이 명확해진다.
 *
 * 세션당 1회만 찍는다 — 새로고침마다 쌓이면 유입 수가 부풀려진다.
 */
function trackReferral() {
  if (typeof window === 'undefined') return
  try {
    const q = new URLSearchParams(window.location.search)
    const source = q.get('utm_source')
    if (!source) return
    const KEY = 'suzip_referral_tracked'
    if (sessionStorage.getItem(KEY) === source) return
    sessionStorage.setItem(KEY, source)
    track('referral_landing', {
      utm_source: source,
      utm_medium: q.get('utm_medium') || null,
      utm_campaign: q.get('utm_campaign') || null,
      landing_path: window.location.pathname,
    })
  } catch { /* 스토리지 차단 등 — 계측 실패가 앱을 멈추면 안 된다 */ }
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

// track() 정의 이후에 호출한다 — 첫 진입 1회
trackReferral()
