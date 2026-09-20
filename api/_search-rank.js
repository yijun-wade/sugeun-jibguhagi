// 검색 결과 순위 (순수 함수)
//
// 전에는 이름 점수에 수도권 가산점 +1을 더해 한 숫자로 비볐다. 그래서 '헬리오시티'를 치면
// 부천 '헬리오시티'(정확일치 5)와 서울 '헬리오시티아파트'(포함 4 + 수도권 1 = 5)가 동점이 되고,
// 세대수 비교로 넘어가기 전에 배열 순서로 부천이 1위를 먹었다. 9,510세대 송파 단지를 찾는
// 사람에게 300세대 부천 단지를 먼저 보여준 셈이다.
//
// 가산점을 점수에 섞지 않고 정렬 키를 나눈다: 이름 매칭 여부 → 서울 → 수도권 → 정확도 → 세대수.
// 서울을 위로 올리는 건 임의 편향이 아니라 데이터다 — 사이트맵도 서울만 올리고, 상세에 붙일
// 살(세대수·요약)이 서울만 있으며, 실제 방문자의 사실상 전부가 서울 단지를 본다.

// addr에서 동/구/시 단위 추출 — "경기도 광명시 철산동" → ["광명시", "철산동"]
export function extractAdminUnits(addr) {
  return (addr || '').split(' ').filter(part =>
    part.endsWith('동') || part.endsWith('구') || part.endsWith('시') ||
    part.endsWith('군') || part.endsWith('읍') || part.endsWith('면')
  )
}

/**
 * 매칭 종류와 정확도.
 * 전에는 둘을 한 숫자로 섞어, 주소의 동 이름 매칭(3.5)이 단지명 부분일치(3)보다 높았다.
 * @returns {{kind:'name'|'addr'|null, score:number}}
 */
export function matchScore(apt, query) {
  const nm = apt.kaptName || ''
  const addr = apt.addr || ''
  const normalQ = query.replace(/\s+/g, '')
  const nmNorm = nm.replace(/\s+/g, '')
  const aliases = apt.aliases || []

  if (nm === query) return { kind: 'name', score: 5 }
  if (aliases.some(a => a === normalQ)) return { kind: 'name', score: 4.5 }
  if (nm.includes(query)) return { kind: 'name', score: 4 }
  if (nmNorm.includes(normalQ)) return { kind: 'name', score: 3 }
  if (aliases.some(a => a.includes(normalQ))) return { kind: 'name', score: 3 }

  const units = extractAdminUnits(addr)
  if (query.length >= 2 && units.some(u => u.startsWith(query))) return { kind: 'addr', score: 3.5 }
  if (query.length >= 2 && units.some(u => u.includes(query) || query.includes(u))) return { kind: 'addr', score: 2.5 }
  if (addr.includes(query)) return { kind: 'addr', score: 2 }
  if (addr.replace(/\s+/g, '').includes(normalQ)) return { kind: 'addr', score: 1 }
  return { kind: null, score: 0 }
}

/**
 * @param {Array} list  단지 배열
 * @param {string} query
 * @param {(kaptCode:string)=>number} unitsOf  세대수 조회
 */
export function rankResults(list, query, unitsOf = () => 0) {
  return list
    .map(apt => ({ apt, ...matchScore(apt, query) }))
    .filter(m => m.kind)
    .sort((a, b) => {
      // 1차: 이름으로 맞았나, 주소로 맞았나. 이름 매칭이 주소 매칭보다 항상 앞이다.
      const byName = x => x.kind === 'name' ? 1 : 0
      if (byName(b) !== byName(a)) return byName(b) - byName(a)
      // 2차: 서울 → 3차: 수도권. 같은 이름이 여러 지역에 있으면 지역이 의도를 가른다
      //      ('헬리오시티' = 300세대 부천이 아니라 9,510세대 송파를 찾는 사람이다).
      const seoul = x => /^서울/.test(x.apt.addr || '') ? 1 : 0
      if (seoul(b) !== seoul(a)) return seoul(b) - seoul(a)
      const metro = x => /^(서울|경기|인천)/.test(x.apt.addr || '') ? 1 : 0
      if (metro(b) !== metro(a)) return metro(b) - metro(a)
      // 4차: 같은 지역 안에서는 정확일치가 부분일치보다 앞
      if (b.score !== a.score) return b.score - a.score
      // 5차: 세대수 → 6차: 가나다
      const cnt = x => unitsOf(x.apt.kaptCode) || 0
      if (cnt(b) !== cnt(a)) return cnt(b) - cnt(a)
      return (a.apt.kaptName || '').localeCompare(b.apt.kaptName || '', 'ko')
    })
    .map(m => m.apt)
}
