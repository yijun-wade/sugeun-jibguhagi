import { buildReportCacheKey } from './report-cache-key.js'

const TTL_MS = 24 * 60 * 60 * 1000  // 24시간

export function getCachedReport(input) {
  try {
    const key = buildReportCacheKey(input)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { value, savedAt } = JSON.parse(raw)
    if (Date.now() - savedAt > TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return value
  } catch {
    return null
  }
}

export function setCachedReport(input, value) {
  try {
    const key = buildReportCacheKey(input)
    localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }))
  } catch {
    // QuotaExceededError 등은 무시
  }
}

export function clearCachedReport(input) {
  try {
    const key = buildReportCacheKey(input)
    localStorage.removeItem(key)
  } catch {}
}
