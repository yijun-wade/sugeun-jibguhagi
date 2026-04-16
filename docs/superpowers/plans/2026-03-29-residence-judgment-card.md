# 거주 판단 카드 정교화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 온라인 임장 프로토타입의 EvalCard를 "정보 나열"에서 "이 집에 살아도 될까?"를 답하는 "거주 판단 카드"로 전환한다.

**Architecture:** utils.js의 `getVerdict()` 문구를 거주 중심 언어로 전면 교체하고, 가격 신호를 절대값+방향 분리 구조로 개편하며, 생활 여건 데이터를 이동편의/생활인프라/거주리스크 3축으로 재구성한다. API 레이어(stories.js)는 변경하지 않고 프론트엔드 로직만 수정한다.

**Tech Stack:** React 19, Vite 7, JavaScript (no TypeScript), Vercel Serverless Functions

---

## 📋 문제점 요약

### 1. getVerdict() — 투자 언어 혼재
`src/utils.js:81-129`의 판단 문구에 거주자 관점이 아닌 투자자 언어가 포함되어 있다:
- `"수요 탄탄, 하락 위험 낮음"` → 집값 안정성 투자 관점
- `"장기 보유 유리"` → 투자 수익 관점
- `"진입 기회"` → 매수 타이밍 투자 관점
- `"선반영됨"` → 시장 분석 투자 관점
- `"저평가"` → 투자 수익 관점

거주자가 원하는 답: "이 동네에 살면 일상이 어떨까?" — 출퇴근, 육아, 편의성, 쾌적성.

### 2. 가격 라벨 — 절대값 기준의 한계
`src/constants.js:2-3`:
```js
export const PRICE_HIGH = 80000  // 8억 절대값
export const PRICE_LOW  = 40000  // 4억 절대값
```
- 지역 맥락 없음: 노원 8억은 "비쌈"이 맞지만, 강남 8억은 오히려 저렴
- `recentAvg`가 면적 혼합 평균이라 기준 자체도 흔들림 (#108, #110 이슈 참고)
- 카드에서 "비쌈/적정/저렴"만으로는 거주자가 무엇을 해야 할지 모름

### 3. 후기 대표 — 첫 번째 결과 1건 노출
`src/App.jsx:19`: `storiesRes[0]` 첫 결과를 voice로 사용.
- 첫 결과가 광고·홍보성 게시글일 수 있음
- 50자 잘린 description이 맥락 없이 노출됨
- 카드에서 "어떤 느낌인지" 전달이 안 됨

### 4. 생활 여건 — sub/edu/note/tag 구조 혼재
`src/utils.js:68-76` + `src/data.js`:
- sub(교통), edu(교육), note(특이사항)로 나뉘어 있지만 note는 뭐든 다 담는 잡동사니 필드
- 거주 리스크(재건축 이슈, 공사 소음, 혼잡도) 정보가 tag 하나로 뭉개짐
- getLifeConditions가 항상 최대 3개 반환 — 의미 없이 자리 채우는 경우 발생

### 5. 브랜드명 혼재
- `index.html` title/OG: **"수근수근 집구하기"**
- `src/App.jsx` 화면 표시: **"수근수근 우리집"** + `SooZip`
- 외부 공유 시 링크 미리보기(OG)와 앱 내 브랜드가 다름

---

## 📊 우선순위별 수정안

| 우선순위 | 항목 | 임팩트 | 난이도 |
|--------|------|--------|--------|
| P0 | getVerdict() 문구 전면 재작성 | 카드 핵심 메시지 변화 | 낮음 |
| P0 | 브랜드명 통일 | 공유 UX 즉시 개선 | 매우 낮음 |
| P1 | 가격 라벨 구조 개편 (절대+방향 분리) | 가격 맥락 제공 | 중간 |
| P1 | 후기 대표 방식 개선 | 카드 신뢰도 향상 | 중간 |
| P2 | 생활 여건 3축 재구성 | 데이터 구조 변화 큼 | 높음 |

---

## 🗂 수정 대상 파일 목록

| 파일 | 수정 내용 |
|------|----------|
| `src/utils.js` | `getVerdict()` 문구 전면 교체, `getLifeConditions()` 3축 반환 구조 |
| `src/constants.js` | `PRICE_HIGH/LOW` 제거 또는 개편, 가격 신호 상수 추가 |
| `src/App.jsx` | `buildEvalData()` 가격 라벨 계산 로직, voice 선택 로직 개선 |
| `src/EvalCard.jsx` | 가격 신호 표시 구조, 생활 여건 3축 렌더링 |
| `src/data.js` | DONG 데이터에 3축 필드 추가 (`risk` 필드) |
| `index.html` | title, OG 태그를 "수근수근 우리집"으로 통일 |

---

## Task 1: 브랜드명 통일 (P0 — 5분)

**Files:**
- Modify: `index.html:8-11`

### 현재 상태
```html
<title>수근수근 집구하기</title>
<meta name="description" content="내 집 실거래가 확인부터 이사할 동네 탐색까지" />
<meta property="og:title" content="수근수근 집구하기" />
<meta property="og:description" content="내 집 실거래가 확인부터 이사할 동네 탐색까지" />
```

`src/App.jsx:170, 244`에서는 "수근수근 우리집"을 사용하는데 HTML 메타는 "집구하기".

- [ ] **Step 1: index.html 브랜드명 통일**

```html
<!-- index.html:8-11 교체 -->
<title>수근수근 우리집 · SooZip</title>
<meta name="description" content="마음에 둔 아파트 수집 — 동네 분위기·실거주 후기·실거래가" />
<meta property="og:title" content="수근수근 우리집" />
<meta property="og:description" content="마음에 둔 아파트를 수집하세요. 동네 분위기·실거주 후기·실거래가까지." />
```

- [ ] **Step 2: 로컬에서 확인**

```bash
npm run dev
```
브라우저 탭 타이틀이 "수근수근 우리집 · SooZip"인지 확인.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "fix: 브랜드명 index.html → 수근수근 우리집으로 통일"
```

---

## Task 2: getVerdict() 문구 전면 재작성 (P0 — 20분)

**Files:**
- Modify: `src/utils.js:82-129`

### 원칙
- **제거할 언어:** 수요 탄탄, 장기 보유, 하락 위험, 진입 기회, 저평가, 선반영, 가격 탄탄
- **사용할 언어:** 일상 편의, 출퇴근, 육아, 쾌적성, 거주 만족, 부담, 대기 필요, 실거주 적합

### 태그별 거주 포커스
| 태그 | 거주 관점 핵심 |
|------|--------------|
| 역세권 | 출퇴근 편의 |
| 학군최강 | 자녀 교육 |
| 직주근접 | 직장 접근성 |
| 재건축기대 | 이주 리스크, 공사 소음 |
| 미래가치 | 지금 생활 vs 미래 개발 |
| 자연환경 | 쾌적성, 산책 생활권 |
| 생활편의 | 마트·병원·상권 접근성 |
| 교육환경 | 초등 통학, 학원가 |
| 대학가 | 상권 활성, 임대 수요 소음 |

- [ ] **Step 1: getVerdict() 교체**

`src/utils.js:82-129`를 아래 코드로 교체:

```js
export function getVerdict(tag, priceLabel) {
  const map = {
    '역세권': {
      '비쌈':  '출퇴근은 편하지만 주거비 부담이 큼 — 교통비 절약 효과와 비교해볼 것',
      '적정':  '지하철 접근성 좋고 가격도 부담 없는 수준 — 실거주 만족도 높을 단지',
      '저렴':  '교통 편하고 가격도 낮은 편 — 주거비 부담 없이 출퇴근 쾌적',
    },
    '학군최강': {
      '비쌈':  '학원가 접근성은 최고지만 거주비 부담이 상당함 — 교육비와 합산해 계획 필요',
      '적정':  '학군 좋고 가격도 합리적 — 자녀 교육 환경 만족도 높을 단지',
      '저렴':  '학군 인프라 대비 가격 낮음 — 자녀 교육 계획 있다면 우선 검토 추천',
    },
    '직주근접': {
      '비쌈':  '직장 가깝고 출퇴근 시간 아끼기 좋지만 주거비 부담이 큼',
      '적정':  '직장 접근성 좋고 가격도 합리적 — 워라밸 중심 거주에 적합',
      '저렴':  '직장 가깝고 가격도 저렴 — 출퇴근 스트레스 없이 생활비 여유 가능',
    },
    '재건축기대': {
      '비쌈':  '노후 단지 특성상 관리비·시설 불편 가능 — 이주 시점 불확실성 감안 필요',
      '적정':  '재건축 진행 시 이주 가능성 있음 — 단기 실거주 계획이라면 확인 필요',
      '저렴':  '가격은 낮지만 공사·이주 리스크 있음 — 장기 거주보다 단기 계획에 적합',
    },
    '미래가치': {
      '비쌈':  '개발 호재 있지만 지금 당장 생활 편의는 제한적 — 완공 전 불편 감수 필요',
      '적정':  '개발 진행 중으로 생활 인프라가 성숙 중 — 입주 시기에 따라 편의 차이',
      '저렴':  '인프라가 아직 부족하지만 가격 부담 적음 — 불편 감수 가능하다면 고려',
    },
    '자연환경': {
      '비쌈':  '공원·산 접근성 좋고 쾌적하지만 가격 부담 있음 — 조용한 주거 선호라면 고려',
      '적정':  '자연환경 쾌적하고 가격도 합리적 — 산책·여유로운 일상 원하는 가족에 적합',
      '저렴':  '자연환경 좋고 가격도 낮은 편 — 쾌적한 주거 환경을 합리적 비용으로',
    },
    '생활편의': {
      '비쌈':  '마트·병원·상권 가깝고 편리하지만 주거비 부담이 있음',
      '적정':  '생활 편의 시설 잘 갖춰져 있고 가격도 적정 — 일상 편의성 높은 단지',
      '저렴':  '편의 시설 풍부하고 가격도 낮은 편 — 일상 불편 없이 주거비 절약 가능',
    },
    '교육환경': {
      '비쌈':  '초등 통학과 학원가 접근성 좋지만 거주비 부담이 큼',
      '적정':  '교육 인프라 갖추고 가격도 합리적 — 초등 자녀 키우기 좋은 환경',
      '저렴':  '교육 환경 좋고 가격도 낮음 — 초등 자녀 있는 가족에게 실용적인 선택',
    },
    '대학가': {
      '비쌈':  '유동인구 많고 상권 활성화 — 소음·임대 수요 공존, 거주 쾌적성 확인 필요',
      '적정':  '상권 활발하고 생활 편의 좋음 — 활기찬 동네 분위기 선호한다면 적합',
      '저렴':  '대학가 상권 인프라 갖추고 가격 낮음 — 1~2인 가구 실거주에 실용적',
    },
  }
  return map[tag]?.[priceLabel] || '실거래 데이터 기준 검토해볼 만한 단지 — 상세 탭에서 확인하세요'
}
```

- [ ] **Step 2: 로컬에서 판단 문구 확인**

`npm run dev` 후 "역세권" 태그 동네(예: 불광동·신도림동) 검색 → EvalCard의 💬 판단 문구가 바뀌었는지 확인.

- [ ] **Step 3: Commit**

```bash
git add src/utils.js
git commit -m "refactor: getVerdict() 투자 언어 → 거주 판단 언어로 전면 교체"
```

---

## Task 3: 가격 라벨 구조 개편 (P1 — 30분)

**Files:**
- Modify: `src/constants.js`
- Modify: `src/App.jsx:71-78` (priceLabel 계산 블록)
- Modify: `src/EvalCard.jsx:39-50` (가격 신호 렌더링)

### 개편안: 절대가격 신호 + 방향 신호 분리

**현재 구조의 한계:**
- 절대값 8억/4억 기준은 지역 맥락 없음
- 카드에서 "비쌈"만 보여줘서 "그래서 어쩌라고?" 반응

**개편 방향:**
```
[가격 표시]
- 최근 평균: N억 (현재 유지)
- 방향: ↑ 상승세 / → 보합 / ↓ 하락세 (현재 유지)
- 절대 라벨 제거 또는 보조 텍스트로 강등
- 대신 "예산 맞춤 문구" 추가: "예산 N억 이상 필요"
```

**카드 노출 문구 예시:**
- 현재: `💰 최근 3개월 평균 8억 5,000만  ↑ 상승세  [비쌈]`
- 개편: `💰 최근 평균 8억 5,000만 · 상승 중 · 예산 9억 이상 필요`
- 또는: `💰 8억 5천 · ↑ 오르는 중` (심플 버전)

**priceLabel 의미 재정의:**
| 라벨 | 기준 | 카드 표현 |
|------|------|----------|
| 여유있음 | recentAvg < PRICE_LOW | "예산 4억 이하로 거주 가능" |
| 보통 | PRICE_LOW ≤ avg ≤ PRICE_HIGH | "예산 4~8억 수준" |
| 높음 | recentAvg > PRICE_HIGH | "예산 8억 이상 필요" |

> **참고:** PRICE_HIGH/LOW는 지역 절대값 기준으로 여전히 한계가 있음. 이 플랜에서는 라벨 표현(언어)만 거주자 중심으로 변경하고, 중장기 개선(지역별 상대 기준)은 별도 이슈(#110)로 추적.

- [ ] **Step 1: constants.js 가격 라벨 상수명 변경**

`src/constants.js`를 아래로 교체:

```js
// ── 가격 기준 (만원, 총 거래금액 기준) ────────
export const PRICE_HIGH = 80000   // 8억 이상 → '높음'
export const PRICE_LOW  = 40000   // 4억 이하 → '여유있음'

// ── 면적 기준 ───────────────────────────────
export const MIN_AREA_SQM  = 40   // 전용면적 최소값 (㎡), 소형 제외
export const SQM_TO_PYEONG = 3.3058 // ㎡ → 평 환산 계수 (1평 = 3.3058㎡)

// ── 네트워크 ────────────────────────────────
export const FETCH_TIMEOUT = 10000 // API 타임아웃 (ms)

// ── 한국 좌표 범위 (지도 유효성 검사) ──────
export const KR_LAT = { min: 33, max: 43 }
export const KR_LON = { min: 124, max: 132 }
```

> SQM_TO_PYEONG 동시에 수정 (이슈 #108 fix).

- [ ] **Step 2: App.jsx priceLabel 값 변경**

`src/App.jsx:76-78`을 교체:

```js
let priceLabel = '보통'
if (recentAvg > PRICE_HIGH) priceLabel = '높음'
else if (recentAvg < PRICE_LOW) priceLabel = '여유있음'
```

- [ ] **Step 3: EvalCard.jsx 가격 라벨 색상 맵과 렌더링 업데이트**

`src/EvalCard.jsx:9-13` 교체:
```js
const PRICE_LABEL_COLOR = {
  '높음':     { bg: '#fff1f0', color: '#D64A3A' },
  '보통':     { bg: '#fffbeb', color: '#d97706' },
  '여유있음': { bg: '#f0fdf4', color: '#16a34a' },
}
```

`src/EvalCard.jsx:39-50`의 가격 행 교체:
```jsx
{/* 가격 신호 */}
<div className="eval-price-row">
  <div className="eval-price-avg">
    💰 최근 평균 <strong>{fP(apt.recentAvg)}</strong>
    <span style={{ color: dirColor, marginLeft: 6 }}>{apt.direction}</span>
  </div>
  {apt.priceLabel !== '보통' && (
    <div
      className="eval-price-label"
      style={{ background: labelStyle.bg, color: labelStyle.color }}
    >
      {apt.priceLabel}
    </div>
  )}
</div>
```

> "보통"은 라벨을 숨겨 카드 노이즈를 줄임.

- [ ] **Step 4: DetailReport.jsx priceLabel CSS 클래스명 동기화**

`src/DetailReport.jsx`에 priceLabel을 CSS 클래스명으로 쓰는 부분 찾아 업데이트:

```jsx
// DetailReport.jsx:159 — 기존
<span className={`price-ai-label ${apt.priceLabel}`}>{apt.priceLabel}</span>
```

`src/index.css:539-541` 교체:
```css
.price-ai-label.높음     { background: #fee2e2; color: #dc2626; }
.price-ai-label.보통     { background: #dcfce7; color: #16a34a; }
.price-ai-label.여유있음 { background: #dbeafe; color: #2563eb; }
```

- [ ] **Step 5: 로컬 확인**

`npm run dev` 후 아무 아파트 검색 → 가격 라벨이 "높음/보통/여유있음"으로 표시되는지 확인. 84㎡ 평형 표시가 약 25평(이전 34평)으로 바뀌었는지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/constants.js src/App.jsx src/EvalCard.jsx src/DetailReport.jsx src/index.css
git commit -m "refactor: 가격 라벨을 거주자 언어로 개편, SQM_TO_PYEONG 3.3058 수정 (#108)"
```

---

## Task 4: 후기 대표 방식 개선 (P1 — 25분)

**Files:**
- Modify: `src/App.jsx:17-19` (voice 선택 로직)
- Modify: `src/EvalCard.jsx:65-68` (voice 렌더링)

### 현재 문제
```js
// App.jsx:19
const voice = Array.isArray(storiesRes) && storiesRes.length > 0 ? storiesRes[0] : null
```
첫 번째 결과를 무조건 사용. 광고성 게시글, 분양 홍보, 무관한 내용이 올 수 있음.

### 개선 방향: 가장 긴 description을 가진 결과 선택
- description이 긴 글 = 실거주 경험 서술 가능성 높음
- title만 있고 description이 짧은 글 = 홍보성 가능성 높음
- isCommercial 체크(api/stories.js에 있음)는 API 레벨에서 이미 필터링하므로, 프론트에서는 길이 기준 선택

```js
// 개선된 voice 선택: description 가장 긴 것 선택, 없으면 첫 번째
const voice = Array.isArray(storiesRes) && storiesRes.length > 0
  ? storiesRes.reduce((best, s) =>
      (s.description?.length || 0) > (best.description?.length || 0) ? s : best
    , storiesRes[0])
  : null
```

### 카드 렌더링 개선
현재: 50자 잘린 description이 큰따옴표로 표시 → 문장이 중간에 끊겨 어색함
개선: 문장 완성 단위로 자르기 (마침표/느낌표/물음표 이전 마지막 완결 문장)

```js
// utils.js에 추가할 헬퍼 함수
export function snippetText(text, maxLen = 55) {
  if (!text) return ''
  if (text.length <= maxLen) return text
  const trimmed = text.slice(0, maxLen)
  // 마지막 문장 완결 지점 찾기
  const lastEnd = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf('!'),
    trimmed.lastIndexOf('?'),
    trimmed.lastIndexOf('요'),
    trimmed.lastIndexOf('다'),
  )
  return lastEnd > 20 ? trimmed.slice(0, lastEnd + 1) : trimmed + '…'
}
```

- [ ] **Step 1: snippetText 헬퍼 utils.js에 추가**

`src/utils.js` 맨 아래에 추가:

```js
// ── 후기 텍스트 스니펫 ──────────────────────
// 문장 완결 단위로 maxLen 이하로 자름
export function snippetText(text, maxLen = 55) {
  if (!text) return ''
  if (text.length <= maxLen) return text
  const trimmed = text.slice(0, maxLen)
  const lastEnd = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf('!'),
    trimmed.lastIndexOf('?'),
    trimmed.lastIndexOf('요'),
    trimmed.lastIndexOf('다'),
  )
  return lastEnd > 20 ? trimmed.slice(0, lastEnd + 1) : trimmed + '…'
}
```

- [ ] **Step 2: App.jsx voice 선택 로직 교체**

`src/App.jsx:19` 교체:

```js
const voice = Array.isArray(storiesRes) && storiesRes.length > 0
  ? storiesRes.reduce((best, s) =>
      (s.description?.length || 0) > (best.description?.length || 0) ? s : best
    , storiesRes[0])
  : null
```

- [ ] **Step 3: EvalCard.jsx에 snippetText import 및 적용**

`src/EvalCard.jsx:2` 교체:
```js
import { fP, snippetText } from './utils.js'
```

`src/EvalCard.jsx:65-68` 교체:
```jsx
{apt.voice?.link && isValidUrl(apt.voice.link) && (apt.voice.description || apt.voice.title) && (
  <a className="eval-voice" href={apt.voice.link} target="_blank" rel="noopener noreferrer">
    🗣 "{snippetText(apt.voice.description || apt.voice.title)}"
  </a>
)}
```

- [ ] **Step 4: 로컬에서 확인**

`npm run dev` 후 "헬리오시티" 또는 "상계주공" 검색 → 카드 하단 후기 문구가 자연스럽게 끊기는지 확인.

- [ ] **Step 5: Commit**

```bash
git add src/utils.js src/App.jsx src/EvalCard.jsx
git commit -m "feat: 후기 대표 선택 — description 길이 기준, 스니펫 문장 완결 처리"
```

---

## Task 5: 생활 여건 3축 재구성 (P2 — 40분)

**Files:**
- Modify: `src/data.js` — DONG 데이터에 `risk` 필드 추가
- Modify: `src/utils.js:68-76` — `getLifeConditions()` 3축 구조 반환
- Modify: `src/EvalCard.jsx:52-62` — 3축 렌더링

### 3축 정의
| 축 | 아이콘 | 데이터 소스 | 의미 |
|----|--------|------------|------|
| 이동 편의 | 🚇 | `d.sub` | 지하철 노선·역명 |
| 생활 인프라 | 🏪 | `d.note` (edu 없는 경우) / `d.edu` | 상권·병원·학교 |
| 거주 리스크 | ⚠️ | `d.risk` (신규 필드) | 재건축·공사·소음 등 |

### DONG 데이터 risk 필드 추가 기준
| 태그 | risk 내용 |
|------|----------|
| 재건축기대 | "재건축 진행 중 — 이주·공사 일정 확인 필요" |
| 미래가치 | 개발 단계에 따라 적용 |
| 기타 | `null` (risk 없음, 표시 안 함) |

### 새 getLifeConditions() 반환 구조
```js
// 반환: { move, infra, risk }
// move: { icon: '🚇', text: '...' } | null
// infra: { icon: '🏫' | '🏪' | '✨', text: '...' } | null
// risk: { icon: '⚠️', text: '...' } | null
```

- [ ] **Step 1: data.js DONG에 risk 필드 추가**

`src/data.js`의 DONG 객체에 risk 필드 추가 (재건축·미래가치 태그 항목에만):

```js
export const DONG = {
  '상계동':  { sub:'4·7호선 노원역·마들역', note:'상계주공 재건축 추진', tag:'재건축기대',
               risk:'재건축 추진 중 — 이주·공사 일정 확인 권장' },
  '중계동':  { sub:'7호선 중계역', edu:'은행사거리 학원가 (강북 대치동)', tag:'학군최강' },
  '하계동':  { sub:'7호선 하계역·공릉역', note:'을지대병원 근접', tag:'생활편의' },
  '공릉동':  { sub:'6호선 화랑대역', edu:'태릉초·공릉중 초세권', tag:'교육환경' },
  '월계동':  { sub:'1호선 월계역·광운대역', note:'광운대·성신여대 인근', tag:'대학가' },
  '도봉동':  { sub:'1호선 방학역', note:'도봉산 인근 쾌적', tag:'자연환경' },
  '쌍문동':  { sub:'1호선 쌍문역', note:'덕성여대·한성대 인근', tag:'대학가' },
  '방학동':  { sub:'1호선 방학역', note:'도봉산 트레킹 접근', tag:'자연환경' },
  '창동':    { sub:'1·4호선 창동역', note:'GTX-C 수혜 예정', tag:'미래가치',
               risk:'GTX-C 개통 전 공사 소음 가능 — 완공 시기 확인 필요' },
  '번동':    { sub:'4호선 수유역', note:'강북구 상권 중심', tag:'생활편의' },
  '미아동':  { sub:'4호선 미아역·미아사거리역', note:'롯데백화점 미아점', tag:'생활편의' },
  '수유동':  { sub:'4호선 수유역', note:'강북 최대 상권', tag:'생활편의' },
  '길음동':  { sub:'4호선 길음역', note:'길음뉴타운 정비중', tag:'재건축기대',
               risk:'뉴타운 정비 중 — 공사 소음 및 이주 가능성 확인 필요' },
  '장위동':  { sub:'6호선 돌곶이역', note:'장위뉴타운 정비중', tag:'재건축기대',
               risk:'장위뉴타운 정비 중 — 구역별 이주 일정 다를 수 있음' },
  '불광동':  { sub:'3·6호선 불광역', note:'더블역세권 은평 핵심', tag:'역세권' },
  '녹번동':  { sub:'3호선 녹번역', note:'은평뉴타운 인근', tag:'재건축기대',
               risk:'은평뉴타운 인근 정비 사업 진행 중' },
  '상암동':  { sub:'6호선 월드컵경기장역', note:'DMC IT 직주근접', tag:'직주근접' },
  '합정동':  { sub:'2·6호선 합정역', note:'홍대 인근 젊은 감성', tag:'역세권' },
  '망원동':  { sub:'6호선 망원역', note:'망원한강공원 인접', tag:'자연환경' },
  '화곡동':  { sub:'5호선 화곡역·우장산역', note:'강서구 최대 상권', tag:'생활편의' },
  '가양동':  { sub:'9호선 가양역', note:'한강 조망 가능', tag:'자연환경' },
  '구로동':  { sub:'1·2호선 구로역', note:'구로디지털단지 직주근접', tag:'직주근접' },
  '신도림동':{ sub:'1·2호선 신도림역', note:'교통 허브 디큐브시티', tag:'역세권' },
  '봉천동':  { sub:'2호선 봉천역·서울대입구역', note:'서울대 상권', tag:'대학가' },
  '신림동':  { sub:'2호선 신림역·서원역', note:'신림선 개통 역세권', tag:'역세권' },
  '상도동':  { sub:'7호선 상도역·장승배기역', note:'숭실대 인근', tag:'대학가' },
  '당산동':  { sub:'2·9호선 당산역', note:'영등포 핵심 역세권', tag:'역세권' },
  '신길동':  { sub:'5호선 신길역', note:'여의도 출퇴근 쾌적', tag:'직주근접' },
  '목동':    { sub:'5호선 목동역·오목교역', edu:'목동 학원가 최강 학군', tag:'학군최강' },
  '행당동':  { sub:'2·5호선 왕십리역', note:'왕십리 재개발 기대', tag:'재건축기대',
               risk:'재개발 사업 진행 중 — 이주 시점 불확실' },
  '구의동':  { sub:'2·5호선 구의역·광나루역', note:'강동 접근성 우수', tag:'역세권' },
  '면목동':  { sub:'7호선 면목역', note:'경의중앙선 환승 편의', tag:'역세권' },
  '고덕동':  { sub:'5호선 고덕역·명일역', note:'고덕강일지구 신도시', tag:'미래가치',
               risk:'신도시 개발 중 — 인프라 완공 시기 확인 권장' },
  '둔촌동':  { sub:'5호선 둔촌동역', note:'올림픽파크포레온 입주', tag:'미래가치' },
  '분당동':  { sub:'분당선 서현역·이매역', edu:'분당 최강 학군', tag:'학군최강' },
  '평촌동':  { sub:'4호선 범계역·평촌역', edu:'평촌 학원가', tag:'학군최강' },
}
```

- [ ] **Step 2: getLifeConditions() 3축 구조로 교체**

`src/utils.js:68-76` 교체:

```js
// ── 동네 생활 여건 3축 ─────────────────────
// 반환값: [{ icon, text, axis }] — axis: 'move' | 'infra' | 'risk'
export function getLifeConditions(dong) {
  const d = DONG[dong] || {}
  const items = []

  // 축 1: 이동 편의
  if (d.sub) items.push({ icon: '🚇', text: d.sub, axis: 'move' })

  // 축 2: 생활 인프라 (edu 우선, 없으면 note)
  if (d.edu)       items.push({ icon: '🏫', text: d.edu, axis: 'infra' })
  else if (d.note) items.push({ icon: '🏪', text: d.note, axis: 'infra' })

  // 축 3: 거주 리스크 (있을 때만)
  if (d.risk) items.push({ icon: '⚠️', text: d.risk, axis: 'risk' })

  return items  // 최대 3개, risk 없으면 2개
}
```

- [ ] **Step 3: EvalCard.jsx 생활 여건 렌더링 업데이트**

`src/EvalCard.jsx:52-62` 교체:

```jsx
{/* 생활 여건 3축 */}
{apt.lifeConditions.length > 0 && (
  <div className="eval-life">
    {apt.lifeConditions.map((item, i) => (
      <div
        key={i}
        className={`eval-life-row${item.axis === 'risk' ? ' eval-life-risk' : ''}`}
      >
        <span>{item.icon}</span>
        <span>{item.text}</span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: index.css에 risk 행 스타일 추가**

`src/index.css`의 `.eval-life-row` 다음 줄에 추가:

```css
.eval-life-row.eval-life-risk { color: #b45309; background: #fffbeb; border-radius: 6px; padding: 3px 6px; font-size: 12px; }
```

- [ ] **Step 5: 로컬에서 확인**

`npm run dev` 후 "상계주공" 또는 "창동" 검색 → ⚠️ 거주 리스크 행이 표시되는지 확인. "중계" 검색 → risk 없이 🚇 + 🏫 2개만 표시되는지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/data.js src/utils.js src/EvalCard.jsx src/index.css
git commit -m "feat: 생활 여건 3축(이동편의·생활인프라·거주리스크) 재구성"
```

---

## 🃏 바뀐 카드 문구 예시 3개

### 예시 1: 상계주공 (재건축기대 + 비쌈)
```
💬 노후 단지 특성상 관리비·시설 불편 가능 — 이주 시점 불확실성 감안 필요
💰 최근 평균 6억 2천 · → 보합    [높음]
🚇 4·7호선 노원역·마들역
🏪 상계주공 재건축 추진
⚠️ 재건축 추진 중 — 이주·공사 일정 확인 권장
🗣 "10년 넘게 살았는데 재건축 얘기가 나오고 있어요..."
```

### 예시 2: 목동 한신 (학군최강 + 적정)
```
💬 학군 좋고 가격도 합리적 — 자녀 교육 환경 만족도 높을 단지
💰 최근 평균 9억 · ↑ 상승 중
🚇 5호선 목동역·오목교역
🏫 목동 학원가 최강 학군
🗣 "애들 학원 보내기 너무 편해요. 도보 5분에 다 있어서..."
```

### 예시 3: 상암 DMC (직주근접 + 저렴)
```
💬 직장 가깝고 가격도 저렴 — 출퇴근 스트레스 없이 생활비 여유 가능
💰 최근 평균 3억 8천 · → 보합    [여유있음]
🚇 6호선 월드컵경기장역
🏪 DMC IT 직주근접
🗣 "회사에서 걸어서 15분, 이 가격에 이 입지면..."
```

---

## Self-Review

### Spec 커버리지 체크
| 항목 | Task |
|------|------|
| getVerdict() 문구 전면 재작성 | ✅ Task 2 |
| 투자/시장 언어 제거 | ✅ Task 2 |
| 가격 라벨 구조 개편안 | ✅ Task 3 |
| 절대/상대 신호 분리 논의 | ✅ Task 3 (한계 명시, 중장기 이슈 참조) |
| 카드 가격 문장 예시 | ✅ 카드 예시 3개 섹션 |
| 후기 대표 방식 개선 | ✅ Task 4 |
| 생활 여건 3축 재구성 | ✅ Task 5 |
| 브랜드명 일관성 | ✅ Task 1 |
| 수정 대상 파일 목록 | ✅ 상단 표 |

### 타입 일관성 체크
- `getLifeConditions()` 반환 타입: Task 5 Step 2에서 `{ icon, text, axis }` 정의 → EvalCard Step 3에서 `item.axis` 사용 ✅
- `snippetText()` — Task 4 Step 1에서 정의, EvalCard Step 3에서 import ✅
- `priceLabel` 값: App.jsx Step 2 (`'높음'/'보통'/'여유있음'`) → EvalCard Step 1 color map → DetailReport.jsx Step 4 CSS ✅
- `SQM_TO_PYEONG = 3.3058` — constants.js Task 3 Step 1에서만 수정, 사용처(DetailReport.jsx)는 import로 자동 반영 ✅
