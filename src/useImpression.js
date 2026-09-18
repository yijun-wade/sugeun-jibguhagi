// 노출(impression) 이벤트 — 요소가 실제로 화면에 들어왔을 때 한 번만 발화한다.
//
// 왜: 씨앗 훅(0/163), 본 집 비교(1/1,209), 저장 CTA 모두 클릭만 재고 노출은 재지 않아
// "안 보여준 건지, 보고 안 누른 건지"를 사후에 가르지 못했다(2026-09-14 회고).
// 새 진입점은 노출 이벤트를 클릭 이벤트와 쌍으로 심는다.
import { useEffect, useRef } from 'react'
import { track } from './analytics.js'

/**
 * @param {string} eventName
 * @param {object} props      발화 시점의 값이 실린다
 * @param {boolean} enabled   false면 관찰하지 않는다(데이터 준비 전 등)
 * @returns ref — 관찰할 요소에 붙인다
 */
export function useImpression(eventName, props = {}, enabled = true) {
  const ref = useRef(null)
  const fired = useRef(false)
  const latest = useRef(props)
  latest.current = props

  useEffect(() => {
    const el = ref.current
    if (!enabled || fired.current || !el) return
    const fire = () => {
      if (fired.current) return
      fired.current = true
      track(eventName, latest.current)
    }
    // 구형 브라우저·인앱 웹뷰 대비: 관찰자가 없으면 그려진 것으로 간주
    if (typeof IntersectionObserver === 'undefined') { fire(); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { fire(); io.disconnect() }
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [eventName, enabled])

  return ref
}
