// 수근수근 요약에 넣을 글 고르기 — 같은 이름의 다른 단지 이야기를 걸러낸다.
//
// 실제 항의(2026-09, Q&A 입력창): "AI의 수근수근은 수색동 DMC청구가 아닌 마포 DMC청구 얘기네요.
// 수색동 DMC청구는 주차 걱정 전혀 없고… 엉터리 수근수근이네, 수정해라."
// 네이버 검색은 단지명만으로 돌기 때문에 동명 단지가 있으면 유명한 쪽 글이 섞인다.
//
// 규칙: "다른 구만 말하고 우리 구·동은 말하지 않는 글"만 버린다. 지역 언급이 없는 글은 남긴다 —
// 모르는 것까지 버리면 글이 몇 개 없는 소규모·임대 단지는 요약 자체가 사라진다.

const SEOUL_GU = [
  '종로구', '중구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '성북구', '강북구', '도봉구',
  '노원구', '은평구', '서대문구', '마포구', '양천구', '강서구', '구로구', '금천구', '영등포구', '동작구',
  '관악구', '서초구', '강남구', '송파구', '강동구',
]
// 짧은 이름('마포', '은평')으로도 찾되, 일반 단어와 겹치는 것은 제외한다.
// '중'(중간·중층), '강서'·'강동'·'강북'·'강남'(한강 서쪽 등 서술), '성북'·'성동'은 단지명·문장에 흔하다.
const NO_SHORT = new Set(['중구', '강서구', '강동구', '강북구', '성동구', '성북구', '동작구', '구로구'])

const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '')

function guTokens(gu) {
  const short = gu.replace(/구$/, '')
  return NO_SHORT.has(gu) || short.length < 2 ? [gu] : [gu, short]
}

/**
 * @param {Array<{title?:string, description?:string}>} items
 * @param {{aptName?:string, gu?:string, dong?:string}} ctx
 */
export function filterRelevant(items, { aptName, gu, dong } = {}) {
  if (!Array.isArray(items)) return []
  if (!gu || !SEOUL_GU.includes(gu)) return items

  const name = strip(aptName)
  // 단지명에서 '아파트' 꼬리를 뗀 형태도 지운다 ("DMC청구아파트" ↔ "DMC청구").
  const nameCore = name.replace(/아파트$/, '')
  const ours = [...guTokens(gu), dong, dong && dong.replace(/동$/, '').length >= 2 ? dong.replace(/동$/, '') : null].filter(Boolean)
  const others = SEOUL_GU.filter(g => g !== gu).flatMap(guTokens)

  return items.filter(it => {
    let text = strip(`${it.title || ''} ${it.description || ''}`)
    const mentionsOurs = ours.some(t => text.includes(t))
    if (mentionsOurs) return true
    // 단지명 속 지명은 "다른 구 언급"이 아니다.
    if (name) text = text.split(name).join('')
    if (nameCore && nameCore !== name) text = text.split(nameCore).join('')
    return !others.some(t => text.includes(t))
  })
}
