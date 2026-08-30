// src/EvalCard.jsx
import { fP, snippetText } from './utils.js'
import { isCollected, toggleCollection } from './collection.js'
import { track } from './analytics.js'
import { useState } from 'react'

function isValidUrl(url) {
  try { const { protocol } = new URL(url); return protocol === 'http:' || protocol === 'https:' }
  catch { return false }
}

const DIRECTION_COLOR = {
  '↑ 상승세': '#D64A3A',
  '→ 보합':   '#6b7280',
  '↓ 하락세': '#2563eb',
}

export default function EvalCard({ apt, onDetail, onCollectionChange }) {
  const [collected, setCollected] = useState(() => isCollected(apt.kaptCode))
  const dirColor = DIRECTION_COLOR[apt.direction] || '#6b7280'

  function handleCollect(e) {
    e.stopPropagation()
    const next = toggleCollection(apt)
    const saving = !collected
    setCollected(saving)
    // from을 반드시 함께 보낸다. 상세 페이지도 같은 이벤트를 쏘는데 이게 없으면
    // 목록에서 저장한 건지 상세에서 저장한 건지 구분이 안 되고, 목록 카드 카피를
    // 바꿔도 효과를 잴 수 없다.
    track(saving ? 'collect_save' : 'collect_remove', { apt_name: apt.aptNm, region: apt.regionName, from: 'result_card' })
    onCollectionChange?.(next)
  }

  return (
    <div className="eval-card">
      {/* 헤더 */}
      <div className="eval-header">
        <div>
          <div className="eval-name">{apt.aptNm}</div>
          <div className="eval-loc">{apt.dong} · {apt.regionName} · {apt.buildYear}년식</div>
        </div>
        <button className={`eval-collect-btn${collected ? ' collected' : ''}`} onClick={handleCollect} aria-label={collected ? `${apt.aptNm} 저장 취소` : `${apt.aptNm} 저장`}>
          {collected ? '✓ 저장됨' : '★ 저장'}
        </button>
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
      {(() => {
        const lc = apt.lifeConditions
        if (!lc || (!lc.mobility && !lc.infra && !lc.risk)) return null
        return (
          <div className="eval-life">
            {lc.mobility && (
              <div className="eval-life-row">
                <span className="eval-life-label">이동</span>
                <span>{lc.mobility}</span>
              </div>
            )}
            {lc.infra && (
              <div className="eval-life-row">
                <span className="eval-life-label">생활</span>
                <span>{lc.infra}</span>
              </div>
            )}
            {lc.risk && (
              <div className="eval-life-row eval-life-row--risk">
                <span className="eval-life-label">주의</span>
                <span>{lc.risk}</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* CTA */}
      {/* 검색 → 상세는 이 제품의 핵심 퍼널 한 칸인데 계측이 없었다.
          page_view(apt_detail)로는 대신할 수 없다 — 유입의 95%가 네이버에서
          상세로 바로 착지해서, 검색으로 들어온 사람과 뒤섞여 구분이 안 된다. */}
      <button
        className="eval-detail-btn"
        onClick={() => { track('result_detail_click', { apt_name: apt.aptNm, region: apt.regionName, collected }); onDetail?.() }}
      >
        실거래 · 동네 후기 확인하기 →
      </button>
    </div>
  )
}
