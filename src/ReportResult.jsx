import { useEffect } from 'react'
import ReportScenarioTable from './ReportScenarioTable.jsx'
import ReportScoreCard from './ReportScoreCard.jsx'
import { track } from './analytics.js'

// 시나리오 섹션 텍스트에서 시나리오별 narrative를 분리
// "보수: ... \n기준: ... \n낙관: ... \n과열: ..." 형식 기대
function parseScenarioNarratives(text) {
  const out = { conservative: '', base: '', optimistic: '', overheated: '' }
  const map = { '보수': 'conservative', '기준': 'base', '낙관': 'optimistic', '과열': 'overheated' }
  for (const [ko, key] of Object.entries(map)) {
    const m = text.match(new RegExp(`${ko}[:：](.*?)(?=(?:보수|기준|낙관|과열)[:：]|$)`, 's'))
    if (m) out[key] = m[1].trim()
  }
  return out
}

// 평범한 텍스트 섹션은 줄바꿈을 그대로 살려 표시
function TextSection({ title, body }) {
  if (!body) return null
  return (
    <section className="report-section">
      <h3 className="report-section-title">{title}</h3>
      <div className="report-section-body">
        {body.split('\n').map((line, i) =>
          line.trim() ? <p key={i}>{line}</p> : <br key={i} />
        )}
      </div>
    </section>
  )
}

export default function ReportResult({ data, onRegenerate, onBetaSignup }) {
  const { sections, scenarioMatrix, meta } = data
  const scenarioNarratives = parseScenarioNarratives(sections.시나리오 || '')

  // 섹션 노출 추적
  useEffect(() => {
    track('report_complete', {
      apt_name: meta.aptName,
      kapt_code: meta.kaptCode,
      price_manwon: meta.priceManwon,
      years: meta.years,
      savings_manwon: meta.savingsManwon,
      cache_hit: data.cacheHit,
    })
  }, [meta.kaptCode])

  return (
    <div className="report-result">
      {/* 1. 자산 정체성 */}
      <section className="report-identity">
        <p className="report-identity-text">{sections.정체성 || '정체성 분석을 불러올 수 없습니다.'}</p>
      </section>

      {/* 2. 요약 카드 (5축 점수) */}
      <ReportScoreCard summaryText={sections.요약} />

      {/* 3. 입지 */}
      <TextSection title="입지 분석" body={sections.입지} />

      {/* 4. 상품성 */}
      <TextSection title="상품성 분석" body={sections.상품성} />

      {/* 5. 수요층 */}
      <TextSection title="수요층 분석" body={sections.수요층} />

      {/* 6. 주변 비교 */}
      <TextSection title="주변 비교" body={sections.주변비교} />

      {/* 7. 4시나리오 매트릭스 */}
      <section className="report-section">
        <h3 className="report-section-title">가격 시나리오</h3>
        <ReportScenarioTable
          scenarioMatrix={scenarioMatrix}
          narratives={scenarioNarratives}
        />
      </section>

      {/* 8. 자산 변화 시뮬레이션 */}
      <TextSection title="자산 변화 시뮬레이션" body={sections.자산변화} />

      {/* 9. 징검다리 판단 */}
      <TextSection title="징검다리 판단" body={sections.징검다리} />

      {/* 10. 보유 전략 */}
      <TextSection title="보유 전략" body={sections.전략} />

      {/* 11. 매도 기준 + 리스크 */}
      <TextSection title="매도 기준 · 리스크" body={sections.매도리스크} />

      {/* 12. 최종 결론 */}
      <section className="report-conclusion">
        <h3 className="report-section-title">최종 결론</h3>
        <p className="report-conclusion-text">{sections.결론}</p>
      </section>

      {/* 액션 영역 */}
      <div className="report-actions">
        <button className="report-regenerate-btn" onClick={onRegenerate}>
          다시 생성
        </button>
        <button className="report-beta-btn" onClick={onBetaSignup}>
          더 자세한 풀 보고서가 필요하세요? (베타 신청)
        </button>
      </div>

      <p className="report-disclaimer">
        이 보고서는 AI가 단지 데이터·통계·방법론 수식을 결합해 생성한 의사결정 보조 자료입니다.
        실제 계약 시에는 등기부등본·건축물대장·관리비·하자 이력 등을 반드시 별도 확인하세요.
      </p>
    </div>
  )
}
