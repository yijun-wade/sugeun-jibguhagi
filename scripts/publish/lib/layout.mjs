// 카드 이미지를 본문 어느 자리에 넣을지 결정한다. 순수 함수.
// 브라우저 앞에서 판단하지 않기 위해, 삽입 지도를 여기서 전부 확정한다.
//
// 설계 문서(2026-08-12)의 최초 규칙은 "**소제목** 단독 줄 3개 이상"을 전제로 5장을
// 배치하고, 모자라면 2장으로 강등하는 것이었다. 실측에서 이 전제가 깨졌다:
// 최근 30편 중 단독 줄 소제목이 있는 편은 2편뿐이고, 굵게 시작 블록이 0개인 편도 있다.
// 강등 경로가 평상시 경로가 되어 성공기준(이미지 3장 이상)을 못 지킨다.
//
// 그래서 기준을 소제목이 아니라 "본문 문단 수"로 바꾼다. 소제목은 자리를 결정하는
// 기준이 아니라, 결정된 자리를 예쁘게 당겨오는 스냅 힌트로만 쓴다.

// 우선순위 — 자리가 모자라면 뒤에서부터 버린다.
// 대표와 CTA가 먼저인 이유: 대표는 네이버 목록 썸네일이 되고, CTA는 유입 목적 그 자체다.
// 중간 3장 중 market을 먼저 버리는 이유: 정부(원인)와 실수요자(결과)가 남아야 글이 성립한다.
export const CARD_PRIORITY = ['title', 'cta', 'intent', 'demand', 'market']
const MIDDLE_BY_PRIORITY = ['intent', 'demand', 'market']
// 배치 순서는 우선순위와 다르다. 3줄 요약과 card-generator가 모두 정부 → 시장 → 실수요자
// 순이므로, 본문에 꽂히는 순서도 그래야 한다. 버리는 순서를 꽂는 순서로 쓰면 안 된다.
const MIDDLE_IN_ORDER = ['intent', 'market', 'demand']

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

export function buildLayout(draft) {
  const warnings = [...draft.warnings]
  const { blocks, summaryIndex, ctaIndex, disclaimerIndex, subheadIndexes, bodyStart, bodyEnd } = draft

  // 본문 문단 수. 여기서 장수가 결정된다.
  const bodyCount = Math.max(0, bodyEnd - bodyStart + 1)
  // 문단마다 이미지가 박히면 글보다 이미지가 많아 보인다. 문단 2개당 1장을 넘지 않는다.
  const middleCount = clamp(Math.floor(bodyCount / 2), 0, MIDDLE_BY_PRIORITY.length)

  if (subheadIndexes.length === 0) {
    warnings.push('굵게 시작하는 소제목이 0개 — 문단 균등 분할로만 배치한다')
  }

  const taken = new Set()
  const placements = []

  // ── 대표 카드: 맨 위 고정 ────────────────────────────────────
  placements.push({ card: 'title', afterBlockIndex: -1 })
  taken.add(-1)

  // ── CTA 카드: CTA 문단 바로 앞 ───────────────────────────────
  const ctaAt = (ctaIndex === -1 ? blocks.length : ctaIndex) - 1
  if (ctaAt > -1 && !taken.has(ctaAt)) {
    placements.push({ card: 'cta', afterBlockIndex: ctaAt })
    taken.add(ctaAt)
  }

  // ── 중간 카드: 본문을 균등 분할 → 소제목으로 스냅 ────────────
  // 하한은 요약줄 바로 뒤, 상한은 CTA 카드 자리 직전. 요약 위·면책 아래로는 못 간다.
  const lo = summaryIndex === -1 ? 0 : summaryIndex
  const hi = (ctaAt > -1 ? ctaAt : (disclaimerIndex === -1 ? blocks.length : disclaimerIndex)) - 1

  // 어떤 장을 남길지는 우선순위로, 어느 자리에 꽂을지는 논리 순서로.
  const middleCards = MIDDLE_IN_ORDER.filter((c) => MIDDLE_BY_PRIORITY.indexOf(c) < middleCount)

  for (let j = 1; j <= middleCount; j++) {
    // j번째 분할 지점의 "그 앞에 넣을" 블록
    const target = bodyStart + Math.round((j * bodyCount) / (middleCount + 1))
    let at = clamp(target - 1, lo, hi)

    // 스냅: ±1 안에 소제목이 있으면 그 앞으로 당긴다. 가까운 쪽 우선.
    const snap = subheadIndexes
      .filter((s) => Math.abs(s - 1 - at) <= 1 && s - 1 >= lo && s - 1 <= hi && !taken.has(s - 1))
      .sort((a, b) => Math.abs(a - 1 - at) - Math.abs(b - 1 - at))[0]
    if (snap !== undefined) at = snap - 1

    // 자리가 이미 찼으면 빈 칸을 찾아 뒤로 민다. 못 찾으면 이 장은 버린다.
    while (taken.has(at) && at <= hi) at++
    if (at > hi || taken.has(at)) {
      warnings.push(`${middleCards[j - 1]} 카드는 넣을 자리가 없어 생략`)
      continue
    }

    placements.push({ card: middleCards[j - 1], afterBlockIndex: at })
    taken.add(at)
  }

  // 삽입은 반드시 오름차순으로 — 앞에 넣으면 뒤 인덱스가 밀린다.
  placements.sort((a, b) => a.afterBlockIndex - b.afterBlockIndex)

  if (placements.length < 3) {
    warnings.push(`이미지가 ${placements.length}장뿐 — 본문 문단이 ${bodyCount}개로 너무 짧다`)
  }

  return { placements, bodyCount, warnings }
}
