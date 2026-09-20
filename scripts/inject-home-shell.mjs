// 빌드된 dist/index.html의 #root 안에 크롤러가 읽을 홈 내용을 넣는다.
//
// 왜 이렇게 하나: vercel.json의 rewrites는 파일 시스템 확인 '뒤에' 적용된다. `/`는 실제 파일
// (dist/index.html)이 있어서 UA 분기 rewrite가 아예 실행되지 않는다. 단지 페이지(/apt/*)는
// 해당 파일이 없어 rewrite가 먹히지만 홈은 안 된다 — 실제로 배포해 보고 확인했다.
//
// 그래서 셸 자체에 내용을 넣는다. React가 마운트하면 #root를 비우고 다시 그리므로 사람에게는
// 잠깐 보이고 사라진다. 크롤러와 자바스크립트가 꺼진 브라우저는 이 내용을 본다.
// 숨기지 않는다 — CSS로 감춘 내용은 검색엔진이 값을 깎는다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { buildHomeShell } from '../api/_prerender-home.js'

const distPath = join(process.cwd(), 'dist', 'index.html')
if (!existsSync(distPath)) { console.error('dist/index.html 없음 — 빌드 먼저'); process.exit(1) }

const load = (f, fb) => { try { return JSON.parse(readFileSync(join(process.cwd(), 'public', f), 'utf8')) } catch { return fb } }
const vibe = load('apt-vibe.json', {})
// '많이 찾는 단지' — 요약을 만들어 둔 단지 중 세대수 상위. 플래시를 짧게 두려고 30곳만.
const featured = load('seoul-apt-enriched.json', [])
  .filter(a => vibe[a.kaptCode])
  .sort((x, y) => (y.kaptdaCnt || 0) - (x.kaptdaCnt || 0))
  .slice(0, 30)
  .map(a => ({ kaptCode: a.kaptCode, kaptName: a.kaptName, sigungu: a.sigungu, dong: a.dong }))

const html = readFileSync(distPath, 'utf8')
if (!html.includes('<div id="root"></div>')) {
  console.error('#root를 찾지 못했다 — 셸 구조가 바뀌었는지 확인'); process.exit(1)
}
const out = html.replace('<div id="root"></div>', `<div id="root">${buildHomeShell(featured)}</div>`)
writeFileSync(distPath, out)
console.log(`홈 셸 주입 완료: 많이 찾는 단지 ${featured.length}곳 · ${(out.length - html.length).toLocaleString()}바이트 추가`)
