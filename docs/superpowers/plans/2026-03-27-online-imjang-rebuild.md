# 온라인 임장 리빌드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 지역 탐색 + 스코어 랭킹 구조를 "검색 → 집 평가 카드 → 상세 임장 리포트" 구조로 전면 리빌드

**Architecture:** App.jsx 단일 파일에서 data / utils / components 로 분리하고, 새 진입점은 검색창으로 단일화. 기존 API 레이어(api/*.js)는 그대로 유지하고 UI 레이어만 전면 교체.

**Tech Stack:** React 19, Vite, Vercel Serverless Functions, 국토부 실거래가 API, 네이버 블로그 API

---

## 파일 구조

```
src/
  data.js          ← DONG, SEOUL, METRO, PRESETS 상수 (App.jsx에서 추출)
  utils.js         ← fP, fR, getYM, parseXml, getVerdict, getLifeConditions (신규 포함)
  App.jsx          ← 전면 교체: SearchBar + EvalCard + DetailReport만 남김
  index.css        ← EvalCard / DetailReport 스타일 추가, 구 스타일 제거
api/               ← 손대지 않음 (trade.js, search.js, apt-info.js, stories.js 유지)
```

---

## Task 1: data.js 추출

**Files:**
- Create: `src/data.js`
- Modify: `src/App.jsx` (import로 교체)

- [ ] **Step 1: `src/data.js` 파일 생성**

```js
// src/data.js
export const DONG = {
  '상계동':  { sub:'4·7호선 노원역·마들역', note:'상계주공 재건축 추진', tag:'재건축기대' },
  '중계동':  { sub:'7호선 중계역', edu:'은행사거리 학원가 (강북 대치동)', tag:'학군최강' },
  '하계동':  { sub:'7호선 하계역·공릉역', note:'을지대병원 근접', tag:'생활편의' },
  '공릉동':  { sub:'6호선 화랑대역', edu:'태릉초·공릉중 초세권', tag:'교육환경' },
  '월계동':  { sub:'1호선 월계역·광운대역', note:'광운대·성신여대 인근', tag:'대학가' },
  '도봉동':  { sub:'1호선 방학역', note:'도봉산 인근 쾌적', tag:'자연환경' },
  '쌍문동':  { sub:'1호선 쌍문역', note:'덕성여대·한성대 인근', tag:'대학가' },
  '방학동':  { sub:'1호선 방학역', note:'도봉산 트레킹 접근', tag:'자연환경' },
  '창동':    { sub:'1·4호선 창동역', note:'GTX-C 수혜 예정', tag:'미래가치' },
  '번동':    { sub:'4호선 수유역', note:'강북구 상권 중심', tag:'생활편의' },
  '미아동':  { sub:'4호선 미아역·미아사거리역', note:'롯데백화점 미아점', tag:'생활편의' },
  '수유동':  { sub:'4호선 수유역', note:'강북 최대 상권', tag:'생활편의' },
  '길음동':  { sub:'4호선 길음역', note:'길음뉴타운 정비중', tag:'재건축기대' },
  '장위동':  { sub:'6호선 돌곶이역', note:'장위뉴타운 정비중', tag:'재건축기대' },
  '불광동':  { sub:'3·6호선 불광역', note:'더블역세권 은평 핵심', tag:'역세권' },
  '녹번동':  { sub:'3호선 녹번역', note:'은평뉴타운 인근', tag:'재건축기대' },
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
  '행당동':  { sub:'2·5호선 왕십리역', note:'왕십리 재개발 기대', tag:'재건축기대' },
  '구의동':  { sub:'2·5호선 구의역·광나루역', note:'강동 접근성 우수', tag:'역세권' },
  '면목동':  { sub:'7호선 면목역', note:'경의중앙선 환승 편의', tag:'역세권' },
  '고덕동':  { sub:'5호선 고덕역·명일역', note:'고덕강일지구 신도시', tag:'미래가치' },
  '둔촌동':  { sub:'5호선 둔촌동역', note:'올림픽파크포레온 입주', tag:'미래가치' },
  '분당동':  { sub:'분당선 서현역·이매역', edu:'분당 최강 학군', tag:'학군최강' },
  '평촌동':  { sub:'4호선 범계역·평촌역', edu:'평촌 학원가', tag:'학군최강' },
}

export const SEOUL = {
  '강남구':'11680','강동구':'11740','강북구':'11305','강서구':'11500',
  '관악구':'11620','광진구':'11215','구로구':'11530','금천구':'11545',
  '노원구':'11350','도봉구':'11320','동대문구':'11230','동작구':'11590',
  '마포구':'11440','서대문구':'11410','서초구':'11650','성동구':'11200',
  '성북구':'11290','송파구':'11710','양천구':'11470','영등포구':'11560',
  '용산구':'11170','은평구':'11380','종로구':'11110','중구':'11140','중랑구':'11260',
}

export const METRO = {
  '수원장안구':'41111','수원권선구':'41113','수원팔달구':'41115','수원영통구':'41117',
  '성남수정구':'41131','성남중원구':'41133','성남분당구':'41135',
  '의정부시':'41150','안양만안구':'41171','안양동안구':'41173',
  '부천시':'41190','광명시':'41210','안산상록구':'41271','안산단원구':'41273',
  '고양덕양구':'41281','고양일산동구':'41285','고양일산서구':'41287',
  '과천시':'41290','구리시':'41310','남양주시':'41360','하남시':'41450',
  '용인처인구':'41461','용인기흥구':'41463','용인수지구':'41465',
  '파주시':'41480','김포시':'41570','화성시':'41590',
  '인천미추홀구':'28177','인천연수구':'28185','인천남동구':'28200',
  '인천부평구':'28237','인천서구':'28260',
}

export const HINT_SEARCHES = [
  '래미안 원베일리', '은마아파트', '목동 신시가지', '마포 래미안 푸르지오',
  '상계주공', '둔촌주공', '고덕 그라시움',
]
```

- [ ] **Step 2: App.jsx 상단 import 추가**

`src/App.jsx` 파일 상단에 아래 추가 (기존 상수 블록은 Task 5에서 제거):

```js
import { DONG, SEOUL, METRO, HINT_SEARCHES } from './data.js'
```

- [ ] **Step 3: `npm run dev` 로 앱 실행, 콘솔 에러 없는지 확인**

실행: `npm run dev` (또는 `npx vite`)
기대: 브라우저에서 기존 화면 그대로 렌더링, 콘솔 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/data.js src/App.jsx
git commit -m "refactor: 데이터 상수를 data.js로 분리"
```

---

## Task 2: utils.js 추출 + getVerdict / getLifeConditions 신규 추가

**Files:**
- Create: `src/utils.js`
- Modify: `src/App.jsx` (import로 교체)

- [ ] **Step 1: `src/utils.js` 파일 생성**

```js
// src/utils.js
import { DONG } from './data.js'

// ── 숫자 포맷 ──────────────────────────────
export function fP(v) {
  if (v >= 10000) {
    const e = Math.floor(v / 10000), r = v % 10000
    return r ? `${e}억 ${r.toLocaleString()}만` : `${e}억`
  }
  return `${v.toLocaleString()}만`
}
export function fR(a, b) { return a === b ? fP(a) : `${fP(a)} ~ ${fP(b)}` }

// ── 날짜 유틸 ──────────────────────────────
export function getYM(n) {
  const list = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    list.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return list
}

// ── XML 파싱 ───────────────────────────────
export function parseXml(xml, regionName) {
  const trades = []
  try {
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    doc.querySelectorAll('item').forEach(item => {
      const g = t => (item.querySelector(t)?.textContent || '').trim()
      const amt = parseInt(g('dealAmount').replace(/,/g, ''))
      const area = parseFloat(g('excluUseAr')) || 0
      const aptNm = g('aptNm'), dong = g('umdNm'), buildYear = g('buildYear') || '1988'
      if (!aptNm || isNaN(amt) || amt <= 0) return
      trades.push({ regionName, aptNm, dong, buildYear, amt, area })
    })
  } catch (e) { /* skip */ }
  return trades
}

// ── 가격 신호 계산 ─────────────────────────
// trades: [{ amt, area }] 최근 6개월치
// 앞 3개월 avg vs 뒤 3개월 avg 비교
export function calcPriceSignal(recentTrades, olderTrades) {
  const avg = arr => arr.length ? Math.round(arr.reduce((s, t) => s + t.amt, 0) / arr.length) : 0
  const recentAvg = avg(recentTrades)
  const olderAvg  = avg(olderTrades)

  let direction = '→ 보합'
  if (olderAvg > 0) {
    const pct = (recentAvg - olderAvg) / olderAvg
    if (pct > 0.05) direction = '↑ 상승세'
    else if (pct < -0.05) direction = '↓ 하락세'
  }

  // 동 내 유사 평형 대비 레이블은 호출부에서 전달받음
  return { recentAvg, olderAvg, direction }
}

// ── 동네 생활 여건 top 3 ───────────────────
// 반환값: [{ icon, text }] 최대 3개
export function getLifeConditions(dong) {
  const d = DONG[dong] || {}
  const items = []
  if (d.sub)  items.push({ icon: '🚇', text: d.sub })
  if (d.edu)  items.push({ icon: '🏫', text: d.edu })
  if (d.note) items.push({ icon: '✨', text: d.note })
  if (items.length < 3 && d.tag === '자연환경') items.push({ icon: '🌿', text: '자연환경 우수' })
  return items.slice(0, 3)
}

// ── 한줄 판단 문장 ──────────────────────────
// tag: DONG[dong].tag 값
// priceLabel: '비쌈' | '적정' | '저렴'
export function getVerdict(tag, priceLabel) {
  const map = {
    '역세권': {
      '비쌈':  '입지는 확실하나 가격 부담이 큼',
      '적정':  '교통 편하고 가격도 합리적, 실거주 적합',
      '저렴':  '교통 좋고 가격까지 저렴, 관심 가져볼 만함',
    },
    '학군최강': {
      '비쌈':  '학군 프리미엄이 가격에 반영됨',
      '적정':  '학군 좋고 가격 안정적, 자녀 키우기 유리',
      '저렴':  '학군 대비 가격 낮음, 진입 기회',
    },
    '직주근접': {
      '비쌈':  '직주근접 수요로 가격 탄탄, 하락 위험 낮음',
      '적정':  '출퇴근 편하고 가격도 합리적',
      '저렴':  '직주근접에 가격까지 저렴, 실거주 우선 검토',
    },
    '재건축기대': {
      '비쌈':  '재건축 기대가 가격에 선반영됨',
      '적정':  '재건축 기대 있고 현재 가격도 합리적',
      '저렴':  '재건축 기대 있으나 현재 거주 여건 확인 필요',
    },
    '미래가치': {
      '비쌈':  '미래 호재가 이미 가격에 반영',
      '적정':  '미래 개발 호재 있고 가격도 안정적',
      '저렴':  '미래 가치 대비 저평가, 장기 보유 유리',
    },
    '자연환경': {
      '비쌈':  '쾌적한 환경이 가격에 반영됨',
      '적정':  '조용하고 쾌적, 여유로운 거주에 적합',
      '저렴':  '자연환경 좋고 가격까지 합리적',
    },
    '생활편의': {
      '비쌈':  '편의시설 풍부하나 가격 부담',
      '적정':  '생활 편의 좋고 가격도 적정',
      '저렴':  '생활 편의 갖추고 가격도 저렴',
    },
  }
  return map[tag]?.[priceLabel] || '실거래 데이터 기준 검토해볼 만한 단지'
}

// ── 이름 유사도 ────────────────────────────
function normNm(s) { return (s || '').replace(/[\s()（）]/g, '') }
export function nameSim(a, b) {
  const na = normNm(a), nb = normNm(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  let overlap = 0
  for (const ch of na) if (nb.includes(ch)) overlap++
  return overlap / Math.max(na.length, nb.length)
}
```

- [ ] **Step 2: App.jsx 상단에 import 추가**

```js
import { fP, fR, getYM, parseXml, calcPriceSignal, getLifeConditions, getVerdict, nameSim } from './utils.js'
```

- [ ] **Step 3: 앱 실행 후 기존 화면 정상 동작 확인**

실행: `npm run dev`
기대: 콘솔 에러 없음, 기존 UI 그대로

- [ ] **Step 4: 커밋**

```bash
git add src/utils.js src/App.jsx
git commit -m "refactor: 유틸 함수를 utils.js로 분리, getVerdict/getLifeConditions/calcPriceSignal 추가"
```

---

## Task 3: EvalCard 컴포넌트 신규 작성

**Files:**
- Create: `src/EvalCard.jsx`
- Modify: `src/index.css` (EvalCard 스타일 추가)

EvalCard는 아파트 1개에 대한 판단 카드. 받는 props:
```
apt: {
  aptNm, dong, regionName, buildYear,
  recentAvg,          // 최근 3개월 평균 (만원)
  direction,          // '↑ 상승세' | '→ 보합' | '↓ 하락세'
  priceLabel,         // '비쌈' | '적정' | '저렴'
  lifeConditions,     // [{ icon, text }] 최대 3개
  verdict,            // 한줄 판단 문장
  voice,              // { title, description, link } | null
}
onDetail: () => void  // "자세히 보기" 클릭 핸들러
```

- [ ] **Step 1: `src/EvalCard.jsx` 파일 생성**

```jsx
// src/EvalCard.jsx
import { fP } from './utils.js'

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
      {apt.voice && (
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
```

- [ ] **Step 2: `src/index.css` 에 EvalCard 스타일 추가 (파일 끝에 append)**

```css
/* ─── EVAL CARD ─── */
.eval-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.eval-header { display: flex; align-items: flex-start; justify-content: space-between; }
.eval-name   { font-size: 17px; font-weight: 800; color: var(--text); letter-spacing: -0.3px; }
.eval-loc    { font-size: 12px; color: var(--muted); margin-top: 3px; }

.eval-verdict {
  font-size: 14px; font-weight: 600; color: var(--text2);
  background: var(--blue-lt); border-radius: 10px; padding: 10px 14px;
  line-height: 1.5;
}

.eval-price-row {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.eval-price-avg  { font-size: 14px; color: var(--text2); }
.eval-price-avg strong { color: var(--text); }
.eval-price-label {
  font-size: 11px; font-weight: 700;
  padding: 3px 10px; border-radius: 20px;
  white-space: nowrap;
}

.eval-life       { display: flex; flex-direction: column; gap: 6px; }
.eval-life-row   { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text2); }

.eval-voice {
  display: block;
  font-size: 13px; color: var(--text2);
  background: #f9fafb; border-radius: 10px;
  padding: 10px 14px; line-height: 1.5;
  text-decoration: none;
  border: 1px solid var(--border);
}
.eval-voice:hover { background: var(--blue-lt); }

.eval-detail-btn {
  width: 100%; padding: 12px;
  background: var(--blue); color: #fff;
  border: none; border-radius: 12px;
  font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: inherit;
  transition: opacity 0.15s;
}
.eval-detail-btn:hover { opacity: 0.88; }
```

- [ ] **Step 3: App.jsx에서 EvalCard import 후 임시 렌더링으로 확인**

`src/App.jsx` 임시 테스트 코드 (확인 후 제거):
```jsx
import EvalCard from './EvalCard.jsx'

// return 안 어딘가에 임시로:
<EvalCard
  apt={{
    aptNm: '테스트아파트',
    dong: '목동',
    regionName: '양천구',
    buildYear: '2010',
    recentAvg: 85000,
    direction: '↑ 상승세',
    priceLabel: '비쌈',
    lifeConditions: [
      { icon: '🚇', text: '5호선 목동역 도보 5분' },
      { icon: '🏫', text: '목동 학원가 최강 학군' },
    ],
    verdict: '학군 프리미엄이 가격에 반영됨',
    voice: { link: '#', description: '아이 키우기 정말 좋아요' },
  }}
  onDetail={() => alert('상세 보기')}
/>
```

기대: 카드가 화면에 정상 렌더링, 스타일 깨짐 없음

- [ ] **Step 4: 임시 테스트 코드 제거 후 커밋**

```bash
git add src/EvalCard.jsx src/index.css src/App.jsx
git commit -m "feat: EvalCard 컴포넌트 신규 작성"
```

---

## Task 4: DetailReport 컴포넌트 (3탭) 신규 작성

**Files:**
- Create: `src/DetailReport.jsx`
- Modify: `src/index.css` (DetailReport 스타일 추가)

기존 `AptDetailView` + `Stories` 컴포넌트를 흡수해서 3탭으로 재구성.

받는 props:
```
apt: { aptNm, dong, regionName, buildYear, bjdCode, addr }
onBack: () => void
```

- [ ] **Step 1: `src/DetailReport.jsx` 파일 생성**

```jsx
// src/DetailReport.jsx
import { useState, useEffect, useRef } from 'react'
import { fP, fR, getYM, nameSim, getLifeConditions } from './utils.js'
import { DONG } from './data.js'

const TABS = ['가격', '동네', '이야기']

export default function DetailReport({ apt, onBack }) {
  const [tab, setTab] = useState('가격')

  return (
    <div className="detail-report">
      <div className="detail-header">
        <button className="detail-back" onClick={onBack}>← 뒤로</button>
        <div className="detail-title">
          <div className="detail-apt-name">{apt.aptNm}</div>
          <div className="detail-apt-loc">{apt.dong} · {apt.regionName}</div>
        </div>
      </div>

      <div className="detail-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`detail-tab${tab === t ? ' on' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="detail-body">
        {tab === '가격'    && <PriceTab apt={apt} />}
        {tab === '동네'    && <NeighborhoodTab dong={apt.dong} />}
        {tab === '이야기'  && <StoriesTab aptNm={apt.aptNm} dong={apt.dong} />}
      </div>
    </div>
  )
}

/* ── 가격 탭 ─────────────────────────────── */
function PriceTab({ apt }) {
  const [trades, setTrades] = useState(null)
  const [months, setMonths] = useState(3)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!apt?.bjdCode) return
    const lawdCd = apt.bjdCode.slice(0, 5)
    const ymList = getYM(months)
    setLoading(true)
    Promise.all(
      ymList.map(ym =>
        fetch(`/api/trade?lawdCd=${lawdCd}&dealYmd=${ym}`)
          .then(r => r.json())
          .catch(() => null)
      )
    ).then(results => {
      const all = []
      results.forEach(data => {
        if (!data) return
        const items = data?.response?.body?.items?.item
        if (!items) return
        const arr = Array.isArray(items) ? items : [items]
        arr.forEach(item => {
          const nm   = (item.aptNm || '').trim()
          const amt  = parseInt((item.dealAmount || '').replace(/,/g, ''))
          const area = parseFloat(item.excluUseAr) || 0
          const date = `${item.dealYear}-${String(item.dealMonth).padStart(2,'0')}-${String(item.dealDay).padStart(2,'0')}`
          const floor = item.floor || '-'
          if (nameSim(nm, apt.aptNm) < 0.6 || isNaN(amt)) return
          all.push({ date, amt, area, floor, nm })
        })
      })
      all.sort((a, b) => b.date.localeCompare(a.date))
      setTrades(all)
      setLoading(false)
    })
  }, [apt, months])

  if (loading) return <div className="detail-loading">실거래 데이터 불러오는 중...</div>
  if (!trades) return null

  const avg = trades.length ? Math.round(trades.reduce((s, t) => s + t.amt, 0) / trades.length) : 0
  const minP = trades.length ? Math.min(...trades.map(t => t.amt)) : 0
  const maxP = trades.length ? Math.max(...trades.map(t => t.amt)) : 0

  return (
    <div className="price-tab">
      <div className="price-tab-months">
        {[3, 6, 12].map(m => (
          <button
            key={m}
            className={`months-btn${months === m ? ' on' : ''}`}
            onClick={() => setMonths(m)}
          >
            {m}개월
          </button>
        ))}
      </div>

      {trades.length > 0 ? (
        <>
          <div className="price-tab-summary">
            <div className="price-summary-item">
              <div className="price-summary-label">평균</div>
              <div className="price-summary-val">{fP(avg)}</div>
            </div>
            <div className="price-summary-item">
              <div className="price-summary-label">범위</div>
              <div className="price-summary-val">{fR(minP, maxP)}</div>
            </div>
            <div className="price-summary-item">
              <div className="price-summary-label">거래</div>
              <div className="price-summary-val">{trades.length}건</div>
            </div>
          </div>

          <div className="trade-list">
            {trades.map((t, i) => (
              <div key={i} className="trade-row">
                <div className="trade-date">{t.date}</div>
                <div className="trade-amt">{fP(t.amt)}</div>
                <div className="trade-meta">{t.area.toFixed(0)}㎡ · {t.floor}층</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="detail-empty">최근 {months}개월 거래 내역이 없습니다</div>
      )}
    </div>
  )
}

/* ── 동네 탭 ─────────────────────────────── */
function NeighborhoodTab({ dong }) {
  const d = DONG[dong] || {}
  const conditions = getLifeConditions(dong)

  return (
    <div className="neighborhood-tab">
      {conditions.length > 0 ? (
        <div className="nbr-list">
          {conditions.map((item, i) => (
            <div key={i} className="nbr-row">
              <span className="nbr-icon">{item.icon}</span>
              <span className="nbr-text">{item.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="detail-empty">동네 정보를 준비 중입니다</div>
      )}

      {d.tag && (
        <div className="nbr-tag-row">
          <span className="nbr-tag">{d.tag}</span>
        </div>
      )}
    </div>
  )
}

/* ── 이야기 탭 ───────────────────────────── */
function StoriesTab({ aptNm, dong }) {
  const [stories, setStories] = useState(null)
  const [loading, setLoading] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    setLoading(true)
    fetch(`/api/stories?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`)
      .then(r => r.json())
      .then(data => { setStories(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setStories([]); setLoading(false) })
  }, [aptNm, dong])

  if (loading) return <div className="detail-loading">블로그 후기 불러오는 중...</div>
  if (!stories || stories.length === 0) return <div className="detail-empty">실거주 후기를 찾지 못했습니다</div>

  return (
    <div className="stories-tab">
      {stories.map((s, i) => (
        <a key={i} className="story-card" href={s.link} target="_blank" rel="noopener noreferrer">
          <div className="story-card-title">{s.title}</div>
          {s.description && <div className="story-card-desc">{s.description}</div>}
          <div className="story-card-meta">{s.source}{s.date ? ` · ${s.date}` : ''}</div>
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `src/index.css` 에 DetailReport 스타일 추가 (파일 끝에 append)**

```css
/* ─── DETAIL REPORT ─── */
.detail-report { display: flex; flex-direction: column; gap: 0; }

.detail-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0 16px;
}
.detail-back {
  background: none; border: none; font-size: 14px;
  color: var(--blue); cursor: pointer; font-family: inherit;
  font-weight: 600; white-space: nowrap;
}
.detail-apt-name { font-size: 17px; font-weight: 800; }
.detail-apt-loc  { font-size: 12px; color: var(--muted); margin-top: 2px; }

.detail-tabs {
  display: flex; gap: 0;
  background: var(--card); border-radius: 12px;
  border: 1px solid var(--border); overflow: hidden; margin-bottom: 16px;
}
.detail-tab {
  flex: 1; padding: 11px 0;
  border: none; background: none;
  font-size: 14px; font-weight: 600; color: var(--muted);
  cursor: pointer; font-family: inherit;
}
.detail-tab.on { background: var(--blue); color: #fff; }

.detail-body { min-height: 200px; }
.detail-loading { padding: 40px; text-align: center; color: var(--muted); font-size: 14px; }
.detail-empty   { padding: 40px; text-align: center; color: var(--muted); font-size: 14px; }

/* 가격 탭 */
.price-tab-months { display: flex; gap: 8px; margin-bottom: 16px; }
.months-btn {
  padding: 6px 16px; border-radius: 20px;
  border: 1px solid var(--border); background: var(--card);
  font-size: 13px; font-weight: 600; color: var(--muted);
  cursor: pointer; font-family: inherit;
}
.months-btn.on { background: var(--blue); color: #fff; border-color: var(--blue); }

.price-tab-summary {
  display: flex; gap: 0;
  background: var(--blue-lt); border-radius: 12px;
  padding: 14px; margin-bottom: 16px;
}
.price-summary-item { flex: 1; text-align: center; }
.price-summary-label { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
.price-summary-val   { font-size: 15px; font-weight: 800; color: var(--text); }

.trade-list { display: flex; flex-direction: column; gap: 8px; }
.trade-row  {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--card); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 14px;
}
.trade-date { font-size: 12px; color: var(--muted); }
.trade-amt  { font-size: 15px; font-weight: 800; color: var(--text); }
.trade-meta { font-size: 12px; color: var(--muted); }

/* 동네 탭 */
.nbr-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.nbr-row  { display: flex; align-items: flex-start; gap: 10px; }
.nbr-icon { font-size: 20px; line-height: 1; }
.nbr-text { font-size: 14px; color: var(--text2); line-height: 1.5; }
.nbr-tag-row { margin-top: 8px; }
.nbr-tag {
  display: inline-block;
  background: var(--blue-md); color: var(--blue);
  font-size: 12px; font-weight: 700;
  padding: 4px 12px; border-radius: 20px;
}

/* 이야기 탭 */
.stories-tab { display: flex; flex-direction: column; gap: 10px; }
.story-card {
  display: block; text-decoration: none;
  background: var(--card); border: 1px solid var(--border);
  border-radius: 12px; padding: 14px;
}
.story-card:hover { background: var(--blue-lt); }
.story-card-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.story-card-desc  { font-size: 13px; color: var(--text2); margin-bottom: 6px; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.story-card-meta  { font-size: 11px; color: var(--muted); }
```

- [ ] **Step 3: 커밋**

```bash
git add src/DetailReport.jsx src/index.css
git commit -m "feat: DetailReport 컴포넌트 (가격/동네/이야기 3탭) 신규 작성"
```

---

## Task 5: App.jsx 전면 교체 — 새 진입점 및 흐름 연결

**Files:**
- Modify: `src/App.jsx` (전면 교체)

이 태스크에서 기존 지역탐색 UX / 스코어 랭킹 / RCard / RegionResults 등을 전부 제거하고,
검색 → EvalCard 목록 → DetailReport 흐름으로 교체한다.

- [ ] **Step 1: `src/App.jsx` 전체를 아래로 교체**

```jsx
// src/App.jsx
import { useState, useCallback } from 'react'
import { DONG, HINT_SEARCHES } from './data.js'
import { fP, getYM, getLifeConditions, getVerdict, calcPriceSignal, nameSim } from './utils.js'
import EvalCard from './EvalCard.jsx'
import DetailReport from './DetailReport.jsx'

/* ── 검색 API 호출 후 EvalCard에 필요한 데이터 조립 ── */
async function buildEvalData(apt) {
  // 1) apt-info로 bjdCode(lawdCd) 확보
  const infoRes = await fetch(`/api/apt-info?kaptCode=${apt.kaptCode}`).then(r => r.json()).catch(() => null)
  const bjdCode = infoRes?.data?.bjdCode || null
  if (!bjdCode) return null

  const lawdCd = bjdCode.slice(0, 5)
  const ymList = getYM(6) // 6개월치

  // 2) 실거래 데이터
  const tradeResults = await Promise.all(
    ymList.map(ym =>
      fetch(`/api/trade?lawdCd=${lawdCd}&dealYmd=${ym}`)
        .then(r => r.json())
        .catch(() => null)
    )
  )

  const allTrades = []
  tradeResults.forEach(data => {
    if (!data) return
    const items = data?.response?.body?.items?.item
    if (!items) return
    const arr = Array.isArray(items) ? items : [items]
    arr.forEach(item => {
      const nm  = (item.aptNm || '').trim()
      const amt = parseInt((item.dealAmount || '').replace(/,/g, ''))
      if (nameSim(nm, apt.kaptName) < 0.6 || isNaN(amt)) return
      allTrades.push({ amt, area: parseFloat(item.excluUseAr) || 0 })
    })
  })

  // 3) 가격 신호 계산 (앞 3개월 vs 뒤 3개월)
  const recent = allTrades.slice(0, Math.ceil(allTrades.length / 2))
  const older  = allTrades.slice(Math.ceil(allTrades.length / 2))
  const { recentAvg, olderAvg, direction } = calcPriceSignal(recent, older)

  // 4) 가격 레이블 (동 내 유사 평형 대비 — 현재는 간소화: 6억 기준)
  let priceLabel = '적정'
  if (recentAvg > 80000) priceLabel = '비쌈'
  else if (recentAvg < 40000) priceLabel = '저렴'

  // 5) 동 추출 (addr: "서울특별시 양천구 목동")
  const addrParts = (apt.addr || '').split(' ')
  const dong = addrParts[addrParts.length - 1] || ''
  const regionName = addrParts[addrParts.length - 2] || ''

  // 6) 생활 여건 / 한줄 판단
  const lifeConditions = getLifeConditions(dong)
  const tag = (DONG[dong] || {}).tag || ''
  const verdict = getVerdict(tag, priceLabel)

  // 7) 실거주 이야기 (첫 번째 1개만 voice로)
  const storiesRes = await fetch(`/api/stories?aptName=${encodeURIComponent(apt.kaptName)}&location=${encodeURIComponent(dong)}`)
    .then(r => r.json()).catch(() => [])
  const voice = Array.isArray(storiesRes) && storiesRes.length > 0 ? storiesRes[0] : null

  return {
    kaptCode: apt.kaptCode,
    aptNm: apt.kaptName,
    dong,
    regionName,
    buildYear: apt.kaptBuldYy || '-',
    bjdCode,
    addr: apt.addr,
    recentAvg,
    direction,
    priceLabel,
    lifeConditions,
    verdict,
    voice,
  }
}

/* ── 메인 앱 ─────────────────────────────── */
export default function App() {
  const [query, setQuery]         = useState('')
  const [searchList, setSearchList] = useState(null) // 검색 결과 raw
  const [cards, setCards]         = useState([])     // EvalCard 데이터 목록
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [detailApt, setDetailApt] = useState(null)   // 상세 보기할 apt

  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setCards([])
    setDetailApt(null)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then(r => r.json())
      const list = Array.isArray(res) ? res.slice(0, 5) : []
      if (list.length === 0) { setError('검색 결과가 없습니다'); setLoading(false); return }

      const results = await Promise.all(list.map(apt => buildEvalData(apt)))
      setCards(results.filter(Boolean))
    } catch (e) {
      setError('데이터를 불러오는 중 오류가 발생했습니다')
    }
    setLoading(false)
  }, [])

  // 상세 리포트 보기
  if (detailApt) {
    return (
      <div className="app">
        <header>
          <div className="brand">수근수근 집구하기</div>
          <div className="brand-sub">온라인 임장 도구</div>
        </header>
        <DetailReport apt={detailApt} onBack={() => setDetailApt(null)} />
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <div className="brand">수근수근 집구하기</div>
        <div className="brand-sub">아파트 이름을 검색하면 가격·동네·실거주 후기를 한 번에</div>
      </header>

      {/* 검색창 */}
      <div className="search-wrap">
        <input
          className="search-input"
          type="text"
          placeholder="아파트 이름 검색 (예: 래미안 원베일리)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
        />
        <button className="search-btn" onClick={() => handleSearch(query)}>검색</button>
      </div>

      {/* 힌트 검색어 */}
      {!cards.length && !loading && (
        <div className="hint-searches">
          {HINT_SEARCHES.map(h => (
            <button key={h} className="hint-chip" onClick={() => { setQuery(h); handleSearch(h) }}>
              {h}
            </button>
          ))}
        </div>
      )}

      {/* 로딩 */}
      {loading && <div className="loading-msg">임장 데이터 수집 중...</div>}

      {/* 에러 */}
      {error && <div className="error-msg">{error}</div>}

      {/* 카드 목록 */}
      {cards.length > 0 && (
        <div className="card-list">
          {cards.map((apt, i) => (
            <EvalCard key={i} apt={apt} onDetail={() => setDetailApt(apt)} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `src/index.css` 에 검색창 / 힌트칩 / 카드목록 스타일 추가 (파일 끝에 append)**

```css
/* ─── SEARCH ─── */
.search-wrap {
  display: flex; gap: 8px;
}
.search-input {
  flex: 1; padding: 13px 16px;
  border: 1.5px solid var(--border); border-radius: 12px;
  font-size: 15px; font-family: inherit; color: var(--text);
  background: var(--card);
  outline: none; transition: border-color 0.15s;
}
.search-input:focus { border-color: var(--blue); }
.search-btn {
  padding: 13px 20px;
  background: var(--blue); color: #fff;
  border: none; border-radius: 12px;
  font-size: 15px; font-weight: 700; font-family: inherit;
  cursor: pointer; white-space: nowrap;
  transition: opacity 0.15s;
}
.search-btn:hover { opacity: 0.88; }

.hint-searches { display: flex; flex-wrap: wrap; gap: 8px; }
.hint-chip {
  padding: 6px 14px; border-radius: 20px;
  border: 1px solid var(--border); background: var(--card);
  font-size: 13px; color: var(--text2); cursor: pointer;
  font-family: inherit; transition: all 0.15s;
}
.hint-chip:hover { background: var(--blue-lt); border-color: var(--blue); color: var(--blue); }

.loading-msg { text-align: center; color: var(--muted); font-size: 14px; padding: 20px; }
.error-msg   { text-align: center; color: var(--red);   font-size: 14px; padding: 20px; }

.card-list { display: flex; flex-direction: column; gap: 16px; }
```

- [ ] **Step 3: 기존 불필요한 CSS 제거**

`src/index.css`에서 아래 클래스 블록 제거 (이미 사용하지 않게 됨):
- `.mode-tabs`, `.mode-tab`
- `.rcard`, `.rcard-*`
- `.region-*`, `.preset-*`
- `.results`, `.res-summary`
- `.top3`, `.apt-list`, `.apt-row`, `.apt-*`
- `.vibe-*`
- `.stories-section`, `.story-item` (`.story-card`로 교체됨)

- [ ] **Step 4: 앱 실행 후 전체 플로우 확인**

실행: `npm run dev`
확인:
1. 검색창 + 힌트칩 표시 ✓
2. 검색 후 EvalCard 목록 표시 ✓
3. "자세히 보기" 클릭 → DetailReport 표시 ✓
4. "← 뒤로" → 카드 목록 복귀 ✓
5. 가격/동네/이야기 탭 전환 ✓

- [ ] **Step 5: 커밋**

```bash
git add src/App.jsx src/index.css
git commit -m "feat: App.jsx 전면 교체 — 검색→EvalCard→DetailReport 플로우로 리빌드"
```

---

## Task 6: 최종 검수 및 배포

**Files:**
- Modify: `PRODUCT.prd` (다음 스텝 체크)

- [ ] **Step 1: 전체 플로우 시나리오 테스트**

| 시나리오 | 확인 |
|----------|------|
| "래미안 원베일리" 검색 → 카드 1개 표시 | |
| "목동" 검색 → 복수 카드 표시 | |
| EvalCard: 한줄판단·가격신호·생활여건 표시 | |
| 자세히 보기 → 가격 탭: 거래 목록 | |
| 동네 탭: 교통·학군 정보 | |
| 이야기 탭: 블로그 링크 | |
| 뒤로 → 카드 목록 복귀 | |
| 검색 결과 없음 처리 | |

- [ ] **Step 2: Vercel 배포**

```bash
npm run build
# Vercel은 git push로 자동 배포 (vercel.json 설정 확인)
git add -A
git commit -m "chore: 온라인 임장 리빌드 완료"
git push origin main
```

- [ ] **Step 3: 배포 URL에서 모바일 확인**

- 모바일 폭(375px)에서 카드 레이아웃 깨짐 없는지 확인
- 탭 전환 터치 동작 확인

---

## 셀프 리뷰

**스펙 커버리지 확인:**
- ✅ 검색 진입점 (Task 5)
- ✅ 집 평가 카드: 한줄판단/가격신호/생활여건/실거주한마디 (Task 3)
- ✅ 가격 신호 변환 규칙 (Task 2 utils.js)
- ✅ 한줄 판단 생성 규칙 (Task 2 utils.js getVerdict)
- ✅ 상세 임장 리포트 3탭 (Task 4)
- ✅ 기존 스코어 숫자 제거 (Task 5 App.jsx 교체)
- ✅ 기존 지역탐색 UX 제거 (Task 5 App.jsx 교체)

**타입 일관성:**
- `getLifeConditions(dong)` → `[{ icon, text }]` — Task 2, 3, 4 모두 동일하게 사용 ✓
- `getVerdict(tag, priceLabel)` → `string` — Task 2, 5 동일 ✓
- `calcPriceSignal(recent, older)` → `{ recentAvg, olderAvg, direction }` — Task 2, 5 동일 ✓
- `EvalCard` props 구조 — Task 3 정의, Task 5에서 동일하게 생성 ✓
