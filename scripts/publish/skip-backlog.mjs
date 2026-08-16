// 밀린 초안을 "소급 발행 안 함"으로 닫는다.
//
// 왜 지우지 않고 닫는가:
//  - 초안 파일은 git에 있고, 나중에 소재로 재활용할 수 있다.
//  - 미완료로 두면 "밀린 초안" 경보가 매일 울린다. 거짓 경보가 쌓이면 진짜 경보를
//    무시하게 된다 — 알림의 신뢰도가 파이프라인의 유일한 안전망이다.
//  - 상태만 닫으면 되돌리기도 쉽다(.publish-state/<id>.json 삭제).
//
// 왜 자동으로 소급 발행하지 않는가:
//  하루에 여러 편이 한꺼번에 나가는 것 자체가 대량 발행 신호다(스펙 리스크 1).
//  그리고 브리핑은 뉴스 기반이라 열흘 지난 글은 검색 가치가 거의 없다.
//
// 사용법: node scripts/publish/skip-backlog.mjs [--before YYYY-MM-DD] [--dry]

import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { load, mark, isComplete } from './lib/state.mjs'

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const BEFORE = (args.find((a) => a.startsWith('--before=')) || '').split('=')[1]
  || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

const drafts = readdirSync(join(process.cwd(), 'blog-posts'))
  .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f) && f.slice(0, 10) < BEFORE)
  .sort()

const pending = drafts.map((f) => f.replace(/\.md$/, '')).filter((id) => !isComplete(load(id)))

console.log(`\n${BEFORE} 이전 초안 ${drafts.length}편 중 미처리 ${pending.length}편`)
if (!pending.length) { console.log('닫을 것이 없다\n'); process.exit(0) }

for (const id of pending) {
  console.log(`  ${DRY ? '(가상)' : '닫음'} ${id}`)
  if (!DRY) {
    const st = load(id)
    st.draft = `blog-posts/${id}.md`
    mark(st, 'schedule', true, { note: '소급 발행 안 함 (사용자 판단)', skipped: true })
  }
}
console.log(`\n${DRY ? '가상 실행 — 아무것도 바꾸지 않았다' : `${pending.length}편 닫음. 되돌리려면 .publish-state/<id>.json 삭제`}\n`)
