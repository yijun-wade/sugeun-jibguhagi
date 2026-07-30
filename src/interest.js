// src/interest.js — 관심 지역 기록/조회 (localStorage + analytics 래퍼, 브라우저 전용)
import { pushInterest, rankRegions } from './interest-core.js'
import { getCollection } from './collection.js'
import { track } from './analytics.js'

const KEY = 'soozip-interest'

export function getInterest() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

// 상세페이지 조회 시 호출. 최초 기록 시 interest_captured 1회.
export function recordInterest({ kaptCode, aptNm, dong, gu }) {
  if (!kaptCode) return
  const prev = getInterest()
  const firstEver = prev.length === 0
  const item = { kaptCode, aptNm: aptNm || '', dong: dong || '', gu: gu || '', ts: Date.now() }
  const next = pushInterest(prev, item, 10)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  if (firstEver) track('interest_captured', { gu: item.gu, dong: item.dong })
}

// 관심 지역 {gu, dong} | null. 저장 단지(collection.regionName→gu)를 가중치 2로 합산.
export function getTopRegion() {
  const viewed = getInterest()
  const saved = getCollection().map(a => ({ gu: a.regionName || '', dong: a.dong || '' }))
  return rankRegions(viewed, saved)
}
