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
아래 단지 정보와 사용자 입력을 바탕으로 12 섹션 보고서를 작성합니다.

[분량 규칙 — 가장 중요]
- 전체 출력 4500 토큰 이내. 후반 섹션(징검다리/전략/매도리스크/결론) 잘리지 않도록 앞 섹션 압축 필수.
- 각 섹션 지정된 줄 수 엄수. 초과 금지.
- 불필요한 부연·예시·반복 금지. 핵심만 한 줄로.
- 마지막 [결론] 섹션은 반드시 출력 (가장 중요).

[톤 규칙]
- 정중한 보고서체: "~로 보입니다", "~가 합리적입니다"
- 단정적 표현 자제: "~할 수 있습니다", "~로 판단됩니다"
- 이모지 사용 금지
- "~대요/~래요" 귓속말 톤 금지`

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

[출력 형식 — 매우 중요]
반드시 아래 12 섹션을 [라벨] 형식으로 출력. 라벨 외부 텍스트 금지. 각 섹션은 지정된 분량 엄수 — 길이 초과 시 후반 섹션 잘림 발생.

[정체성]
한 줄. 자산 성격 정의 (예: "~ 옆에 ~ 전후로 진입하는 ~ 자산입니다.")

[요약]
종합 점수: XX점
등급: (예: "실거주 중심 보유")
입지: X.X / 상품: X.X / 호재: X.X / 유동성: X.X / 실거주: X.X
각 점수 근거 한 줄씩 (총 5줄)

[입지]
교통: 한 줄
인프라: 한 줄
업무지구: 한 줄

[상품성]
장점 3개 (각 한 줄)
단점 3개 (각 한 줄)
구조 체감: 한 줄

[수요층]
잘 맞는 사람: 3개 페르소나 (한 줄씩)
안 맞는 사람: 2개 (한 줄씩)

[주변비교]
2~3줄 단락. 주변 대비 위치와 가격 차이 이유.

[시나리오]
보수 / 기준 / 낙관 / 과열 각 한 줄씩 (총 4줄)
형식: "보수: [조건] → 5년 후 ~억대"

[자산변화]
3줄 이내. 추가 저축 ${manwonToEok(userInput.savingsManwon)} 포함 시 시나리오별 총 자본 (보수/기준/낙관 한 줄씩).

[징검다리]
2줄 이내. 장점 + 한계 + 5년 후 성공 기준 가격.

[전략]
1년 차: 한 줄
2~3년 차: 한 줄
4~5년 차: 한 줄

[매도리스크]
매도 기준: 한 줄
리스크 3개: 각 한 줄 (이름 + 한 마디 대응)

[결론]
한 줄. 의사결정 권장.`
}

export function buildReportPrompt(ctx) {
  return {
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(ctx),
  }
}
