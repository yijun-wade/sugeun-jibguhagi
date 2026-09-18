// 수근수근 요약 불러오기 — 미리 만들어 둔 정적 파일 먼저, 없으면 실시간 API.
//
// 요약은 방문마다 새로 만들어 5~6초 뒤에 떴다(평균 세션 15~27초). scripts/build-apt-vibe.mjs가
// public/vibe/{kaptCode}.json으로 미리 만들어 두면 첫 화면에 바로 뜬다. 배치가 아직 안 돈 단지는
// 종전처럼 /api/vibe로 간다(이제 엣지 캐시가 붙어 두 번째 방문부터는 빠르다).
export const STALE_DAYS = 60

/** 정적 파일을 받아들일 수 있으면 정규화해서, 아니면 null */
export function acceptStatic(doc, kaptCode, now = Date.now()) {
  if (!doc || typeof doc !== 'object' || doc.kaptCode !== kaptCode || !doc.generatedAt) return null
  const age = now - new Date(doc.generatedAt).getTime()
  if (!Number.isFinite(age) || age > STALE_DAYS * 864e5) return null
  return {
    categories: Array.isArray(doc.categories) ? doc.categories : [],
    summary: doc.summary || null,
    links: Array.isArray(doc.links) ? doc.links : [],
    empty: !!doc.empty,
    generatedAt: doc.generatedAt,
  }
}

const isJson = (r) => r?.ok && String(r.headers?.get?.('content-type') || '').includes('json')

/**
 * @returns {Promise<{categories:Array, summary:string|null, links:Array, empty:boolean, source:'static'|'live'|'error', ms:number}>}
 */
export async function loadVibe({ kaptCode, aptNm, dong, gu, aptType }, { fetchFn = fetch, signal, now = Date.now() } = {}) {
  const t0 = Date.now()
  const done = (r, source) => ({ categories: [], summary: null, links: [], empty: false, ...r, source, ms: Date.now() - t0 })

  if (kaptCode) {
    try {
      const r = await fetchFn(`/vibe/${encodeURIComponent(kaptCode)}.json`, { signal })
      // 없는 경로는 SPA 폴백(index.html, 200)으로 온다 — 상태 코드가 아니라 content-type으로 가린다.
      const hit = isJson(r) ? acceptStatic(await r.json(), kaptCode, now) : null
      if (hit) return done(hit, 'static')
    } catch (e) {
      if (e?.name === 'AbortError') throw e
    }
  }

  try {
    const q = new URLSearchParams({ aptName: aptNm || '', location: dong || '', gu: gu || '' })
    if (aptType === 'rental') q.set('type', 'rental')
    const r = await fetchFn(`/api/vibe?${q.toString()}`, { signal })
    const data = await r.json()
    if (data?.error) return done({}, 'error')
    return done({
      categories: data?.categories || [],
      summary: data?.summary || null,
      links: data?.links || [],
      empty: !!data?.empty,
    }, 'live')
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    return done({}, 'error')
  }
}
