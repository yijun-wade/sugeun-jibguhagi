// src/interest.js — 관심 지역 기록/조회 (localStorage + analytics 래퍼, 브라우저 전용)
import { mergeInterest } from './interest-core.js'
import { pushRegion, removeRegion, rankRegionsWithSubs } from './subscribe-core.js'
import { getCollection } from './collection.js'
import { track } from './analytics.js'

const KEY = 'soozip-interest'
const SUB_KEY = 'soozip-subscribed-regions'
const SUB_MAX = 5

export function getInterest() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

// 상세페이지 조회 시 호출. 의사결정 스냅샷(avg/direction/verdict) 저장,
// 재조회 시 mergeInterest가 prevAvg/prevTs 승계. 최초 기록 시 interest_captured 1회.
export function recordInterest({ kaptCode, aptNm, dong, gu, avg, direction, verdict }) {
  if (!kaptCode) return
  const prev = getInterest()
  const firstEver = prev.length === 0
  const item = {
    kaptCode,
    aptNm: aptNm || '',
    dong: dong || '',
    gu: gu || '',
    avg: Number(avg) || 0,
    direction: direction || '',
    verdict: verdict || '',
    ts: Date.now(),
  }
  const next = mergeInterest(prev, item, 10)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  if (firstEver) track('interest_captured', { gu: item.gu, dong: item.dong })
}

/* ── 동네 명시 구독 (암묵 추론과 분리된 키) ── */

export function getSubscribedRegions() {
  try { return JSON.parse(localStorage.getItem(SUB_KEY) || '[]') } catch { return [] }
}

export function isSubscribed(dong) {
  return getSubscribedRegions().some(r => r.dong === dong)
}

// 성공 시 목록 반환, 상한 초과·잘못된 입력은 null(호출부에서 안내).
export function subscribeRegion({ gu, dong }, from = 'apt_detail') {
  const next = pushRegion(getSubscribedRegions(), { gu: gu || '', dong: dong || '', ts: Date.now() }, SUB_MAX)
  if (!next) return null
  try { localStorage.setItem(SUB_KEY, JSON.stringify(next)) } catch {}
  track('region_subscribe', { gu: gu || '', dong: dong || '', from })
  return next
}

export function unsubscribeRegion(dong) {
  const next = removeRegion(getSubscribedRegions(), dong)
  try { localStorage.setItem(SUB_KEY, JSON.stringify(next)) } catch {}
  track('region_unsubscribe', { dong })
  return next
}

// 관심 지역 {gu, dong, subscribed} | null. 명시 구독 5 > 저장 단지 2 > 조회 1.
export function getTopRegion() {
  const viewed = getInterest()
  const saved = getCollection().map(a => ({ gu: a.regionName || '', dong: a.dong || '' }))
  return rankRegionsWithSubs(viewed, saved, getSubscribedRegions())
}
