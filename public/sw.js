// Minimal service worker — PWA installable 요건만 충족
// 캐시·인터셉트 없음. 사이트 동작에 영향 X.
// TWA(Trusted Web Activity) 빌드에 필요한 최소 요건.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // pass-through — 네트워크 요청 가로채지 않음
})
