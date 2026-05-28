// 만원 → 억 표시 (예: 50000 → "5.0억", 53500 → "5.35억")
function manwonToEok(manwon) {
  return (manwon / 10000).toFixed(2).replace(/\.?0+$/, '') + '억'
}

function formatScenarioMatrix(matrix) {
  const labels = {
    conservative: '보수',
    base:         '기준',
    optimistic:   '낙관',
    overheated:   '과열',
  }
  const lines = []
  for (const [key, label] of Object.entries(labels)) {
    const m = matrix[key]
    lines.push(
      `${label}: 3년 후 ${manwonToEok(m['3y'].low)}~${manwonToEok(m['3y'].high)}, ` +
      `5년 후 ${manwonToEok(m['5y'].low)}~${manwonToEok(m['5y'].high)}`
    )
  }
  return lines.join('\n')
}

function formatNearbyApts(apts) {
  if (!apts || apts.length === 0) return '주변 비교 단지 정보 없음'
  return apts.map(a =>
    `${a.name}: 평균 ${manwonToEok(a.avgPrice)}, 평당 ${manwonToEok(a.perPy)}, ${a.units}세대`
  ).join('\n')
}

function formatRecentTrades(trades) {
  if (!trades || trades.length === 0) return '최근 실거래 데이터 없음'
  return trades.slice(0, 5).map(t =>
    `${t.dealYmd.slice(0,4)}-${t.dealYmd.slice(4,6)}: ${manwonToEok(t.amount)} (전용 ${t.area}㎡)`
  ).join('\n')
}

const SYSTEM_PROMPT = `당신은 부동산 시나리오 분석 컨설턴트입니다.
아래 단지 정보와 사용자 입력을 바탕으로 12 섹션 보고서를 작성해주세요.

[톤 규칙]
- 정중한 보고서체: "~로 보입니다", "~가 합리적입니다", "~가 핵심입니다"
- 단정적 표현 자제, "~할 수 있습니다", "~로 판단됩니다"
- 어려운 용어 사용 시 짧은 부연 (예: "징검다리 — 다음 단계 자산으로 이동하기 위한 중간 자산")
- 이모지 사용 금지
- "~대요/~래요" 같은 귓속말 톤 금지 — 컨설팅 보고서 톤 유지`

function buildUserPrompt(ctx) {
  const { apt, location, nearbyApts, recentTrades, userInput, scenarioMatrix } = ctx

  return `[단지 정보]
이름: ${apt.name}
주소: ${apt.address}
입주: ${apt.completionYear}년
세대수: ${apt.totalUnits}
평형: 공급 ${apt.supplyArea}㎡ / 전용 ${apt.exclusiveArea}㎡
구조: 방 ${apt.roomCount}개 / 욕실 ${apt.bathroomCount}개

[입지]
가장 가까운 역: ${location.nearestStation} (${location.stationLine}) 도보 ${location.walkingMinutes}분
주요 업무지구: ${location.businessAreas.join(', ')}
주변 인프라: ${location.amenities.join(', ')}

[주변 비교 단지]
${formatNearbyApts(nearbyApts)}

[최근 실거래 추세]
${formatRecentTrades(recentTrades)}

[사용자 입력]
현재 매가: ${manwonToEok(userInput.priceManwon)}
보유 기간: ${userInput.years}년
추가 저축 가능: ${manwonToEok(userInput.savingsManwon)}

[계산된 시나리오 가격 — 결정론적]
${formatScenarioMatrix(scenarioMatrix)}

[출력 형식]
반드시 아래 12 섹션을 [라벨] 형식으로 출력하세요. 라벨 외부 텍스트는 작성하지 마세요.

[정체성]
한 줄로 이 매물의 자산 성격을 정의 (예: "여의휴젠느는 서울 핵심 업무지구 옆에 5억 전후로 진입하는 소형 실거주 자산입니다.")

[요약]
종합 점수: XX점 (0~100)
등급: (예: "실거주 중심 보유 가능")
입지: X.X / 상품: X.X / 호재: X.X / 유동성: X.X / 실거주: X.X (각 0~10)
각 점수의 근거를 한 줄씩

[입지]
교통 (1~2줄)
생활 인프라 (1~2줄)
업무지구 접근성 (1~2줄)

[상품성]
장점 (3~5개, 각 한 줄)
단점 (3~5개, 각 한 줄)
구조 체감 (전용면적 기준 방·거실 체감)

[수요층]
잘 맞는 사람 (4~6개 페르소나)
잘 맞지 않는 사람 (3~5개 페르소나)

[주변비교]
주변 단지 대비 이 매물의 위치를 한 단락으로 설명. 가격이 낮은/높은 이유를 명시.

[시나리오]
4시나리오 각각에 대해:
- 조건 한 줄
- 5년 후 가격 인용
- 한 줄 해석
보수/기준/낙관/과열 순서로 4단락.

[자산변화]
5년 후 가격 시나리오 × 추가 저축(${manwonToEok(userInput.savingsManwon)})을 결합한 총 자본 증가 표를 텍스트로 작성.
시나리오별 판단 ("효과 약함" ~ "매우 우수").

[징검다리]
이 매물이 다음 자산으로 가는 징검다리로서의 장점·한계.
시점별 성공 기준 가격 (3년/5년) 표.

[전략]
1년 차: 실거주 안정화 + 하자 점검 체크리스트
2~3년 차: 시장 추종 여부 확인 지표
4~5년 차: 갈아타기 판단 기준 + 다음 목표 자산

[매도리스크]
매도 시점·가격 기준 (2~3줄)
핵심 리스크 3가지 + 대응 방안

[결론]
한 줄로 의사결정 권장 ("이 매물은 ~로 보입니다. ~가 합리적입니다.")`
}

export function buildReportPrompt(ctx) {
  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(ctx),
  }
}
