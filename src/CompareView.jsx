import { useState, useEffect } from 'react'
import { fP, getYM, nameSim } from './utils.js'
import { MIN_AREA_SQM } from './constants.js'

const COLORS = ['#2563eb', '#ea580c']

const DIRECTION_COLOR = {
  '↑ 상승세': '#D64A3A',
  '→ 보합':   '#6b7280',
  '↓ 하락세': '#2563eb',
}

const ROWS = [
  { key: 'loc',       label: '위치' },
  { key: 'buildYear', label: '준공' },
  { key: 'recentAvg', label: '평당가' },
  { key: 'direction', label: '시세' },
]

function getCell(apt, key) {
  switch (key) {
    case 'loc':       return `${apt.dong} · ${apt.regionName}`
    case 'buildYear': return apt.buildYear && apt.buildYear !== '-' ? `${apt.buildYear}년` : '-'
    case 'recentAvg': return apt.recentAvg > 0 ? fP(apt.recentAvg) : '정보없음'
    case 'direction': return apt.direction || '-'
    default:          return '-'
  }
}

function useTrades(apt) {
  const [monthly, setMonthly] = useState(null)

  useEffect(() => {
    if (!apt?.bjdCode) { setMonthly([]); return }
    const lawdCd = apt.bjdCode.slice(0, 5)
    const ymList = getYM(6)
    const byMonth = {}
    ymList.forEach(ym => { byMonth[ym] = [] })

    Promise.all(
      ymList.map(ym =>
        fetch(`/api/trade?lawdCd=${lawdCd}&dealYmd=${ym}`)
          .then(r => r.json()).catch(() => null)
      )
    ).then(results => {
      results.forEach((data, i) => {
        if (!data) return
        if (!['00', '000'].includes(data?.response?.header?.resultCode)) return
        const items = data?.response?.body?.items?.item
        if (!items) return
        const arr = Array.isArray(items) ? items : [items]
        arr.forEach(item => {
          const nm = (item.aptNm || '').trim()
          const amt = parseInt((item.dealAmount || '').replace(/,/g, ''), 10)
          const area = parseFloat(item.excluUseAr) || 0
          if (nameSim(nm, apt.aptNm) < 0.6 || isNaN(amt) || area < MIN_AREA_SQM) return
          byMonth[ymList[i]].push(amt)
        })
      })
      setMonthly(ymList.map(ym => {
        const arr = byMonth[ym]
        return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null
      }))
    })
  }, [apt?.kaptCode])

  return monthly
}

function normalize(avgs) {
  const base = avgs.find(v => v !== null)
  if (!base) return avgs.map(() => null)
  return avgs.map(v => v !== null ? +((v - base) / base * 100).toFixed(1) : null)
}

function PriceCompareChart({ series, labels, ymList }) {
  const W = 300, H = 130
  const PAD = { t: 14, r: 12, b: 28, l: 38 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const n = ymList.length

  const allVals = series.flatMap(s => s.filter(v => v !== null))
  if (allVals.length === 0) return <div className="compare-chart-empty">거래 데이터 없음</div>

  const minV = Math.min(...allVals, -2)
  const maxV = Math.max(...allVals, 2)
  const range = maxV - minV || 4

  const toX = i => PAD.l + (i / (n - 1)) * plotW
  const toY = v => PAD.t + plotH - ((v - minV) / range) * plotH

  const zeroY = toY(0)

  const monthLabel = ym => {
    const m = parseInt(ym.slice(4))
    return `${m}월`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="compare-chart-svg">
      {/* 0% 기준선 */}
      <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY}
        stroke="#e4eaf4" strokeWidth="1" strokeDasharray="3,3" />

      {/* Y축 레이블 */}
      {[minV, 0, maxV].map((v, i) => (
        <text key={i} x={PAD.l - 5} y={toY(v) + 4}
          textAnchor="end" fontSize="9" fill="#9ca3af">
          {v > 0 ? `+${v.toFixed(0)}` : v.toFixed(0)}%
        </text>
      ))}

      {/* X축 월 레이블 */}
      {ymList.map((ym, i) => (
        <text key={ym} x={toX(i)} y={H - 6}
          textAnchor="middle" fontSize="9" fill="#9ca3af">
          {monthLabel(ym)}
        </text>
      ))}

      {/* 라인 + 도트 */}
      {series.map((vals, si) => {
        const points = vals
          .map((v, i) => v !== null ? `${toX(i)},${toY(v)}` : null)
          .filter(Boolean)
        const connected = []
        let seg = []
        vals.forEach((v, i) => {
          if (v !== null) { seg.push(`${toX(i)},${toY(v)}`) }
          else if (seg.length) { connected.push(seg.join(' ')); seg = [] }
        })
        if (seg.length) connected.push(seg.join(' '))

        return (
          <g key={si}>
            {connected.map((pts, pi) => (
              <polyline key={pi} points={pts}
                fill="none" stroke={COLORS[si]} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {vals.map((v, i) => v !== null && (
              <circle key={i} cx={toX(i)} cy={toY(v)} r="3"
                fill="#fff" stroke={COLORS[si]} strokeWidth="2" />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export default function CompareView({ apts, onClose }) {
  const ymList = getYM(6)
  const trades0 = useTrades(apts[0])
  const trades1 = useTrades(apts[1])

  const series = [
    trades0 ? normalize(trades0) : null,
    trades1 ? normalize(trades1) : null,
  ]
  const chartReady = series[0] && series[1]

  return (
    <div className="compare-overlay">
      <div className="compare-sheet">
        <div className="compare-top">
          <span className="compare-top-title">단지 비교</span>
          <button className="compare-close" onClick={onClose}>✕</button>
        </div>

        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-label-col"></th>
                {apts.map((apt, i) => (
                  <th key={apt.kaptCode} className="compare-apt-col">
                    <div className="compare-apt-name" style={{ color: COLORS[i] }}>{apt.aptNm}</div>
                    <div className="compare-apt-loc">{apt.regionName}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => (
                <tr key={row.key}>
                  <td className="compare-row-label">{row.label}</td>
                  {apts.map(apt => {
                    const val = getCell(apt, row.key)
                    const color = row.key === 'direction' ? (DIRECTION_COLOR[val] || '#6b7280') : undefined
                    return (
                      <td key={apt.kaptCode} className="compare-row-val" style={color ? { color, fontWeight: 600 } : {}}>
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 가격 추이 비교 차트 */}
        <div className="compare-chart-section">
          <div className="compare-chart-header">
            <span className="compare-chart-title">6개월 실거래가 등락률 비교</span>
            <div className="compare-chart-legend">
              {apts.map((apt, i) => (
                <span key={apt.kaptCode} className="compare-legend-item">
                  <span className="compare-legend-dot" style={{ background: COLORS[i] }} />
                  {apt.aptNm}
                </span>
              ))}
            </div>
          </div>
          {!chartReady
            ? <div className="compare-chart-loading">시세 데이터 불러오는 중...</div>
            : <PriceCompareChart series={series} labels={apts.map(a => a.aptNm)} ymList={ymList} />
          }
          <p className="compare-chart-note">첫 거래 시점 기준 등락률. 거래 없는 달은 표시 안 돼요.</p>
        </div>

        <p className="compare-disclaimer">저장 시점 기준 데이터예요. 최신 시세는 단지를 다시 검색해주세요.</p>
      </div>
    </div>
  )
}
