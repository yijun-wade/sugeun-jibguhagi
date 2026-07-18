// 주간 네이버 붙여넣기 팩 생성기
// blog-posts/*.md 최근 N개 → 네이버 스마트에디터에 바로 붙는 자체완결 HTML.
// 사용법: node scripts/build-naver-pack.mjs [개수(기본 7)]
// 흐름: 매일 자동 생성된 초안을 주 1회 한 번에 열어 → 제목·본문·태그 복사 → 예약발행(하루 1개씩)

import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const N = parseInt(process.argv[2], 10) || 7
const POSTS_DIR = join(process.cwd(), 'blog-posts')
// public/에 생성 → suzip.kr/naver-pack.html 로 배포(휴대폰에서 열어 복사). 색인은 noindex로 차단.
const OUT = join(process.cwd(), 'public', 'naver-pack.html')

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// 인라인: **굵게**, *기울임* (굵게 먼저)
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')

// 이 초안 포맷 전용 경량 md → html (본문만)
function bodyToHtml(body) {
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return blocks
    .map((block) => {
      if (/^-{3,}$/.test(block)) return '' // 구분선은 본문에서 생략
      if (block.startsWith('## ')) return `<h3>${inline(block.slice(3))}</h3>`
      if (block.startsWith('# ')) return `<h2>${inline(block.slice(2))}</h2>`
      // 한 블록 안 여러 줄 → <br>로 이어붙임
      const html = block.split('\n').map((l) => inline(l.trim())).join('<br>')
      return `<p>${html}</p>`
    })
    .filter(Boolean)
    .join('\n')
}

function parsePost(md) {
  const lines = md.split('\n')
  let title = ''
  let tags = ''
  const bodyLines = []
  for (const line of lines) {
    if (!title && line.startsWith('# ')) { title = line.slice(2).trim(); continue }
    const t = line.match(/^>\s*태그:\s*(.+)$/)
    if (t) { tags = t[1].trim(); continue }
    if (/^>\s*(카테고리|발행):/.test(line)) continue // 메타 줄 스킵
    if (line.trim() === '' && bodyLines.length === 0) continue // 선행 공백 스킵
    bodyLines.push(line)
  }
  return { title, tags, bodyHtml: bodyToHtml(bodyLines.join('\n')) }
}

const files = readdirSync(POSTS_DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}-.*\.md$/.test(f))
  .sort()
  .reverse()
  .slice(0, N)
  .reverse() // 오래된 것 → 최신 순 (예약발행 순서대로 붙여넣기 편하게)

const posts = files.map((f) => {
  const date = f.slice(0, 10)
  return { date, ...parsePost(readFileSync(join(POSTS_DIR, f), 'utf-8')) }
})

const cards = posts
  .map((p, i) => `
  <article class="card">
    <div class="card-head">
      <span class="badge">${i + 1}일차 · ${p.date}</span>
    </div>
    <div class="row">
      <div class="label">제목</div>
      <div class="val" id="title-${i}">${esc(p.title)}</div>
      <button class="copy" data-copy="text" data-target="title-${i}">제목 복사</button>
    </div>
    <div class="row">
      <div class="label">본문</div>
      <div class="val body" id="body-${i}">${p.bodyHtml}</div>
      <button class="copy" data-copy="html" data-target="body-${i}">본문 복사(서식 유지)</button>
    </div>
    <div class="row">
      <div class="label">태그</div>
      <div class="val tags" id="tags-${i}">${esc(p.tags)}</div>
      <button class="copy" data-copy="text" data-target="tags-${i}">태그 복사</button>
    </div>
  </article>`)
  .join('\n')

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex, nofollow" />
<title>네이버 붙여넣기 팩 (${posts.length}개)</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", sans-serif; max-width: 780px; margin: 0 auto; padding: 24px 16px 80px; color: #1f2937; background: #f9fafb; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .guide { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 16px; font-size: 14px; line-height: 1.7; margin: 16px 0 28px; }
  .guide b { color: #2563eb; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; margin-bottom: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  .card-head { margin-bottom: 12px; }
  .badge { background: #2563eb; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; }
  .row { display: grid; grid-template-columns: 56px 1fr auto; gap: 10px; align-items: start; padding: 10px 0; border-top: 1px solid #f3f4f6; }
  .label { font-size: 12px; font-weight: 700; color: #6b7280; padding-top: 4px; }
  .val { font-size: 14px; line-height: 1.5; }
  .val.body { line-height: 1.8; }
  .val.body p { margin: 0 0 12px; }
  .val.body h2 { font-size: 17px; margin: 16px 0 8px; }
  .val.body h3 { font-size: 15px; margin: 14px 0 6px; }
  .val.tags { color: #6b7280; font-size: 13px; }
  .copy { align-self: start; white-space: nowrap; background: #f97316; color: #fff; border: 0; border-radius: 8px; padding: 8px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .copy:hover { background: #ea580c; }
  .copy.done { background: #16a34a; }
</style>
</head>
<body>
  <h1>📋 네이버 붙여넣기 팩</h1>
  <div class="guide">
    <b>주 1회 15분 루틴</b><br>
    ① 네이버 블로그 글쓰기 열기 → ② <b>제목 복사</b> 붙여넣기 → ③ <b>본문 복사(서식 유지)</b> 붙여넣기 → ④ <b>태그 복사</b> 붙여넣기 →
    ⑤ 발행 대신 <b>예약</b>으로 <b>하루 1개씩</b> 날짜 지정. 아래 1일차부터 순서대로 예약하면 리듬이 자동 유지돼요.
  </div>
  ${cards}
<script>
  document.querySelectorAll('.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const el = document.getElementById(btn.dataset.target)
      try {
        if (btn.dataset.copy === 'html') {
          const html = el.innerHTML
          const text = el.innerText
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([html], { type: 'text/html' }),
              'text/plain': new Blob([text], { type: 'text/plain' }),
            }),
          ])
        } else {
          await navigator.clipboard.writeText(el.innerText.trim())
        }
        const orig = btn.textContent
        btn.textContent = '복사됨 ✓'
        btn.classList.add('done')
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('done') }, 1500)
      } catch (e) {
        alert('복사 실패 — 수동으로 선택해 복사해주세요.')
      }
    })
  })
</script>
</body>
</html>`

writeFileSync(OUT, html, 'utf-8')
console.log(`[naver-pack] 생성 완료 — ${posts.length}개 글 → ${OUT}`)
