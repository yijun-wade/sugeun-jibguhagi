// STEP 0 사전 점검. 글을 만들기 전에 "올릴 수 있는 상태인지"부터 본다.
//
// 설계문은 4항목이었으나 실측 후 3항목이 됐다:
//  - ChatGPT 로그인 확인 → 이미지를 헤드리스 렌더로 만들면서 삭제
//  - 붙여넣기 권한 예행연습 → CDP 입력이 그냥 되는 것을 확인해 삭제
// 남은 것은 초안 존재 / 중복 발행 방지 / 네이버 로그인.
//
// 이 단계의 진짜 역할은 멱등성 게이트다. 하나라도 실패하면 글을 만들지 않고 종료한다.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseDraft } from './lib/draft.mjs'
import { openEditor, dismissResumePopup, dismissHelpPanel, assertAccount, reserveCount, BLOG_ID } from './lib/editor.mjs'
import { fetchPublished, findDuplicate, normalizeDate } from './lib/published.mjs'
import { isComplete } from './lib/state.mjs'

export const draftPath = (date) => join(process.cwd(), 'blog-posts', `${date}-부동산브리핑.md`)

/** 브라우저 없이 확인할 수 있는 것들. 크롬을 띄우기 전에 먼저 건다. */
export async function precheckOffline(date, state) {
  const checks = []
  const fail = (name, reason) => { checks.push({ name, ok: false, reason }); return { ok: false, checks } }
  const pass = (name, note) => checks.push({ name, ok: true, note })

  // 1. 오늘 초안이 있는가
  const p = draftPath(date)
  if (!existsSync(p)) return fail('초안 존재', `없음: blog-posts/${date}-부동산브리핑.md (GitHub Actions 실패?)`)
  const draft = parseDraft(readFileSync(p, 'utf-8'))
  if (!draft.title) return fail('초안 존재', '초안에 제목이 없다')
  pass('초안 존재', `"${draft.title}"`)
  if (draft.warnings.length) checks.push({ name: '초안 경고', ok: true, note: draft.warnings.join(' / ') })

  // 2-a. 상태 파일 — 이미 예약까지 끝났으면 더 볼 것도 없다
  if (isComplete(state)) return fail('중복 방지', `이미 예약 완료 (${state.scheduledFor})`)
  pass('상태 파일', '미완료 — 진행 대상')

  // 2-b. 이미 발행됐는가 (상태 파일이 지워진 채 재실행되는 경우 방어)
  try {
    const posts = await fetchPublished(BLOG_ID, 30)
    const dup = findDuplicate(posts, draft.title)
    if (dup) return fail('중복 방지', `이미 발행됨: "${dup.title}" (${dup.addDate})`)
    const latest = posts[0]
    pass('발행 목록', `최근 발행 ${latest ? `${normalizeDate(latest.addDate)} "${latest.title.slice(0, 24)}…"` : '없음'}`)
  } catch (e) {
    // 조회 실패로 발행을 막지는 않는다(상태 파일이 1차 방어선). 다만 ✅로 찍으면
    // 안전망이 죽은 것을 통과로 착각한다 — 실제로 네이버의 비표준 JSON 때문에
    // 이 경로가 조용히 죽어 있었다. 경고로 구분해서 남긴다.
    checks.push({ name: '발행 목록', warn: true, ok: true, note: `⚠ 조회 실패 — 중복 탐지 없이 진행: ${e.message}` })
  }

  return { ok: true, checks, draft }
}

/** 브라우저가 필요한 것들 */
export async function precheckOnline(page, draft) {
  const checks = []

  // 3. 네이버 로그인 — 화면이 아니라 "에디터 프레임이 실제로 떴는가"로 판정한다
  let frame
  try {
    frame = await openEditor(page)
  } catch (e) {
    return { ok: false, checks: [{ name: '네이버 로그인', ok: false, reason: e.message }] }
  }
  checks.push({ name: '네이버 로그인', ok: true, note: '에디터 프레임 확보' })

  await assertAccount(page)
  checks.push({ name: '계정 확인', ok: true, note: BLOG_ID })

  await dismissHelpPanel(frame)
  const popup = await dismissResumePopup(frame)
  checks.push({ name: '이어쓰기 팝업', ok: true, note: popup.found ? '감지 → 닫음(이어쓰기 아님)' : '없음' })

  // 예약 건수 기준선. 등록 검증은 절대 수가 아니라 이 값의 증가분으로 한다.
  const baseline = await reserveCount(frame)
  checks.push({ name: '예약 건수 기준선', ok: true, note: `${baseline}건` })

  return { ok: true, checks, frame, reserveBaseline: baseline }
}

export function printChecks(checks) {
  for (const c of checks) {
    const icon = !c.ok ? '❌' : c.warn ? '⚠️ ' : '✅'
    console.log(`  ${icon} ${c.name.padEnd(14)} ${c.ok ? (c.note || '') : c.reason}`)
  }
}
