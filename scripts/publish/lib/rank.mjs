// 색인·순위 추적의 순수 로직. 네트워크·파일 접근 없음.
//
// 왜 필요한가: 스펙의 성공 기준 5개 중 4개는 코드가 판정하지만
// "2주 뒤 색인률이 수동 시절 대비 유지되는가"만 측정 수단이 없었다.
// 이건 네이버 저품질 판정에 대한 유일한 방어선이다 — 노출이 꺾이는 것을
// 모르면 계속 발행하다가 계정을 태운다.

/** 네이버 검색 결과의 <b> 등 태그·엔티티 제거 */
export const stripTags = (s) =>
  String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .trim()

/**
 * 검색 결과에서 우리 글의 순위(1-based). 없으면 null.
 * 블로그 ID는 link와 bloggerlink 양쪽에 나타날 수 있어 둘 다 본다.
 */
export function findOurRank(items, blogId) {
  const re = new RegExp(`(^|[/.])${blogId}(/|$|\\?)`)
  for (let i = 0; i < (items || []).length; i++) {
    const it = items[i] || {}
    if (re.test(it.link || '') || re.test(it.bloggerlink || '')) return i + 1
  }
  return null
}

/** 발행 후 며칠 지났는지 (KST 날짜 기준) */
export function daysSince(publishedDate, now) {
  const d0 = Date.parse(`${publishedDate}T00:00:00+09:00`)
  const today = new Date(now.getTime() + 9 * 3600 * 1000)
  const d1 = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00+09:00`)
  return Math.round((d1 - d0) / 86400000)
}

/**
 * 오늘 이 글을 확인할 차례인가.
 *
 * 매일 전부 확인하면 API 호출이 글 수만큼 늘고, 발행 직후 며칠이 지나면
 * 순위가 거의 안 변한다. 확인 시점을 D+1·3·7·14로 고정하고 그 날에만 본다.
 * (같은 날 재실행은 이미 기록이 있으므로 건너뛴다 — 멱등)
 */
export const CHECKPOINTS = [1, 3, 7, 14]

export function isDue(publishedDate, checks, now) {
  const age = daysSince(publishedDate, now)
  if (age < 1 || age > Math.max(...CHECKPOINTS)) return false
  // 놓친 체크포인트도 잡는다 — 맥이 며칠 꺼져 있었을 수 있다
  const target = CHECKPOINTS.filter((c) => c <= age).pop()
  if (target === undefined) return false
  return !(checks || []).some((c) => c.day === target)
}

/** 이번에 기록할 체크포인트 번호 */
export function currentCheckpoint(publishedDate, now) {
  const age = daysSince(publishedDate, now)
  return CHECKPOINTS.filter((c) => c <= age).pop() ?? null
}

/**
 * 색인률 — 확인한 글 중 검색에 잡힌 비율.
 * 이 값이 꺾이면 발행을 줄여야 한다는 신호다.
 */
export function indexRate(entries, day = 1) {
  const rows = (entries || [])
    .map((e) => (e.checks || []).find((c) => c.day === day))
    .filter(Boolean)
  if (!rows.length) return null
  const indexed = rows.filter((c) => c.titleRank !== null).length
  return { day, checked: rows.length, indexed, rate: indexed / rows.length }
}
