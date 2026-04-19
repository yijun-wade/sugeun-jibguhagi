// 수집 기능 — localStorage 기반 관심 단지 저장
const KEY = 'soozip-collection'

export function getCollection() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function isCollected(kaptCode) {
  return getCollection().some(a => a.kaptCode === kaptCode)
}

export function toggleCollection(apt) {
  const list = getCollection()
  const idx  = list.findIndex(a => a.kaptCode === apt.kaptCode)
  if (idx >= 0) {
    list.splice(idx, 1)
  } else {
    list.unshift({
      kaptCode:   apt.kaptCode,
      aptNm:      apt.aptNm,
      dong:       apt.dong,
      regionName: apt.regionName,
      buildYear:  apt.buildYear,
      recentAvg:  apt.recentAvg,
      direction:  apt.direction,
      savedAt:    new Date().toISOString(),
    })
  }
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {}
  return list
}
