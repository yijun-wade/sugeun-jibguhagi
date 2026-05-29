export const SECTION_LABELS = [
  '정체성', '요약', '입지', '상품성', '수요층', '주변비교',
  '시나리오', '자산변화', '징검다리', '전략', '매도리스크', '결론',
]

// vibe.js와 동일한 대괄호 라벨 파싱 패턴
// 각 [라벨] 부터 다음 [라벨] 또는 문서 끝까지를 컨텐츠로 추출
export function parseReportSections(text) {
  const result = {}
  for (const label of SECTION_LABELS) {
    const regex = new RegExp(`\\[${label}\\]([\\s\\S]*?)(?=\\[(?:${SECTION_LABELS.join('|')})\\]|$)`)
    const match = (text || '').match(regex)
    result[label] = match ? match[1].trim() : ''
  }
  return result
}
