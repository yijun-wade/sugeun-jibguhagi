// 이미 발행된 글 목록 조회. 로그인 없이 공개 목록 API로 확인한다.
// 상태 파일이 지워진 채 재실행돼도 같은 글을 두 번 올리지 않기 위한 방어선.

const LIST_URL = (blogId, count) =>
  `https://blog.naver.com/PostTitleListAsync.naver?blogId=${blogId}` +
  `&viewdate=&currentPage=1&categoryNo=&parentCategoryNo=&countPerPage=${count}`

/**
 * 네이버 응답은 표준 JSON이 아니다. 페이지네이션 HTML 안에 \' (백슬래시+홑따옴표)가
 * 들어 있는데 JSON에서는 무효한 이스케이프라 JSON.parse가 그대로 던진다.
 *   ..."html":"<div class=\'blog2_paginate\'>..."
 * 실제로 이것 때문에 중복 탐지가 통째로 무력화됐다(2026-08-13).
 */
export function parseNaverJson(text) {
  return JSON.parse(String(text).replace(/\\'/g, "'"))
}

/** @returns {Promise<Array<{logNo:string,title:string,addDate:string}>>} */
export async function fetchPublished(blogId, count = 30) {
  const r = await fetch(LIST_URL(blogId, count), {
    headers: { Referer: `https://blog.naver.com/${blogId}` },
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) throw new Error(`글 목록 조회 실패: HTTP ${r.status}`)
  const data = parseNaverJson(await r.text())
  if (data.resultCode !== 'S') throw new Error(`글 목록 조회 실패: ${data.resultMessage || data.resultCode}`)
  return (data.postList || []).map((p) => ({
    logNo: p.logNo,
    // 제목이 URL 인코딩 + '+'가 공백인 형태로 온다
    title: decodeURIComponent(String(p.title).replace(/\+/g, ' ')),
    addDate: p.addDate, // "2026. 7. 23."
  }))
}

/** "2026. 7. 23." → "2026-07-23" */
export function normalizeDate(addDate) {
  const m = String(addDate || '').match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

// 제목 비교용 정규화 — 공백·문장부호 차이로 중복을 놓치지 않게
export const normalizeTitle = (t) =>
  String(t || '').replace(/[\s.,!?'"''""…·\-—]/g, '').toLowerCase()

/**
 * 같은 제목이 이미 발행됐는가.
 * 제목이 완전히 같지 않아도(에디터가 다듬는 경우) 정규화 후 포함관계면 같은 글로 본다.
 */
export function findDuplicate(posts, title) {
  const t = normalizeTitle(title)
  if (!t) return null
  return posts.find((p) => {
    const pt = normalizeTitle(p.title)
    return pt === t || (t.length > 10 && (pt.includes(t) || t.includes(pt)))
  }) || null
}
