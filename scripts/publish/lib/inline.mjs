// 마크다운 인라인 서식 → 에디터에 입력할 세그먼트 배열. 순수 함수.
//
// 에디터에 넣는 방법이 이 함수의 모양을 정한다.
// 텍스트를 통째로 넣고 나중에 범위를 선택해 굵게를 거는 방식은, 선택 범위를
// 키보드로 세야 해서 줄바꿈·자동완성 한 번에 어긋난다.
// 대신 "굵게 켜기 → 굵은 부분 입력 → 굵게 끄기 → 나머지 입력" 순으로 간다.
// 그래서 필요한 것은 위치가 아니라 순서대로 된 세그먼트다.

/**
 * '**정부** — 한줄' → [{text:'정부', bold:true, italic:false}, {text:' — 한줄', ...}]
 *
 * 기울임(*…*)도 처리해야 한다. 면책 문구가 `*뉴스를 바탕으로…*` 형태라
 * 이걸 모르면 별표가 그대로 발행된다.
 * 굵게(**)를 먼저 먹어야 기울임 규칙이 `**`를 반쪽씩 집지 않는다.
 *
 * @returns {Array<{text:string, bold:boolean, italic:boolean}>}
 */
export function parseInline(md) {
  const s = String(md ?? '')
  if (!s) return []
  const out = []
  const re = /\*\*([^*]+)\*\*|\*([^*\n]+)\*/g
  let last = 0
  let m
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false, italic: false })
    if (m[1] !== undefined) out.push({ text: m[1], bold: true, italic: false })
    else out.push({ text: m[2], bold: false, italic: true })
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false, italic: false })
  // 빈 세그먼트는 서식 토글만 낭비시킨다
  return out.filter((seg) => seg.text.length > 0)
}

/** 인접한 같은 서식 세그먼트를 합친다 — 토글 횟수를 줄인다 */
export function mergeSegments(segs) {
  const out = []
  for (const s of segs) {
    const prev = out[out.length - 1]
    if (prev && prev.bold === s.bold && prev.italic === s.italic) prev.text += s.text
    else out.push({ ...s })
  }
  return out
}

/** 블록 하나를 입력 계획으로. 굵게 토글은 필요할 때만 일어난다. */
export function toSegments(md) {
  return mergeSegments(parseInline(md))
}

/** 서식 없는 순수 텍스트 — 실제로 에디터에 치는 문자열 */
export const stripInline = (md) => toSegments(md).map((s) => s.text).join('')

/**
 * 평문 기준 문자 오프셋으로 서식 구간을 돌려준다.
 *
 * 왜 오프셋인가: 굵게 버튼을 먼저 켜고 타이핑하는 방식은 못 쓴다. 커서만 있고
 * 선택 영역이 없는 상태에서 네이버 툴바를 누르면 "현재 단어" 단위로 동작해서,
 * 끌 때 그 단어를 평문으로 한 번 더 써넣는다 — `<b>정부</b>정부 — …` 가 된다
 * (2026-08-14 실측). 그래서 평문으로 다 친 뒤 범위를 선택해 서식을 건다.
 *
 * @returns {Array<{start:number, end:number, bold:boolean, italic:boolean}>}
 */
export function formatRanges(md) {
  const out = []
  let pos = 0
  for (const seg of toSegments(md)) {
    const end = pos + seg.text.length
    if (seg.bold || seg.italic) out.push({ start: pos, end, bold: seg.bold, italic: seg.italic })
    pos = end
  }
  return out
}
