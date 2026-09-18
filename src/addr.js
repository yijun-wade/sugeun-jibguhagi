// 주소 → { sido, gu, dong }. api/_addr.js와 동일 로직(서버·클라이언트 미러).
//
// 전에는 호출부마다 `find(p => p.endsWith('구') || p.endsWith('시') || ...)`로 뽑았는데,
// '서울특별시'가 '시'로 끝나 먼저 걸렸다. 서울 단지의 구가 전부 '서울특별시'가 되어
// 유사단지의 "같은 구 우선", 동네 구독의 gu, apt_view.region이 모두 틀려 있었다.
// 구 → 군 → 시 순으로 찾고, 시·도는 후보에서 뺀다.
const SIDO = /(특별시|광역시|특별자치시|특별자치도|도)$/

export function parseAddr(addr) {
  const parts = String(addr || '').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { sido: '', gu: '', dong: '' }

  const sido = SIDO.test(parts[0]) ? parts[0] : ''
  const rest = sido ? parts.slice(1) : parts

  const gu =
    rest.find(p => p.endsWith('구')) ||
    rest.find(p => p.endsWith('군')) ||
    rest.find(p => p.endsWith('시')) ||
    sido // 세종처럼 시·도 아래 구가 없는 경우

  // 구 이름 자체가 '동'으로 끝나지는 않지만(강동구는 '구'로 끝남), 구를 먼저 빼고 찾아 안전하게.
  const dong = rest.find(p => p !== gu && /^[^\d].*(동|읍|면|가)$/.test(p)) || ''

  return { sido, gu, dong }
}
