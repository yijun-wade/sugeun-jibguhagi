// 단지 유형 판별 — src/apt-type.js와 동일 로직(서버·클라이언트 미러).
//
// 왜 필요한가: 2026-09 Amplitude 실측에서 유입 상위 20개 단지 중 16개가 공공임대·행복주택·
// 청년안심주택이었다. 이 단지들은 실거래가 없는데 페이지는 "실거래 있는 분양 아파트"만
// 가정해, 행복주택 페이지에 77억 유사단지와 "거래 올라오면 알려드릴게요"가 나갔다.
//
// 1순위는 K-APT 기본정보의 분양형태(codeSaleNm: 임대·혼합·분양), 없으면 단지명 키워드.

const RENTAL_KEYWORDS = [
  '임대', '행복주택', '청년주택', '청년안심주택', '안심주택', '장기전세', '국민임대',
  '에스에이치', '서울주택도시공사',
]
// 영문 약어는 다른 상호(SK, SHERVILLE 등) 안에 섞이지 않도록 경계를 본다.
const RENTAL_ACRONYM = /(^|[^A-Za-z])(SH|LH)(?![A-Za-z])|SH-?VILLE/i

export function isRentalName(name) {
  const n = String(name || '')
  if (RENTAL_KEYWORDS.some(k => n.includes(k))) return true
  return RENTAL_ACRONYM.test(n)
}

/** @returns {'rental'|'mixed'|'sale'|'unknown'} */
export function classifyAptType({ name, codeSaleNm } = {}) {
  const code = String(codeSaleNm || '').trim()
  if (code === '임대') return 'rental'
  if (code === '혼합') return 'mixed'
  if (code === '분양') return 'sale'
  return isRentalName(name) ? 'rental' : 'unknown'
}
