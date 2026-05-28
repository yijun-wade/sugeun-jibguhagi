// @vercel/kv 래퍼 — 환경변수 없으면 no-op
// 로컬 개발 시 KV 미설정 상태에서도 보고서 생성이 동작하도록

let kvInstance = null
let initFailed = false

async function getKv() {
  if (kvInstance) return kvInstance
  if (initFailed) return null
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    initFailed = true
    return null
  }
  try {
    const mod = await import('@vercel/kv')
    kvInstance = mod.kv
    return kvInstance
  } catch (e) {
    console.warn('[report-kv] @vercel/kv import 실패:', e.message)
    initFailed = true
    return null
  }
}

const TTL_SECONDS = 30 * 24 * 60 * 60  // 30일

export async function kvGet(key) {
  const kv = await getKv()
  if (!kv) return null
  try {
    return await kv.get(key)
  } catch (e) {
    console.warn('[report-kv] get 실패:', e.message)
    return null
  }
}

export async function kvSet(key, value) {
  const kv = await getKv()
  if (!kv) return
  try {
    await kv.set(key, value, { ex: TTL_SECONDS })
  } catch (e) {
    console.warn('[report-kv] set 실패:', e.message)
  }
}

export async function kvDel(key) {
  const kv = await getKv()
  if (!kv) return
  try {
    await kv.del(key)
  } catch (e) {
    console.warn('[report-kv] del 실패:', e.message)
  }
}
