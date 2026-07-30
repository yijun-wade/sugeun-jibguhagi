// src/interest-core.js — 관심 지역 순수 로직 (side-effect·외부 임포트 없음, 단위테스트 대상)

// 관심 목록에 항목 추가: kaptCode 중복 제거, 최신순 맨 앞, 최대 max개
export function pushInterest(list, item, max = 10) {
  const base = Array.isArray(list) ? list.filter(a => a && a.kaptCode !== item.kaptCode) : []
  return [item, ...base].slice(0, max)
}

// 관심 지역 산출: 저장(saved) 가중치 2, 조회(viewed) 가중치 1.
// 최고 가중 gu와 그 gu 안에서 먼저 등장하는 dong 반환. gu 없는 항목은 제외. 없으면 null.
export function rankRegions(viewed = [], saved = []) {
  const weighted = [
    ...saved.map(a => ({ ...a, w: 2 })),
    ...viewed.map(a => ({ ...a, w: 1 })),
  ].filter(a => a && a.gu)
  if (weighted.length === 0) return null
  const guScore = new Map()
  for (const a of weighted) guScore.set(a.gu, (guScore.get(a.gu) || 0) + a.w)
  let topGu = null, best = -1
  for (const [gu, score] of guScore) if (score > best) { best = score; topGu = gu }
  const dong = weighted.find(a => a.gu === topGu && a.dong)?.dong || null
  return { gu: topGu, dong }
}

// 텍스트에 관심 지역(gu 또는 dong)이 언급됐는지
export function matchRegion(text, gu, dong) {
  if (!text) return false
  const s = String(text)
  return !!((gu && s.includes(gu)) || (dong && s.includes(dong)))
}
