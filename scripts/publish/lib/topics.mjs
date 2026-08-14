// 오늘 쓸 소재를 카테고리 순환으로 고른다. 순수 함수.
//
// 지인 시스템 STEP 1의 교훈을 그대로 가져온다:
//
//  1. 카테고리를 순환시킨다. 같은 날 두 편이 같은 카테고리면 서로 검색 순위를
//     잡아먹는다. 하루 4편이면 4개 카테고리가 전부 달라야 한다.
//
//  2. 뽑는 쪽과 거르는 쪽 규칙이 같아야 한다. 지인 시스템은 뽑을 때 "키워드가
//     같은지"만, 거를 때 "같은 브랜드인지"까지 봤다. 그래서 매번 같은 소재를
//     골라놓고 매번 튕겨내며 하루를 통째로 날렸다. 여기서는 pick도 filter도
//     같은 keyOf()로 판단한다.
//
//  3. 소진되면 조용히 비우지 않고 알린다. 용어 25건·정책 8건은 유한하다.

export const CATEGORIES = ['브리핑', '용어사전', '정책', '임장가이드']

/** 소재의 고유 키. 중복 판정의 유일한 기준 — 뽑을 때도 거를 때도 이걸 쓴다. */
export const keyOf = (t) => `${t.category}:${String(t.subject).trim()}`

/**
 * @param {object} pools  카테고리별 후보 배열 {브리핑:[], 용어사전:[], ...}
 * @param {string[]} usedKeys  이미 쓴 소재 키 (keyOf 형식)
 * @param {number} count  뽑을 개수
 * @param {string} seed  같은 날 재실행 시 같은 결과가 나오도록 (보통 날짜)
 * @returns {{picked: Array, warnings: string[]}}
 */
export function pickTopics(pools, usedKeys, count, seed) {
  const used = new Set(usedKeys)
  const warnings = []
  const picked = []
  const usedCategories = new Set()

  // 카테고리 순환 순서도 날짜에 따라 돌린다 — 매일 브리핑이 08시에 고정되지 않게.
  const start = hash(seed) % CATEGORIES.length
  const order = CATEGORIES.map((_, i) => CATEGORIES[(start + i) % CATEGORIES.length])

  for (const cat of order) {
    if (picked.length >= count) break
    const pool = pools[cat] || []
    // 거르는 기준은 keyOf 하나뿐. 뽑는 쪽에서 미리 걸러야 "골랐다가 튕기는" 낭비가 없다.
    const fresh = pool.filter((t) => !used.has(keyOf(t)))
    if (fresh.length === 0) {
      if (pool.length > 0) warnings.push(`${cat}: 후보 ${pool.length}건이 전부 소진됨`)
      continue
    }
    const t = fresh[hash(`${seed}#${cat}`) % fresh.length]
    picked.push(t)
    used.add(keyOf(t))
    usedCategories.add(cat)
  }

  // 4개 카테고리로 못 채우면 남은 자리는 비운다. 같은 카테고리를 두 번 쓰지 않는다 —
  // 하루에 같은 카테고리 두 편은 서로 순위를 갉아먹는다.
  if (picked.length < count) {
    warnings.push(`${count}편 요청, ${picked.length}편만 확보 (카테고리 중복 없이 채울 수 없음)`)
  }
  return { picked, warnings }
}

function hash(s) {
  let h = 2166136261
  for (let i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822507)
  h ^= h >>> 13
  h = Math.imul(h, 3266489909)
  h ^= h >>> 16
  return h >>> 0
}
