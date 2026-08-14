// 에디터에 조립된 문서를 순서대로 덤프한다. 읽기 전용.
import { connectChrome, newPage } from './lib/chrome.mjs'
import { SEL, sleep } from './lib/editor.mjs'

const { browser, close } = await connectChrome()
const page = (await browser.pages()).find(p => /blog\.naver\.com/.test(p.url())) || await newPage(browser)
const frame = page.frames().find(f => SEL.frame.test(f.url()))
if (!frame) { console.error('에디터 프레임 없음 — 에디터가 열려 있어야 합니다'); process.exit(1) }

const doc = await frame.evaluate(() => {
  const out = []
  document.querySelectorAll('.se-component').forEach(c => {
    if (c.classList.contains('se-documentTitle')) {
      out.push({ t: '제목', text: (c.innerText||'').trim() })
    } else if (c.querySelector('img')) {
      const img = c.querySelector('img')
      out.push({ t: '이미지', text: (img.getAttribute('src')||'').split('/').pop().slice(0,40) })
    } else {
      const html = c.innerHTML
      out.push({
        t: '문단',
        text: (c.innerText||'').replace(/\s+/g,' ').trim().slice(0,52),
        bold: /font-weight:\s*bold|<b[ >]|<strong/i.test(html) || /se-fs-|se-ff-/.test(html) && /bold/i.test(html),
        italic: /font-style:\s*italic|<i[ >]|<em[ >]/i.test(html),
      })
    }
  })
  return out
})
console.log()
doc.forEach((d,i) => {
  const mark = d.t==='이미지' ? '🖼 ' : d.t==='제목' ? '📌 ' : (d.bold?'𝐁':' ')+(d.italic?'𝑰':' ')+' '
  console.log(String(i).padStart(2)+' '+mark+' '+d.text)
})
console.log()
await close()
