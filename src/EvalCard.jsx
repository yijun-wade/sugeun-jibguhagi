// src/EvalCard.jsx
import { fP } from './utils.js'

function isValidUrl(url) {
  try { const { protocol } = new URL(url); return protocol === 'http:' || protocol === 'https:' }
  catch { return false }
}

const PRICE_LABEL_COLOR = {
  '비쌈':  { bg: '#fff1f0', color: '#D64A3A' },
  '적정':  { bg: '#fffbeb', color: '#d97706' },
  '저렴':  { bg: '#f0fdf4', color: '#16a34a' },
}

const DIRECTION_COLOR = {
  '↑ 상승세': '#D64A3A',
  '→ 보합':   '#6b7280',
  '↓ 하락세': '#2563eb',
}

export default function EvalCard({ apt, onDetail }) {
  const labelStyle = PRICE_LABEL_COLOR[apt.priceLabel] || {}
  const dirColor   = DIRECTION_COLOR[apt.direction] || '#6b7280'

  return (
    <div className="eval-card">
      {/* 헤더 */}
      <div className="eval-header">
        <div>
          <div className="eval-name">{apt.aptNm}</div>
          <div className="eval-loc">{apt.dong} · {apt.regionName} · {apt.buildYear}년식</div>
        </div>
      </div>

      {/* 한줄 판단 */}
      <div className="eval-verdict">💬 {apt.verdict}</div>

      {/* 가격 신호 */}
      <div className="eval-price-row">
        <div className="eval-price-avg">
          💰 최근 3개월 평균 <strong>{fP(apt.recentAvg)}</strong>
          <span style={{ color: dirColor, marginLeft: 6 }}>{apt.direction}</span>
        </div>
        <div
          className="eval-price-label"
          style={{ background: labelStyle.bg, color: labelStyle.color }}
        >
          {apt.priceLabel}
        </div>
      </div>

      {/* 생활 여건 */}
      {apt.lifeConditions.length > 0 && (
        <div className="eval-life">
          {apt.lifeConditions.map((item, i) => (
            <div key={i} className="eval-life-row">
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 실거주 한마디 */}
      {apt.voice?.link && isValidUrl(apt.voice.link) && (
        <a className="eval-voice" href={apt.voice.link} target="_blank" rel="noopener noreferrer">
          🗣 "{apt.voice.description?.slice(0, 50) || apt.voice.title?.slice(0, 40)}"
        </a>
      )}

      {/* CTA */}
      <button className="eval-detail-btn" onClick={onDetail}>
        자세히 보기 →
      </button>
    </div>
  )
}
