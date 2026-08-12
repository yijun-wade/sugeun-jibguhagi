// 블로그 초안 md → 네이버 에디터에 넣을 수 있는 구조로 파싱.
// 순수 함수. 파일·시각·브라우저 어느 것도 만지지 않는다.
//
// 이 파서는 "잘 쓰인 초안"이 아니라 "실제로 쌓여 있는 초안 124편"을 기준으로 만들었다.
// 실측(2026-08-12)에서 나온 형식 편차:
//   - 굵게 소제목이 단독 줄인 편은 30편 중 2편뿐. 대다수는 "굵게 리드인 + 이어지는 본문".
//   - 굵게 시작 블록이 0개인 편이 있다(07-21, 07-28).
//   - 제목이 두 줄로 쪼개진 편이 있다(07-28).
//   - 상류 generate-blog-post.mjs의 라벨 파싱이 실패해 `# [본문]`이 남고 글이 두 번
//     들어간 편이 있다(05-19, 07-17). 자르지 않으면 두 번째 글까지 발행된다.
// 그래서 이 파서는 던지지 않는다. 이상은 warnings로 올리고 판단은 호출부가 한다.

const CTA_MARK = 'suzip.kr에서'
const DISCLAIMER_MARK = '뉴스를 바탕으로'
const LABEL_HEADING = /^#*\s*\[(제목|본문|태그)\]\s*$/

// 굵게로 시작하는가 (`**...**` 로 여는 블록)
const BOLD_LEAD = /^\*\*([^*]+)\*\*/
// 굵게 구간이 여러 개면 소제목이 아니라 요약줄이다 (`**정부** — … **시장** — …`)
const boldRuns = (s) => (s.match(/\*\*[^*]+\*\*/g) || []).length

export function parseDraft(md) {
  const warnings = []
  const lines = String(md).split('\n')

  // ── 1. 헤더 영역: 제목 · 태그 · 메타 ──────────────────────────
  let title = ''
  let tags = []
  const rest = []

  let i = 0
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (LABEL_HEADING.test(line)) continue // 상류 파싱 실패 잔재
    if (!title && line.startsWith('# ')) {
      title = line.slice(2).trim()
      // 제목이 여러 줄로 쪼개진 경우: 빈 줄이 나올 때까지가 제목이다.
      while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !lines[i + 1].startsWith('>')) {
        title += ' ' + lines[++i].trim()
      }
      continue
    }
    rest.push(line)
  }

  const bodyLines = []
  for (const line of rest) {
    if (LABEL_HEADING.test(line)) continue
    const t = line.match(/^>\s*태그:\s*(.+)$/)
    if (t) {
      tags = t[1].split(',').map((s) => s.trim()).filter(Boolean)
      continue
    }
    if (/^>\s*(카테고리|발행):/.test(line)) continue
    bodyLines.push(line)
  }

  if (!title) warnings.push('제목(# 줄)을 찾지 못했다')
  if (tags.length === 0) warnings.push('태그(> 태그:) 줄을 찾지 못했다')

  // ── 2. 블록 분해 ─────────────────────────────────────────────
  // 통짜 문자열로 두면 네이버에서 문단이 한 덩어리로 뭉친다.
  let raw = bodyLines
    .join('\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b && !/^-{3,}$/.test(b))
    .filter((b) => !LABEL_HEADING.test(b))

  // ── 3. 블록 분류 ─────────────────────────────────────────────
  const classify = (text) => {
    if (text.includes(CTA_MARK)) return 'cta'
    if (text.startsWith('*') && text.includes(DISCLAIMER_MARK)) return 'disclaimer'
    if (BOLD_LEAD.test(text) && boldRuns(text) >= 2) return 'summary'
    if (BOLD_LEAD.test(text)) return 'subhead'
    return 'body'
  }

  let blocks = raw.map((text) => ({
    text,
    type: classify(text),
    // 단독 줄 소제목인지, 뒤에 본문이 이어붙은 리드인인지.
    // 에디터에서 전자는 소제목 서식, 후자는 일반 문단으로 넣어야 한다.
    standalone: /^\*\*[^*]+\*\*$/.test(text),
  }))

  // ── 4. 글 2편이 섞인 초안 잘라내기 ───────────────────────────
  // 첫 면책 문구가 첫 편의 끝이다. 그 뒤는 전부 버린다.
  const firstDisclaimer = blocks.findIndex((b) => b.type === 'disclaimer')
  if (firstDisclaimer !== -1 && firstDisclaimer < blocks.length - 1) {
    warnings.push(`면책 문구 뒤에 ${blocks.length - firstDisclaimer - 1}개 블록이 더 있다 — 글 2편 중복으로 보고 잘라냄`)
    blocks = blocks.slice(0, firstDisclaimer + 1)
  }

  // ── 5. 좌표 ──────────────────────────────────────────────────
  const idxOf = (type) => blocks.findIndex((b) => b.type === type)
  const summaryIndex = idxOf('summary')
  const ctaIndex = idxOf('cta')
  const disclaimerIndex = idxOf('disclaimer')
  const subheadIndexes = blocks.reduce((acc, b, i) => (b.type === 'subhead' ? [...acc, i] : acc), [])

  if (summaryIndex === -1) warnings.push('3줄 요약(**정부** — …)을 찾지 못했다')
  if (ctaIndex === -1) warnings.push('CTA 줄(suzip.kr)을 찾지 못했다')

  // 본문 = 요약 다음 ~ CTA 직전. 둘 중 하나가 없으면 양끝으로 벌린다.
  const bodyStart = summaryIndex === -1 ? 0 : summaryIndex + 1
  const bodyEnd = (ctaIndex === -1 ? blocks.length : ctaIndex) - 1

  return { title, tags, blocks, summaryIndex, ctaIndex, disclaimerIndex, subheadIndexes, bodyStart, bodyEnd, warnings }
}
