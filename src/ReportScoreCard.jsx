// 5축 점수 카드 — 시각화 옵션 A (종합 점수 + 5축 막대)
// props: summaryText — Claude 응답의 [요약] 섹션 raw 텍스트

const AXIS_LABELS = [
  { key: '입지',   weight: 30, color: '#22c55e' },
  { key: '상품',   weight: 20, color: '#f97316' },
  { key: '호재',   weight: 20, color: '#22c55e' },
  { key: '유동성', weight: 15, color: '#f97316' },
  { key: '실거주', weight: 15, color: '#22c55e' },
]

// "입지: 8.5 / 상품: 5.8 / 호재: 7.3 / 유동성: 5.5 / 실거주: 7.2" 형식 파싱
function parseAxisScores(text) {
  const scores = {}
  for (const { key } of AXIS_LABELS) {
    const m = text.match(new RegExp(`${key}\\s*[:：]\\s*(\\d+(?:\\.\\d+)?)`))
    if (m) scores[key] = parseFloat(m[1])
  }
  return scores
}

// 종합 점수: "종합 점수: 70점" 형식 파싱
function parseTotalScore(text) {
  const m = text.match(/종합\s*점수\s*[:：]\s*(\d+(?:\.\d+)?)\s*점?/)
  if (m) return parseFloat(m[1])
  // fallback: 가중 합 계산
  return null
}

function parseGrade(text) {
  const m = text.match(/등급\s*[:：]\s*([^\n]+)/)
  return m ? m[1].trim() : ''
}

function calcTotalFromAxes(scores) {
  let total = 0
  for (const { key, weight } of AXIS_LABELS) {
    total += (scores[key] || 0) * weight / 100  // weight는 % 단위
  }
  return total * 10  // 0~10 점수 × 10 = 100점 환산
}

export default function ReportScoreCard({ summaryText }) {
  if (!summaryText) return null
  const scores = parseAxisScores(summaryText)
  const total = parseTotalScore(summaryText) ?? Math.round(calcTotalFromAxes(scores))
  const grade = parseGrade(summaryText)

  return (
    <div className="report-score-card">
      <div className="report-score-header">
        <span className="report-score-total">{Math.round(total)}</span>
        <span className="report-score-unit">/ 100점</span>
        {grade && <span className="report-score-grade">{grade}</span>}
      </div>
      <div className="report-score-axes">
        {AXIS_LABELS.map(({ key, weight, color }) => {
          const v = scores[key] || 0
          return (
            <div key={key} className="report-score-axis">
              <span className="report-score-axis-label">{key}</span>
              <div className="report-score-axis-bar">
                <div
                  className="report-score-axis-bar-fill"
                  style={{ width: `${(v / 10) * 100}%`, background: color }}
                />
              </div>
              <span className="report-score-axis-value">{v.toFixed(1)}</span>
              <span className="report-score-axis-weight">{weight}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
