// 공통 유틸 - API 서버리스 함수에서 공유

// ── HTML 태그 제거 ──────────────────────────
export function stripHtml(str) {
  return (str || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

// ── 네이버 API 엔드포인트 ────────────────────
export const NAVER_BLOG = 'https://openapi.naver.com/v1/search/blog.json'
export const NAVER_CAFE = 'https://openapi.naver.com/v1/search/cafearticle.json'
export const NAVER_NEWS = 'https://openapi.naver.com/v1/search/news.json'
export const NAVER_KIN  = 'https://openapi.naver.com/v1/search/kin.json'

// ── 네이버 검색 공통 함수 ────────────────────
export async function naverSearch(endpoint, query, display = 4) {
  const url = `${endpoint}?query=${encodeURIComponent(query)}&display=${display}&sort=sim`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-Naver-Client-Id':     process.env.NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
      },
    })
    if (!r.ok) return []
    return (await r.json()).items || []
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
