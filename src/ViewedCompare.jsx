// src/ViewedCompare.jsx — 최근 본 집 N-way 스냅샷 비교 모달 (실거래 fetch 없음)
import { useNavigate } from 'react-router-dom'
import { fP } from './utils.js'
import { buildDelta } from './collection-delta.js'
import { track } from './analytics.js'

const DIRECTION_COLOR = { '↑ 상승세': '#D64A3A', '→ 보합': '#6b7280', '↓ 하락세': '#2563eb' }

function daysAgo(ts) {
  if (!ts) return '-'
  const d = Math.floor((Date.now() - ts) / 86400000)
  return d <= 0 ? '오늘' : `${d}일 전`
}

// 저번 본 값(prevAvg) 대비 최신 값(avg) 변동. buildDelta 재활용.
function deltaLabel(apt) {
  if (!(Number(apt.prevAvg) > 0) || !(Number(apt.avg) > 0) || !apt.prevTs) return '-'
  const d = buildDelta({ recentAvg: apt.prevAvg, savedAt: new Date(apt.prevTs).toISOString() }, apt.avg)
  if (!d) return '-'
  if (d.level === 'fresh' || d.level === 'flat') return '변동 없음'
  return `${d.level === 'up' ? '▲' : '▼'}${fP(Math.abs(d.diff))}`
}

export default function ViewedCompare({ apts, onClose }) {
  const navigate = useNavigate()
  const list = (apts || []).slice(0, 5)
  if (list.length === 0) return null

  const go = (apt) => {
    track('compare_apt_click', { kapt_code: apt.kaptCode, apt_name: apt.aptNm })
    onClose()
    navigate(`/apt/${apt.kaptCode}`)
  }

  return (
    <div className="compare-overlay" onClick={onClose}>
      <div className="compare-sheet" onClick={e => e.stopPropagation()}>
        <div className="compare-top">
          <span className="compare-top-title">최근 본 집 비교</span>
          <button className="compare-close" onClick={onClose}>✕</button>
        </div>

        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-label-col"></th>
                {list.map((apt, i) => (
                  <th key={apt.kaptCode} className="compare-apt-col">
                    <button type="button" className="compare-apt-link" onClick={() => go(apt)}>
                      <span className="compare-apt-name">{apt.aptNm}{i === 0 ? ' · 이 집' : ''}</span>
                      <span className="compare-apt-loc">{apt.dong}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="compare-row-label">값</td>
                {list.map(apt => (
                  <td key={apt.kaptCode} className="compare-row-val">{Number(apt.avg) > 0 ? fP(apt.avg) : '-'}</td>
                ))}
              </tr>
              <tr>
                <td className="compare-row-label">시세</td>
                {list.map(apt => (
                  <td key={apt.kaptCode} className="compare-row-val"
                    style={apt.direction ? { color: DIRECTION_COLOR[apt.direction] || '#6b7280', fontWeight: 600 } : {}}>
                    {apt.direction || '-'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="compare-row-label">살만함</td>
                {list.map(apt => (
                  <td key={apt.kaptCode} className="compare-row-val compare-verdict">
                    {apt.verdict && apt.verdict !== '실거래 데이터 없음' ? apt.verdict : '-'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="compare-row-label">본 시점</td>
                {list.map(apt => (
                  <td key={apt.kaptCode} className="compare-row-val">{daysAgo(apt.ts)}</td>
                ))}
              </tr>
              <tr>
                <td className="compare-row-label">저번 본 뒤</td>
                {list.map(apt => (
                  <td key={apt.kaptCode} className="compare-row-val">{deltaLabel(apt)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="compare-disclaimer">본 시점 기준 값이에요. 최신 시세는 단지를 다시 열어보세요.</p>
      </div>
    </div>
  )
}
