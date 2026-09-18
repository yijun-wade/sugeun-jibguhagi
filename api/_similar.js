// 비슷한 가격대 단지 매칭 (순수 함수) — apt-discovery.json 기반
import { isRentalName } from './_apt-type.js'
// 기준가(anchorAvg, 만원)에 가장 가까운 단지를, 같은 구를 우선해 정렬한다.

const SLIM = a => ({
  code: a.code,
  name: a.name,
  gu: a.gu,
  dong: a.dong,
  avg: a.avg,
  perPy: a.perPy,
  year: a.year,
  units: a.units,
})

const hasAvg = a => Number.isFinite(a?.avg) && a.avg > 0

/**
 * @param {Array} list  apt-discovery.json 레코드 배열 ({code,name,gu,dong,avg,perPy,units,year})
 * @param {{kaptCode?:string, avg?:number, gu?:string}} anchor  현재 단지 기준
 * @param {number} limit  반환 개수 (기본 6)
 * @returns {Array} 슬림 레코드 배열
 */
export function pickSimilarApts(list, anchor = {}, limit = 6) {
  if (!Array.isArray(list) || list.length === 0) return []

  const self = anchor.kaptCode ? list.find(a => a.code === anchor.kaptCode) : null

  const anchorAvg = (Number.isFinite(anchor.avg) && anchor.avg > 0)
    ? anchor.avg
    : (hasAvg(self) ? self.avg : 0)
  const anchorGu = anchor.gu || self?.gu || null

  const candidates = list.filter(a => a.code !== anchor.kaptCode)

  // 기준가가 있으면 가격 근접순, 같은 구 우선
  if (anchorAvg > 0) {
    const priced = candidates.filter(hasAvg)
    const byPrice = (x, y) => Math.abs(x.avg - anchorAvg) - Math.abs(y.avg - anchorAvg)
    const sameGu = priced.filter(a => a.gu === anchorGu).sort(byPrice)
    const otherGu = priced.filter(a => a.gu !== anchorGu).sort(byPrice)
    return [...sameGu, ...otherGu].slice(0, limit).map(SLIM)
  }

  // 기준가가 없으면(시세 데이터 없음) 같은 구 세대수 많은 순으로 폴백
  const byUnits = (x, y) => (y.units || 0) - (x.units || 0)
  const sameGu = candidates.filter(a => a.gu === anchorGu).sort(byUnits)
  const otherGu = candidates.filter(a => a.gu !== anchorGu).sort(byUnits)
  return [...sameGu, ...otherGu].slice(0, limit).map(SLIM)
}

// ── 임대 단지용 ─────────────────────────────────────────────────────────────
// 실거래가 없는 공공임대·청년주택에 "비슷한 값 단지"를 붙이면 세대수 큰 순 폴백을 타서
// 행복주택 페이지에 올림픽파크포레온(30억)·디에이치(77억)가 나갔다. 임대를 보러 온 사람에게
// 의미 있는 다음 페이지는 "같은 구의 다른 임대 단지"다.

/**
 * @param {Array} seoulList  seoul-apt-enriched.json ({kaptCode,kaptName,sigungu,dong,kaptdaCnt,useAprDay})
 * @param {Object} types     apt-types.json ({kaptCode: 'rental'|'mixed'})
 * @param {{kaptCode?:string, gu?:string}} anchor
 */
export function pickSameTypeApts(seoulList, types = {}, anchor = {}, limit = 6) {
  if (!Array.isArray(seoulList) || seoulList.length === 0) return []
  const isRental = a => types[a.kaptCode] === 'rental' || (!types[a.kaptCode] && isRentalName(a.kaptName))
  const byUnits = (x, y) => (y.kaptdaCnt || 0) - (x.kaptdaCnt || 0)
  const rentals = seoulList.filter(a => a.kaptCode !== anchor.kaptCode && isRental(a))
  const sameGu = rentals.filter(a => a.sigungu === anchor.gu).sort(byUnits)
  const otherGu = rentals.filter(a => a.sigungu !== anchor.gu).sort(byUnits)
  return [...sameGu, ...otherGu].slice(0, limit).map(a => ({
    code: a.kaptCode,
    name: a.kaptName,
    gu: a.sigungu,
    dong: a.dong,
    avg: 0,
    perPy: 0,
    year: a.useAprDay ? String(a.useAprDay).slice(0, 4) : '',
    units: a.kaptdaCnt || 0,
    rental: true,
  }))
}
