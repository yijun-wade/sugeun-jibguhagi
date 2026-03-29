// src/EvalCard.jsx
import { fP, snippetText } from './utils.js'

function isValidUrl(url) {
  try { const { protocol } = new URL(url); return protocol === 'http:' || protocol === 'https:' }
  catch { return false }
}

const DIRECTION_COLOR = {
  '↑ 상승세': '#D64A3A',
  '→ 보합':   '#6b7280',
  '↓ 하락세': '#2563eb',
}

export default function EvalCard({ apt, onDetail }) {
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

      {/* 가격 판단 — 절대 신호(가격대) + 상대 신호(거래 흐름) */}
      {apt.priceJudgment?.sentence ? (
        <div className="eval-price-judgment">{apt.priceJudgment.sentence}</div>
      ) : apt.recentAvg > 0 ? (
        <div className="eval-price-row">
          <span className="eval-price-avg">💰 최근 평균 <strong>{fP(apt.recentAvg)}</strong></span>
          <span style={{ color: dirColor, marginLeft: 6 }}>{apt.direction}</span>
        </div>
      ) : null}

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
      {apt.voice?.link && isValidUrl(apt.voice.link) && (apt.voice.description || apt.voice.title) && (
        <a className="eval-voice" href={apt.voice.link} target="_blank" rel="noopener noreferrer">
          🗣 "{snippetText(apt.voice.description || apt.voice.title)}"
        </a>
      )}

      {/* CTA */}
      <button className="eval-detail-btn" onClick={onDetail}>
        자세히 보기 →
      </button>
    </div>
  )
}
