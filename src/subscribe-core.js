// src/subscribe-core.js — 동네 명시 구독 순수 로직 (side-effect 없음, 단위테스트 대상)
import { rankRegions } from './interest-core.js'

// 구독 추가. 중복(같은 dong)은 원본 유지, 상한 초과·dong 없음은 null(거절).
export function pushRegion(list, item, max = 5) {
  if (!item || !item.dong) return null
  const base = Array.isArray(list) ? list : []
  if (base.some(r => r && r.dong === item.dong)) return base
  if (base.length >= max) return null
  return [item, ...base]
}

export function removeRegion(list, dong) {
  const base = Array.isArray(list) ? list : []
  return base.filter(r => r && r.dong !== dong)
}

// 명시 구독(가중 5) > 저장 단지(2) > 조회(1).
// rankRegions는 (viewed, saved) 2단만 받으므로, 구독을 saved 자리에 가중치만큼 복제해 얹는다.
export function rankRegionsWithSubs(viewed = [], saved = [], subs = []) {
  const subsAsSaved = subs.flatMap(r => [r, r]) // saved 가중치 2 × 2회 = 4
  const subsAsViewed = subs                      // + viewed 가중치 1 = 총 5
  const out = rankRegions([...viewed, ...subsAsViewed], [...saved, ...subsAsSaved])
  if (!out) return null
  return { ...out, subscribed: subs.some(r => r && r.gu === out.gu) }
}
