// 수집 단지 비교 화면
import { fP } from './utils.js'

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
    case 'loc':
      return `${apt.dong} · ${apt.regionName}`
    case 'buildYear':
      return apt.buildYear && apt.buildYear !== '-' ? `${apt.buildYear}년` : '-'
    case 'recentAvg':
      return apt.recentAvg > 0 ? fP(apt.recentAvg) : '정보없음'
    case 'direction':
      return apt.direction || '-'
    default:
      return '-'
  }
}

export default function CompareView({ apts, onClose }) {
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
                {apts.map(apt => (
                  <th key={apt.kaptCode} className="compare-apt-col">
                    <div className="compare-apt-name">{apt.aptNm}</div>
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

        <p className="compare-disclaimer">저장 시점 기준 데이터예요. 최신 시세는 단지를 다시 검색해주세요.</p>
      </div>
    </div>
  )
}
