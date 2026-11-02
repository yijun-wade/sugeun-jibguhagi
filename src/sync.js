// src/sync.js — 로컬(localStorage) ↔ 서버(Supabase) 동기화
//
// 설계 원칙
//   1) 로컬이 먼저다. 모든 쓰기는 지금처럼 localStorage에 즉시 반영하고,
//      서버 업서트는 뒤따라가는 비동기 작업이다. 서버가 죽어도 사용자는 끊김을 못 느낀다.
//   2) 로그인 시점에 병합한다. 로그아웃 상태에서 쌓은 데이터를 버리지 않는다.
//   3) 로그아웃해도 로컬은 지우지 않는다. 지우면 비로그인 사용자보다 못한 경험이 된다.

import { getSupabase } from './supabase.js'

const KEYS = {
  collection: 'soozip-collection',
  interest: 'soozip-interest',
  subscribed_regions: 'soozip-subscribed-regions',
}

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 용량 초과 등 */ }
}

// 단지 목록은 kaptCode, 지역은 dong이 신원이다. 같은 항목이면 최신 것을 남긴다.
function identity(item) {
  if (item == null) return null
  if (typeof item === 'string') return item
  return item.kaptCode ?? item.dong ?? JSON.stringify(item)
}
function stamp(item) {
  return item?.savedAt ?? item?.viewedAt ?? item?.at ?? 0
}

export function mergeLists(localList, remoteList) {
  const byId = new Map()
  for (const item of [...(remoteList || []), ...(localList || [])]) {
    const id = identity(item)
    if (id == null) continue
    const prev = byId.get(id)
    if (!prev || stamp(item) >= stamp(prev)) byId.set(id, item)
  }
  return [...byId.values()]
}

async function fetchRemote(supabase, userId) {
  const { data, error } = await supabase
    .from('user_data')
    .select('collection, interest, subscribed_regions')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data || {}
}

/**
 * 로그인 직후 1회. 로컬과 서버를 병합해 양쪽에 반영한다.
 * @returns {Promise<boolean>} 성공 여부. 실패해도 로컬은 그대로라 서비스는 돌아간다.
 */
export async function syncOnLogin(userId) {
  if (!userId) return false
  const supabase = await getSupabase()
  if (!supabase) return false
  try {
    const remote = await fetchRemote(supabase, userId)
    const merged = {}
    for (const [field, key] of Object.entries(KEYS)) {
      merged[field] = mergeLists(readLocal(key), remote[field])
      writeLocal(key, merged[field])
    }
    const { error } = await supabase.from('user_data').upsert({
      user_id: userId,
      ...merged,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return true
  } catch {
    return false
  }
}

/**
 * 로컬이 바뀔 때마다 호출. 디바운스해서 과도한 쓰기를 막는다.
 * 로그인 상태가 아니면 아무 일도 하지 않는다.
 */
let pending = null
export function pushLocalToServer(userId, delayMs = 1500) {
  if (!userId) return
  clearTimeout(pending)
  pending = setTimeout(async () => {
    try {
      const supabase = await getSupabase()
      if (!supabase) return
      const payload = { user_id: userId, updated_at: new Date().toISOString() }
      for (const [field, key] of Object.entries(KEYS)) payload[field] = readLocal(key)
      await supabase.from('user_data').upsert(payload)
    } catch { /* 다음 변경 때 다시 올라간다 */ }
  }, delayMs)
}
