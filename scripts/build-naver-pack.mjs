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

// 대표 이미지용 3줄 요약(정부/시장/실수요자) 추출
function parseSummary(body) {
  const clip = (s) => { const t = s.trim().replace(/\s+/g, ' '); return t.length > 46 ? t.slice(0, 45) + '…' : t }
  const m = body.match(/\*\*정부\*\*\s*[—\-]\s*(.+?)\s*[/·]?\s*\*\*시장\*\*\s*[—\-]\s*(.+?)\s*[/·]?\s*\*\*실수요자\*\*\s*[—\-]\s*([^*\n]+)/)
  if (m) return [['정부', clip(m[1])], ['시장', clip(m[2])], ['실수요자', clip(m[3])]]
  return []
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
  const body = bodyLines.join('\n')
  return { title, tags, bodyHtml: bodyToHtml(body), summary: parseSummary(body) }
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

// 대표 이미지 카드 내부 마크업 (미리보기·캡처용 동일 사용)
const tcInner = (p) => `
      <div class="tc-top"><span class="tc-badge">부동산 브리핑</span><span class="tc-date">${p.date}</span></div>
      <div class="tc-title">${esc(p.title)}</div>
      <div class="tc-summary">${(p.summary || []).map(([k, v]) => `<div class="tc-row"><span class="tc-k">${esc(k)}</span><span class="tc-v">${esc(v)}</span></div>`).join('')}</div>
      <div class="tc-foot"><span>수군수군 우리집</span><span>suzip.kr</span></div>`

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
    <div class="row">
      <div class="label">이미지</div>
      <div class="thumb-wrap"><div class="thumb-preview"><div class="thumb-card">${tcInner(p)}</div></div></div>
      <button class="copy dl-img" onclick="downloadImage(event, ${i}, '${p.date}-대표이미지')">이미지 다운로드</button>
    </div>
    <div class="thumb-capture"><div class="thumb-card" id="thumb-${i}">${tcInner(p)}</div></div>
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
  .dl-img { background: #2563eb; }
  .dl-img:hover { background: #1e40af; }
  /* 대표 이미지: 미리보기(0.30 스케일 클립) + 캡처용(화면 밖 풀사이즈) */
  .thumb-wrap { width: 324px; height: 324px; overflow: hidden; border-radius: 12px; border: 1px solid #e5e7eb; }
  .thumb-preview { width: 1080px; height: 1080px; transform: scale(0.30); transform-origin: top left; }
  .thumb-capture { position: absolute; left: -99999px; top: 0; width: 1080px; height: 1080px; }
  .thumb-card {
    width: 1080px; height: 1080px; box-sizing: border-box; padding: 84px 80px; overflow: hidden;
    background: linear-gradient(145deg, #1e3a8a 0%, #2563eb 100%); color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
  }
  .tc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 56px; }
  .tc-badge { font-size: 33px; font-weight: 900; background: rgba(255,255,255,.18); padding: 13px 30px; border-radius: 40px; }
  .tc-date { font-size: 29px; opacity: .85; }
  .tc-title { font-size: 64px; font-weight: 900; line-height: 1.3; letter-spacing: -1.5px; margin-bottom: 60px; }
  .tc-row { margin-bottom: 26px; }
  .tc-k { display: inline-block; font-size: 28px; font-weight: 900; background: #fff; color: #1e3a8a; padding: 6px 18px; border-radius: 12px; margin-bottom: 10px; }
  .tc-v { display: block; font-size: 30px; line-height: 1.5; opacity: .96; }
  .tc-foot { margin-top: 40px; padding-top: 34px; border-top: 2px solid rgba(255,255,255,.25); font-size: 28px; font-weight: 800; opacity: .92; display: flex; justify-content: space-between; }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
</head>
<body>
  <h1>📋 네이버 붙여넣기 팩</h1>
  <div class="guide">
    <b>주 1회 15분 루틴</b><br>
    ① 네이버 블로그 글쓰기 열기 → ② <b>제목 복사</b> 붙여넣기 → ③ <b>본문 복사(서식 유지)</b> 붙여넣기 → ④ <b>태그 복사</b> 붙여넣기 →
    ⑤ <b>이미지 다운로드</b>로 대표 이미지 받아서 글 맨 위에 첨부 → ⑥ 발행 대신 <b>예약</b>으로 <b>하루 1개씩</b> 날짜 지정. 아래 1일차부터 순서대로 예약하면 리듬이 자동 유지돼요.
  </div>
  ${cards}
<script>
  document.querySelectorAll('.copy[data-copy]').forEach((btn) => {
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

  async function downloadImage(ev, idx, filename) {
    const btn = ev.currentTarget
    const node = document.getElementById('thumb-' + idx)
    const orig = btn.textContent
    btn.textContent = '만드는 중…'
    try {
      const canvas = await html2canvas(node, { scale: 1, width: 1080, height: 1080, windowWidth: 1080, windowHeight: 1080, backgroundColor: null, useCORS: true })
      const link = document.createElement('a')
      link.download = filename + '.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
      btn.textContent = '받음 ✓'
      btn.classList.add('done')
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('done') }, 1600)
    } catch (e) {
      alert('이미지 생성 실패 — 새로고침 후 다시 시도해주세요.')
      btn.textContent = orig
    }
  }
</script>
</body>
</html>`

writeFileSync(OUT, html, 'utf-8')
console.log(`[naver-pack] 생성 완료 — ${posts.length}개 글 → ${OUT}`)
