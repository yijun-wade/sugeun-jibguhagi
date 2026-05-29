// 4시나리오 × 3년/5년 매트릭스 표 — 시각화 옵션 A
// props: scenarioMatrix (api/report.js 응답의 scenarioMatrix), narratives (시나리오 섹션 텍스트)

function formatRangeManwon(range) {
  // 5000만원 단위 표시; 5억대는 "5.5억" 형식
  const low  = (range.low / 10000)
  const high = (range.high / 10000)
  const fmt = (v) => v.toFixed(1).replace(/\.0$/, '')
  return `${fmt(low)}~${fmt(high)}`
}

const ROW_LABELS = {
  conservative: { ko: '보수', color: '#64748b' },
  base:         { ko: '기준', color: '#9a3412' },
  optimistic:   { ko: '낙관', color: '#15803d' },
  overheated:   { ko: '과열', color: '#991b1b' },
}

export default function ReportScenarioTable({ scenarioMatrix, narratives }) {
  if (!scenarioMatrix) return null

  return (
    <div className="report-scenario-table">
      <table>
        <thead>
          <tr>
            <th>시나리오</th>
            <th>3년 후</th>
            <th>5년 후</th>
            <th>조건</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(ROW_LABELS).map(([key, { ko, color }]) => {
            const m = scenarioMatrix[key]
            if (!m) return null
            const isBase = key === 'base'
            return (
              <tr key={key} className={isBase ? 'base-row' : ''} style={{ color }}>
                <td className="scenario-name">
                  {ko}{isBase && ' ★'}
                </td>
                <td className="scenario-cell">{formatRangeManwon(m['3y'])}</td>
                <td className="scenario-cell">{formatRangeManwon(m['5y'])}</td>
                <td className="scenario-condition">
                  {(narratives?.[key] || '').slice(0, 60)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="report-scenario-unit">단위: 억 · 기준 시나리오 강조</p>
    </div>
  )
}
