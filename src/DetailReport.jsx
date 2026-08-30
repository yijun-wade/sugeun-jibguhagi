// src/DetailReport.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { fP, fR, getYM, formatDealDate, nameSim } from './utils.js'
import { FETCH_TIMEOUT, MIN_AREA_SQM, SQM_TO_PYEONG, KR_LAT, KR_LON } from './constants.js'
import { track } from './analytics.js'
import { isCollected, toggleCollection, getCollection } from './collection.js'
import { buildDelta } from './collection-delta.js'
import { isSubscribed, subscribeRegion, getInterest } from './interest.js'
import SimilarApts from './SimilarApts.jsx'
import ViewedCompare from './ViewedCompare.jsx'
import { Link, useNavigate } from 'react-router-dom'

function isValidUrl(url) {
  try { const { protocol } = new URL(url); return protocol === 'http:' || protocol === 'https:' }
  catch { return false }
}

const TABS = ['동네·이야기', '시세']

// 가격 방향(↑상승/→보합/↓하락) → 색상 클래스
const dirClass = (d) => d?.includes('상승') ? 'up' : d?.includes('하락') ? 'down' : 'flat'

export default function DetailReport({ apt, onBack, onCollectionChange }) {
  const navigate = useNavigate()
  const [tab, setTab] = useState('동네·이야기')
  const [toast, setToast] = useState(null) // 'share' | 'uncollect' | null
  // 저장 직후 인라인 확인 블록 — 토스트와 달리 사라지지 않는다(즉시 보상 노출).
  const [justSaved, setJustSaved] = useState(false)
  const [subscribed, setSubscribed] = useState(() => isSubscribed(apt.dong))
  const [subFull, setSubFull] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  // 현재 집 제외 본 집(마운트 스냅샷). 진입 바 노출 판정 + 모달 공급.
  const [otherViewed] = useState(() => getInterest().filter(a => a.kaptCode !== apt.kaptCode))
  const [collected, setCollected] = useState(() => isCollected(apt.kaptCode))
  // 이전 페이지들에서 이미 담은 '다른' 집 — 착지자 심리 분기용(마운트 시점 스냅샷).
  // 0곳=그 단지만 검색해 온 신규(결정 유보 프레이밍), 1곳+=여러 집 둘러보는 중(비교 완성 프레이밍).
  const [otherSaved] = useState(() => getCollection().filter(a => a.kaptCode !== apt.kaptCode))
  // 저장 시점 스냅샷 대비 변동. 마운트 시 1회 고정(저장/해제로 재계산되면 방금 저장한 값과 비교하게 됨).
  const [delta] = useState(() => {
    const saved = getCollection().find(a => a.kaptCode === apt.kaptCode)
    return buildDelta(saved, apt.recentAvg)
  })
  // 유사단지 데이터를 상단에서 미리 조회 → 상단 넛지 + 하단 리스트가 공유(중복 fetch 없음).
  const [similarItems, setSimilarItems] = useState(null) // null=로딩, []=없음
  const similarRef = useRef(null)

  useEffect(() => {
    if (!apt.kaptCode) return
    let alive = true
    const params = new URLSearchParams({ kaptCode: apt.kaptCode })
    if (apt.recentAvg) params.set('avg', String(apt.recentAvg))
    if (apt.regionName) params.set('gu', apt.regionName)
    fetch(`/api/nearby?${params.toString()}`)
      .then(r => r.json())
      .then(data => { if (alive) setSimilarItems(Array.isArray(data) ? data : []) })
      .catch(() => { if (alive) setSimilarItems([]) })
    return () => { alive = false }
  }, [apt.kaptCode, apt.recentAvg, apt.regionName])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (!delta) return
    track('delta_strip_view', {
      apt_name: apt.aptNm,
      days: delta.days,
      level: delta.level,
      diff_pct: delta.diffPct,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delta])

  // 리치 공유 — 모바일 네이티브 공유시트(카톡 포함). 데스크톱은 링크 복사로 폴백.
  // 공유가 네이버 밖 유입을 만들어 오가닉 단일의존 리스크를 완화.
  const handleShareRich = useCallback(async () => {
    const url = `${window.location.origin}/apt/${apt.kaptCode}`
    const hasVerdict = apt.verdict && apt.verdict !== '실거래 데이터 없음'
    const text = hasVerdict
      ? `${apt.aptNm} (${apt.dong}) — ${apt.verdict}`
      : `${apt.aptNm} (${apt.dong}) 동네 이야기·실거래가 한눈에`
    track('share_click', { apt_name: apt.aptNm, from: 'verdict_hero', method: navigator.share ? 'web_share' : 'clipboard' })
    if (navigator.share) {
      try { await navigator.share({ title: `${apt.aptNm} — 살만한 동네일까?`, text, url }) } catch { /* 사용자 취소 */ }
    } else {
      try { await navigator.clipboard.writeText(`${text}\n${url}`) } catch { /* noop */ }
      setToast('share')
    }
  }, [apt])

  const handleCollect = useCallback(() => {
    const next = toggleCollection(apt)
    const saving = !collected
    setCollected(saving)
    track(saving ? 'collect_save' : 'collect_remove', {
      apt_name: apt.aptNm,
      region: apt.regionName,
      has_delta_shown: !!delta,
      other_saved: otherSaved.length,
    })
    onCollectionChange?.(next)
    // 저장 성공은 인라인 확인 블록이 대신한다(사라지는 토스트로는 보상이 안 됨). 해제만 토스트.
    setJustSaved(saving)
    if (!saving) setToast('uncollect')
  }, [apt, collected, onCollectionChange, delta, otherSaved])

  return (
    <div className="detail-report">
      {/* 토스트는 눈으로만 보였고 스크린리더에는 저장·해제·공유 결과가 전혀 안 읽혔다.
          리전을 조건부로 만들면 갱신이 일관되게 안 읽히므로, 빈 채로 항상 두고 안쪽 글만 바꾼다.
          긴급한 오류가 아니므로 alert가 아니라 polite(role="status")다. */}
      <div className="sr-only" role="status">
        {toast === 'share' ? '링크를 복사했습니다.'
          : toast === 'uncollect' ? `${apt.aptNm}을(를) 저장 목록에서 뺐습니다.`
          : justSaved ? `${apt.aptNm}을(를) 저장했습니다.` : ''}
      </div>
      {toast === 'share' && (
        <div className="collect-toast" aria-hidden="true">링크 복사 완료! 원하는 곳에 공유하세요.</div>
      )}
      {toast === 'uncollect' && (
        <div className="collect-toast" aria-hidden="true">저장 목록에서 뺐어요</div>
      )}
      <div className="detail-header">
        <button className="detail-back" aria-label="목록으로 돌아가기" onClick={onBack}>← 뒤로</button>
        <div className="detail-title">
          <div className="detail-apt-name">{apt.aptNm}</div>
          <div className="detail-apt-loc">{apt.dong} · {apt.regionName}</div>
        </div>
        <div className="detail-header-actions">
          <button className={`collect-btn${collected ? ' collected' : ''}`} aria-label={collected ? `${apt.aptNm} 저장 취소` : `${apt.aptNm} 저장`} onClick={() => { track('detail_collect_click', { apt_name: apt.aptNm, from: 'header' }); handleCollect() }}>
            {collected ? '✓ 저장됨' : '★ 저장'}
          </button>
        </div>
      </div>

      {/* 델타 스트립 — 저장자 재방문 보상. 저장 시점 baseline은 갱신하지 않는다. */}
      {delta && (
        <div className={`delta-strip ${delta.level}`}>
          <span className="delta-strip-icon" aria-hidden="true">★</span>
          <span className="delta-strip-text">
            {delta.level === 'fresh' ? (
              <>오늘 저장했어요 · 변동 생기면 여기서 알려드릴게요</>
            ) : delta.level === 'flat' ? (
              <>{delta.stale ? '6개월 전' : `${delta.days}일 전`} 저장 · 큰 변동 없어요 ({fP(delta.to)} 유지)</>
            ) : (
              <>
                {delta.stale ? '6개월 전' : `${delta.days}일 전`} 저장 · {fP(delta.from)} → {fP(delta.to)}{' '}
                <b className="delta-strip-diff">
                  {delta.level === 'up' ? '▲' : '▼'}{fP(Math.abs(delta.diff))}
                </b>
              </>
            )}
          </span>
        </div>
      )}

      {/* 살만해요? 종합 버디트 히어로 — SEO 착지 첫 화면 훅 + 공유 유도 */}
      {apt.verdict && apt.verdict !== '실거래 데이터 없음' && (
        <div className="verdict-hero">
          <div className="verdict-badge">이 단지, 살만해요?</div>
          <p className="verdict-line">{apt.verdict}</p>
          {apt.priceJudgment?.sentence && (
            <p className="verdict-price">{apt.priceJudgment.sentence}</p>
          )}
          <button type="button" className="verdict-share" onClick={handleShareRich}>
            <span aria-hidden="true">💬</span> 친구에게 공유
          </button>
        </div>
      )}

      {/* 가격신호 바 — 검색의도(실거래가) 첫 화면 매칭. 탭과 무관하게 항상 노출 */}
      {apt.recentAvg > 0 && (
        <button
          type="button"
          className="price-signal-bar"
          onClick={() => { track('tab_switch', { tab_name: '시세', apt_name: apt.aptNm, from: 'price_signal_bar' }); setTab('시세') }}
        >
          <span className="psb-left">
            <span className="psb-label">최근 실거래가</span>
            <span className="psb-price">{fP(apt.recentAvg)}</span>
            {apt.direction && <span className={`psb-dir ${dirClass(apt.direction)}`}>{apt.direction}</span>}
          </span>
          <span className="psb-more">실거래 자세히 ›</span>
        </button>
      )}

      {/* 상단 discovery 넛지 — SEO 착지자가 실제 보는 위치에서 '막다른길' 탈출구를 노출.
          리스트 자체는 SEO 내부링크 위해 하단 유지, 여기선 진입 통로만 끌어올림. */}
      {similarItems && similarItems.length > 0 && (
        <button
          type="button"
          className="discover-nudge"
          onClick={() => {
            track('discover_nudge_click', { apt_name: apt.aptNm, from: 'detail_top', count: similarItems.length })
            similarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          <span className="discover-nudge-icon" aria-hidden="true">🏘</span>
          <span className="discover-nudge-text">
            <span className="discover-nudge-title">이 근처 비슷한 값 단지 {similarItems.length}곳</span>
            <span className="discover-nudge-sub">
              {apt.recentAvg > 0
                ? `${apt.regionName || '이 근처'} · 이 집과 값이 비슷한 순`
                : `같은 ${apt.regionName || '이 근처'} · 규모 큰 단지 순`}
            </span>
          </span>
          <span className="discover-nudge-arrow" aria-hidden="true">↓</span>
        </button>
      )}

      {/* 최근 본 집 비교 진입 — 리텐션 게이트(자동 캐처 기반). 본 집 2곳↑(현재 포함)일 때. */}
      {otherViewed.length >= 1 && (
        <button
          type="button"
          className="viewed-compare-bar"
          onClick={() => {
            track('compare_open', { from: 'apt_detail_viewed', count: Math.min(otherViewed.length + 1, 5) })
            setShowCompare(true)
          }}
        >
          <span className="viewed-compare-icon" aria-hidden="true">🗂</span>
          <span className="viewed-compare-text">최근 본 집 {Math.min(otherViewed.length + 1, 5)}곳 비교</span>
          <span className="viewed-compare-arrow" aria-hidden="true">→</span>
        </button>
      )}
      {showCompare && (
        <ViewedCompare
          apts={(() => {
            const stored = getInterest().find(a => a.kaptCode === apt.kaptCode)
            const current = {
              kaptCode: apt.kaptCode,
              aptNm: apt.aptNm,
              dong: apt.dong,
              gu: apt.regionName,
              avg: apt.recentAvg,
              direction: apt.direction,
              verdict: apt.verdict,
              ts: stored?.ts || Date.now(),
              prevAvg: stored?.prevAvg,
              prevTs: stored?.prevTs,
            }
            return [current, ...otherViewed]
          })()}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* 동네 구독(리텐션 관문) — 스크롤 없이 보이는 상단으로 끌어올림.
          기존엔 유사단지 아래 맨 밑에 묻혀 seed CTR ~1%였음. post-save 구독 경로(save-confirm)는 별도 유지. */}
      {apt.dong ? (
        <div className={`region-sub${subscribed ? ' on' : ''}`}>
          <span className="region-sub-icon" aria-hidden="true">📰</span>
          <span className="region-sub-text">
            <span className="region-sub-title">
              {subscribed ? `✓ ${apt.dong} 저장됨` : `${apt.dong} 저장 — 새 거래·소식 매일 정리`}
            </span>
            <span className="region-sub-sub">
              {subFull
                ? '저장한 동네가 5곳이에요. 브리핑에서 하나 지우고 다시 시도해 주세요.'
                : subscribed
                  ? '속닥속닥 뉴스에서 매일 챙겨드려요'
                  : '저장하면 이 동네 흐름을 매일 정리해드려요'}
            </span>
          </span>
          {subscribed ? (
            <Link
              to="/briefing"
              className="region-sub-go"
              onClick={() => track('briefing_seed_click', { from: 'apt_detail', dong: apt.dong, subscribed: true })}
            >
              오늘 소식 ›
            </Link>
          ) : (
            <button
              type="button"
              className="region-sub-btn"
              onClick={() => {
                const ok = subscribeRegion({ gu: apt.regionName, dong: apt.dong }, 'apt_detail')
                if (ok) { setSubscribed(true); setSubFull(false) } else { setSubFull(true) }
              }}
            >
              저장
            </button>
          )}
        </div>
      ) : (
        <Link
          to="/briefing"
          className="briefing-seed"
          onClick={() => track('briefing_seed_click', { from: 'apt_detail', dong: '' })}
        >
          <span className="briefing-seed-icon" aria-hidden="true">📰</span>
          <span className="briefing-seed-text">
            <span className="briefing-seed-title">부동산 소식, 매일 정리해드려요</span>
            <span className="briefing-seed-sub">속닥속닥 뉴스에서 오늘 흐름 한눈에</span>
          </span>
          <span className="briefing-seed-arrow" aria-hidden="true">›</span>
        </Link>
      )}

      {/* APG 탭 패턴. 전에는 aria-pressed라 토글 버튼 3개로 읽혔고,
          "3개 중 몇 번째"도 "고르면 아래가 바뀐다"도 전달되지 않았다.
          roving tabindex — 선택된 탭만 Tab 순서에 들어가고, 좌우 화살표로 이동한다. */}
      <div className="detail-tabs" role="tablist" aria-label="단지 정보 분류">
        {TABS.map((t, i) => (
          <button
            key={t}
            id={`detail-tab-${i}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls={`detail-panel-${i}`}
            tabIndex={tab === t ? 0 : -1}
            className={`detail-tab${tab === t ? ' on' : ''}`}
            onKeyDown={(e) => {
              const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
              if (!dir) return
              e.preventDefault()
              const next = (i + dir + TABS.length) % TABS.length
              setTab(TABS[next])
              document.getElementById(`detail-tab-${next}`)?.focus()
            }}
            onClick={() => { track('tab_switch', { tab_name: t, apt_name: apt.aptNm }); setTab(t) }}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        className="detail-body"
        role="tabpanel"
        id={`detail-panel-${TABS.indexOf(tab)}`}
        aria-labelledby={`detail-tab-${TABS.indexOf(tab)}`}
        tabIndex={0}
      >
        {tab === '시세'       && <PriceTab apt={apt} />}
        {tab === '동네·이야기' && <NeighborhoodStoriesTab dong={apt.dong} aptNm={apt.aptNm} addr={apt.addr} apt={apt} />}
      </div>

      {/* 콘텐츠 끝 큰 수집 CTA — 미수집 상태에서만 노출.
          착지자 맥락으로 카피 분기: 담은 집 0곳=결정 유보, 1곳+=비교 완성. */}
      {!collected && (
        <button
          type="button"
          className="collect-cta-card"
          onClick={() => {
            track('detail_collect_click', {
              apt_name: apt.aptNm,
              from: 'cta_card',
              variant: otherSaved.length > 0 ? 'compare' : 'defer',
              has_saved: otherSaved.length,
            })
            handleCollect()
          }}
        >
          <span className="collect-cta-icon" aria-hidden="true">★</span>
          <span className="collect-cta-text">
            {otherSaved.length > 0 ? (
              <>
                <span className="collect-cta-title">
                  {otherSaved[0].aptNm}{otherSaved.length > 1 ? ` 외 ${otherSaved.length - 1}곳` : ''} 담는 중 · 이 집도 같이 볼까요?
                </span>
                <span className="collect-cta-sub">저장한 집끼리 나란히 비교돼요</span>
              </>
            ) : (
              <>
                <span className="collect-cta-title">이 단지 거래 올라오면 여기서 알려드릴게요</span>
                <span className="collect-cta-sub">다시 오면 저장할 때랑 얼마나 달라졌는지 보여드려요</span>
              </>
            )}
          </span>
          <span className="collect-cta-arrow" aria-hidden="true">›</span>
        </button>
      )}

      {/* 저장 직후 인라인 확인 — 즉시 보상 + 다음 행동 2개(비교 / 동네 구독) */}
      {justSaved && (
        <div className="save-confirm">
          <div className="save-confirm-head">
            <span aria-hidden="true">✓</span> 저장했어요 — 변동 생기면 여기서 알려드릴게요
          </div>
          {otherSaved.length > 0 ? (
            <button
              type="button"
              className="save-confirm-action"
              onClick={() => {
                track('save_confirm_action', { action: 'compare', other_saved: otherSaved.length })
                navigate('/', { state: { openTab: 'collection' } })
              }}
            >
              {otherSaved[0].aptNm}{otherSaved.length > 1 ? ` 외 ${otherSaved.length - 1}곳` : ''} 담는 중 · 수집 목록에서 비교하기 ›
            </button>
          ) : (
            <div className="save-confirm-hint">한 곳 더 저장하면 나란히 비교돼요</div>
          )}
          {apt.dong && !subscribed && (
            <button
              type="button"
              className="save-confirm-action"
              onClick={() => {
                const ok = subscribeRegion({ gu: apt.regionName, dong: apt.dong }, 'save_confirm')
                // 실패(5곳 초과) 시 아래 region-sub가 사유를 설명하도록 플래그를 넘긴다.
                if (ok) { setSubscribed(true) } else { setSubFull(true) }
                track('save_confirm_action', { action: 'subscribe_region', dong: apt.dong, ok: !!ok })
              }}
            >
              📰 {apt.dong} 소식도 매일 받아볼래요? ›
            </button>
          )}
        </div>
      )}

      {/* 이 근처 비슷한 값 단지 — 막다른 페이지 탈출구(2nd 페이지뷰 + 내부링크 SEO).
          items를 상단에서 내려줘 넛지와 데이터 공유(중복 fetch 방지). ref는 넛지 스크롤 타겟. */}
      <div ref={similarRef}>
        <SimilarApts kaptCode={apt.kaptCode} avg={apt.recentAvg} gu={apt.regionName} aptNm={apt.aptNm} items={similarItems} />
      </div>

      {/* 모바일 sticky — 페이지의 유일한 1차 CTA. 공유(획득 지표)와 경쟁시키지 않는다. */}
      <div className="detail-mobile-actions">
        <button
          className={`mobile-collect-btn${collected ? ' collected' : ''}`}
          aria-label={collected ? `${apt.aptNm} 저장 취소` : `${apt.aptNm} 저장`}
          onClick={() => { track('detail_collect_click', { apt_name: apt.aptNm, from: 'mobile_sticky' }); handleCollect() }}
        >
          {collected ? '✓ 저장됨 · 변동 지켜보는 중' : '★ 저장 · 새 거래 뜨면 알려드려요'}
        </button>
      </div>
    </div>
  )
}

/* ── 아코디언 공통 컴포넌트 ─────────────────── */
function Accordion({ label, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="accordion">
      <button className="accordion-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>{label}{count != null ? ` (${count})` : ''}</span>
        <span className="accordion-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  )
}

/* ── 시세 탭 ─────────────────────────────── */
function PriceTrendChart({ data }) {
  if (!data || data.length < 2) return null
  const W = 300, H = 120
  const PAD = { t: 12, r: 16, b: 26, l: 44 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const n = data.length

  const vals = data.map(d => d.avg)
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const pad  = mean * 0.12  // 평균의 ±12% 여백 — 작은 변동이 극적으로 보이는 것 방지
  const minV = Math.min(...vals, mean - pad)
  const maxV = Math.max(...vals, mean + pad)
  const range = maxV - minV || 1

  const toX = i => PAD.l + (i / (n - 1)) * plotW
  const toY = v => PAD.t + plotH - ((v - minV) / range) * plotH

  const points = data.map((d, i) => `${toX(i)},${toY(d.avg)}`).join(' ')

  const fAmt = v => {
    const uk = v / 10000
    return uk >= 1 ? `${uk.toFixed(uk % 1 === 0 ? 0 : 1)}억` : `${Math.round(v / 1000)}천`
  }

  const monthLabel = ym => `${parseInt(ym.slice(5))}월`

  return (
    <div className="price-trend-wrap">
      <div className="price-trend-label">월별 평균 실거래가 추이</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="price-trend-svg">
        {/* 수평 가이드라인 */}
        {[minV, (minV + maxV) / 2, maxV].map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={toY(v)} x2={W - PAD.r} y2={toY(v)}
              stroke="#e4eaf4" strokeWidth="1" />
            <text x={PAD.l - 4} y={toY(v) + 4}
              textAnchor="end" fontSize="9" fill="#9ca3af">{fAmt(v)}</text>
          </g>
        ))}
        {/* 라인 */}
        <polyline points={points}
          fill="none" stroke="#2563eb" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {/* 면적 채우기 */}
        <polygon
          points={`${toX(0)},${PAD.t + plotH} ${points} ${toX(n - 1)},${PAD.t + plotH}`}
          fill="url(#priceGrad)" opacity="0.15" />
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 도트 + X축 레이블 */}
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.avg)} r="3"
              fill="#fff" stroke="#2563eb" strokeWidth="2" />
            {(i === 0 || i === n - 1 || (n <= 8 ? true : i % Math.ceil(n / 6) === 0)) && (
              <text x={toX(i)} y={H - 4}
                textAnchor="middle" fontSize="9" fill="#9ca3af">
                {monthLabel(d.ym)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

function PriceTab({ apt }) {
  const [trades, setTrades] = useState(null)
  const [months, setMonths] = useState(12)
  // 재시도용. months를 같은 값으로 다시 넣으면 React가 리렌더를 건너뛰어 재조회가 안 된다.
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [tradeError, setTradeError] = useState(false)

  useEffect(() => {
    if (!apt?.bjdCode) return
    const lawdCd = apt.bjdCode.slice(0, 5)
    const ymList = getYM(months)
    setLoading(true)
    setTradeError(false)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    Promise.all(
      ymList.map(ym =>
        fetch(`/api/trade?lawdCd=${lawdCd}&dealYmd=${ym}`, { signal: controller.signal })
          .then(r => r.json())
          .catch(() => null)
      )
    ).then(results => {
      const all = []
      results.forEach(data => {
        if (!data) return
        if (!['00', '000'].includes(data?.response?.header?.resultCode)) return
        const items = data?.response?.body?.items?.item
        if (!items) return
        const arr = Array.isArray(items) ? items : [items]
        arr.forEach(item => {
          const nm   = (item.aptNm || '').trim()
          const amt  = parseInt((item.dealAmount || '').replace(/,/g, ''), 10)
          const area = parseFloat(item.excluUseAr) || 0
          const date = formatDealDate(item.dealYear, item.dealMonth, item.dealDay)
          const floor = item.floor || '-'
          if (area < MIN_AREA_SQM || isNaN(amt) || amt === 0) return
          const pyeong = Math.round(area / SQM_TO_PYEONG)
          if (pyeong === 0) return
          const perPy = Math.round(amt / pyeong)
          if (nameSim(nm, apt.aptNm) < 0.6 || perPy === 0) return
          all.push({ date, amt, area, floor, nm, pyeong, perPy })
        })
      })
      all.sort((a, b) => b.date.localeCompare(a.date))
      setTrades(all)
    }).catch(e => {
      if (e.name !== 'AbortError') { setTradeError(true); setTrades([]) }
    }).finally(() => {
      clearTimeout(timer)
      setLoading(false)
    })
    return () => { controller.abort(); clearTimeout(timer) }
  }, [apt?.bjdCode, apt?.aptNm, months, reloadKey])

  // null = 전체. 값이 있으면 전용면적(반올림 ㎡).
  // 예전에는 "30평형대" 같은 10평 버킷이었는데, 그 안에서도 억 단위로 갈려
  // "내 예산에 맞는 평형"을 고르는 데 쓸 수 없었다.
  const [areaFilter, setAreaFilter] = useState(null)

  const filteredTrades = useMemo(() => {
    if (!trades) return trades
    if (!areaFilter) return trades
    return trades.filter(t => Math.round(t.area) === areaFilter)
  }, [trades, areaFilter])

  const avgAmt   = filteredTrades?.length ? Math.round(filteredTrades.reduce((s, t) => s + t.amt,   0) / filteredTrades.length) : 0
  const avgPerPy = filteredTrades?.length ? Math.round(filteredTrades.reduce((s, t) => s + t.perPy, 0) / filteredTrades.length) : 0

  const monthlyData = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return []
    const byMonth = {}
    filteredTrades.forEach(t => {
      const ym = t.date.slice(0, 7)
      if (!byMonth[ym]) byMonth[ym] = []
      byMonth[ym].push(t.amt)
    })
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, amts]) => ({
        ym,
        avg: Math.round(amts.reduce((s, v) => s + v, 0) / amts.length),
      }))
  }, [filteredTrades])

  const changePct = apt.olderAvg > 0
    ? Math.round((apt.recentAvg - apt.olderAvg) / apt.olderAvg * 100)
    : null
  const dirLabel = { '↑ 상승세': '오름세', '→ 보합': '보합', '↓ 하락세': '내림세' }[apt.direction] || ''
  const dirCls   = apt.direction?.includes('상승') ? 'up' : apt.direction?.includes('하락') ? 'down' : 'flat'
  const levelCls = { '높은 수준': 'high', '중간 수준': 'mid', '낮은 수준': 'low' }[apt.priceJudgment?.level] || ''

  if (!apt.bjdCode) {
    return (
      <div className="price-tab">
        <div className="detail-empty">실거래 데이터가 없는 단지입니다</div>
        <div className="listing-deeplinks">
          <div className="listing-deeplinks-label">실매물 보기</div>
          <div className="listing-deeplinks-btns">
            <a className="listing-btn naver" href={`https://search.naver.com/search.naver?query=${encodeURIComponent(apt.aptNm + ' 아파트 매물')}`} target="_blank" rel="noopener noreferrer" onClick={() => track('listing_link_click', { apt_name: apt.aptNm, service: 'naver' })}>네이버 매물검색</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="price-tab">

      {/* 상단: 가격 요약 Hero */}
      <div className="price-hero">
        <div className="price-tab-months">
          {[6, 12, 24].map(m => (
            <button key={m} className={`months-btn${months === m ? ' on' : ''}`} onClick={() => { track('price_months_change', { months: m, apt_name: apt.aptNm }); setMonths(m) }}>
              {m}개월
            </button>
          ))}
        </div>
        {apt.recentAvg > 0 ? (
          <>
            {/* 페이지 기준값 — 히어로·가격신호바·판단문장과 동일한 숫자. 필터로 바뀌지 않는다. */}
            <div className="price-hero-label">최근 3개월 평균</div>
            <div className="price-hero-main">{fP(apt.recentAvg)}</div>
            {loading ? (
              <div className="price-hero-sub">{months}개월 평균 계산 중...</div>
            ) : avgAmt > 0 ? (
              <div className="price-hero-sub">
                {months}개월 {areaFilter ? `${areaFilter}㎡` : '전체'} 평균 {fP(avgAmt)}
                {avgPerPy > 0 && <> · 평당 {fP(avgPerPy)}</>}
              </div>
            ) : null}
          </>
        ) : loading ? (
          <div className="price-hero-loading">평균가 계산 중...</div>
        ) : avgAmt > 0 ? (
          /* recentAvg가 없는 예외 단지 — 필터 평균을 대표값으로 폴백 */
          <>
            <div className="price-hero-label">{months}개월 거래 평균</div>
            <div className="price-hero-main">{fP(avgAmt)}</div>
            {avgPerPy > 0 && <div className="price-hero-sub">평당 {fP(avgPerPy)}</div>}
          </>
        ) : null}
      </div>

      {/* 중단: 해석 */}
      {!loading && (dirLabel || apt.priceJudgment?.level || changePct !== null) && (
        <div className="price-interpret">
          <div className="price-interpret-badges">
            {dirLabel && <span className={`price-dir-badge ${dirCls}`}>{dirLabel}</span>}
            {apt.priceJudgment?.level && (
              <span className={`price-ai-label ${levelCls}`}>{apt.priceJudgment.level}</span>
            )}
          </div>
          {changePct !== null && changePct !== 0 && (
            <div className="price-interpret-change">
              직전 3개월 대비 {changePct > 0 ? `+${changePct}` : `${changePct}`}%
            </div>
          )}
          {apt.priceJudgment?.level && (
            <div className="price-interpret-basis">서울·수도권 실거래 기준</div>
          )}
        </div>
      )}

      {/* 가격 추이 차트 */}
      {!loading && monthlyData.length >= 2 && (
        <PriceTrendChart data={monthlyData} />
      )}

      {/* 하단: 근거 */}
      {loading ? (
        <div className="detail-loading">실거래 데이터 불러오는 중...</div>
      ) : tradeError ? (
        <div className="detail-empty">
          거래 데이터를 불러오지 못했어요.
          <button className="detail-empty-action" onClick={() => setReloadKey(k => k + 1)}>다시 시도</button>
        </div>
      ) : !trades ? null : trades.length === 0 ? (
        // 막다른 길이 아니라 출구를 준다 — 기간만 넓히면 거래가 나오는 경우가 대부분이고,
        // 위쪽 기간 버튼을 못 본 사람은 여기서 되돌아갈 방법이 없었다.
        <div className="detail-empty">
          최근 {months}개월 거래가 없어요.
          {months < 24 && (
            <button
              className="detail-empty-action"
              onClick={() => { const next = months === 6 ? 12 : 24; track('price_months_change', { months: next, apt_name: apt.aptNm, from: 'empty' }); setMonths(next) }}
            >
              {months === 6 ? 12 : 24}개월로 넓혀보기
            </button>
          )}
        </div>
      ) : (
        <>
          {trades.length <= 2 && (
            <div className="price-sparse-warn">거래 건수가 적어 참고용으로만 확인하세요</div>
          )}

          <AreaBreakdown trades={trades} selected={areaFilter} onSelect={b => setAreaFilter(b === areaFilter ? null : b)} />

          <Accordion label={`실거래 내역 ${areaFilter ? `(${areaFilter}㎡)` : ''}`} count={filteredTrades.length} defaultOpen={filteredTrades.length <= 10}>
            <div className="trade-list">
              {filteredTrades.map((t, i) => (
                <div key={i} className="trade-row">
                  <div className="trade-date">{t.date}</div>
                  <div className="trade-col-right">
                    <div className="trade-amt">{fP(t.amt)}</div>
                    <div className="trade-per-py">{fP(t.perPy)}/평</div>
                  </div>
                  <div className="trade-meta">{t.area.toFixed(0)}㎡ · 약 {t.pyeong}평형 · {t.floor}층</div>
                </div>
              ))}
            </div>
          </Accordion>

          <div className="listing-deeplinks">
            <div className="listing-deeplinks-label">실매물 보기</div>
            <div className="listing-deeplinks-btns">
              <a className="listing-btn naver" href={`https://search.naver.com/search.naver?query=${encodeURIComponent(apt.aptNm + ' 아파트 매물')}`} target="_blank" rel="noopener noreferrer" onClick={() => track('listing_link_click', { apt_name: apt.aptNm, service: 'naver' })}>네이버 매물검색</a>
            </div>
          </div>
          <p className="data-disclaimer">국토교통부 실거래가 공개시스템에서 직접 조회한 실제 거래 데이터예요.</p>
        </>
      )}

      {/* 살까말까 보고서 CTA — 시세 탭 하단 */}
      <div className="report-cta-wrap">
        <a
          href={`/report?kaptCode=${apt.kaptCode}&aptName=${encodeURIComponent(apt.aptNm)}&price=${(typeof apt.recentAvg !== 'undefined' && apt.recentAvg) ? Math.round(apt.recentAvg / 10000) * 10000 : 50000}&years=5&savings=10000&source=apt_detail_cta`}
          className="report-cta-btn"
          onClick={() => track('report_cta_click', { apt_name: apt.aptNm, source: 'price_tab' })}
        >
          <span className="report-cta-title">이 단지 살까말까 보고서 만들기</span>
          <span className="report-cta-subtitle">4시나리오 가격 · 5축 점수 · 징검다리 판단까지 12 섹션</span>
          <span className="report-cta-arrow">→</span>
        </a>
      </div>
    </div>
  )
}

/* ── 단지 인포 카드 ─────────────────────── */
function AptInfoCard({ apt }) {
  const [kapt, setKapt]         = useState(null)
  const [building, setBuilding] = useState(null)
  const [subway, setSubway]     = useState(null)    // { name, distM }
  const [facilities, setFacilities] = useState(null) // { mart, school, hospital }

  useEffect(() => {
    if (!apt?.kaptCode) return
    fetch(`/api/kapt?kaptCode=${apt.kaptCode}`)
      .then(r => r.json()).then(setKapt).catch(() => {})
  }, [apt?.kaptCode])

  useEffect(() => {
    if (!apt?.bjdCode) return
    fetch(`/api/building?bjdCode=${apt.bjdCode}&aptName=${encodeURIComponent(apt.aptNm)}`)
      .then(r => r.json()).then(setBuilding).catch(() => {})
  }, [apt?.bjdCode, apt?.aptNm])

  // Kakao 클라이언트 검색 — 좌표 먼저 획득 후 지하철·시설 검색
  useEffect(() => {
    if (!apt?.aptNm) return
    const waitKakao = setInterval(() => {
      if (!window.kakao?.maps?.services) return
      clearInterval(waitKakao)

      const ps = new window.kakao.maps.services.Places()
      const addrShort = apt.addr ? apt.addr.split(' ').slice(0, 4).join(' ') : ''
      const q = addrShort ? `${apt.aptNm} ${addrShort}` : apt.aptNm

      ps.keywordSearch(q, (res, status) => {
        if (status !== 'OK' || !res.length) return
        const lat = parseFloat(res[0].y)
        const lng = parseFloat(res[0].x)
        if (isNaN(lat) || isNaN(lng)) return

        const center = new window.kakao.maps.LatLng(lat, lng)
        const opts = { location: center, sort: window.kakao.maps.services.SortBy.DISTANCE }

        ps.categorySearch('SW8', (r, s) => {
          if (s === 'OK' && r.length > 0) {
            const d = parseInt(r[0].distance)
            setSubway({ name: r[0].place_name.replace(/역$/, '').trim() + '역', distM: d })
          }
        }, { ...opts, radius: 2000 })

        ps.categorySearch('SC4', (r, s) => {
          setFacilities(prev => ({ ...prev, school: s === 'OK' ? r.length : 0 }))
        }, { ...opts, radius: 1000 })

        ps.categorySearch('MT1', (r, s) => {
          setFacilities(prev => ({ ...prev, mart: s === 'OK' ? r.length : 0 }))
        }, { ...opts, radius: 500 })

        ps.categorySearch('HP8', (r, s) => {
          setFacilities(prev => ({ ...prev, hospital: s === 'OK' ? r.length : 0 }))
        }, { ...opts, radius: 500 })
      })
    }, 300)
    return () => clearInterval(waitKakao)
  }, [apt?.aptNm, apt?.addr])

  const walkMin = subway?.distM ? Math.round(subway.distM / 67) : null  // 도보 67m/분

  const 세대수 = kapt?.세대수 || building?.세대수_건축 || apt?.kaptdaCnt
  const 동수 = apt?.kaptDongCnt
  const 사용승인일 = (() => {
    const d = apt?.useAprDay
    if (!d || d.length < 6) return null
    const y = d.slice(0, 4)
    const m = parseInt(d.slice(4, 6), 10)
    return m ? `${y}년 ${m}월` : `${y}년`
  })()

  const items = [
    세대수         && { label: '세대수',  value: `${parseInt(세대수).toLocaleString()}세대` },
    동수           && { label: '동 수',   value: `${동수}개 동` },
    사용승인일     && { label: '사용승인', value: 사용승인일 },
    kapt?.난방방식  && { label: '난방',    value: kapt.난방방식 },
    building?.용적률 && { label: '용적률', value: `${building.용적률}%` },
    building?.주차대수 && { label: '주차', value: `${building.주차대수.toLocaleString()}대` },
    subway         && { label: walkMin ? `${subway.name}` : subway.name,
                        value: walkMin ? `도보 ${walkMin}분` : '인근' },
    facilities?.school != null && { label: '초등학교', value: `반경 1km ${facilities.school}개` },
    facilities?.mart   != null && { label: '대형마트',  value: `반경 500m ${facilities.mart}개` },
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div className="apt-info-card">
      <div className="apt-info-title">단지 정보</div>
      <div className="apt-info-grid">
        {items.map(({ label, value }) => (
          <div key={label} className="apt-info-item">
            <span className="apt-info-label">{label}</span>
            <span className="apt-info-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── 동네 Q&A — 수집된 이야기에 AI가 답 (저장 없는 대화형 v1) ── */
function NeighborhoodQnA({ aptNm, dong }) {
  const SUGGESTED = ['주차 어때요?', '초등학교 배정은요?', '밤에 조용한 편이에요?', '주변에 뭐가 있어요?']
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [asked, setAsked] = useState(null)

  const ask = async (question, source) => {
    const text = (question || '').trim()
    if (!text || loading) return
    setLoading(true); setError(false); setAnswer(null); setAsked(text)
    track('qna_ask', { apt_name: aptNm, question: text, source })
    try {
      const res = await fetch(`/api/vibe?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}&question=${encodeURIComponent(text)}`)
      const data = await res.json()
      if (data?.answer) { setAnswer(data.answer); track('qna_answer', { apt_name: aptNm, question: text }) }
      else { setError(true); track('qna_error', { apt_name: aptNm, question: text }) }
    } catch {
      setError(true); track('qna_error', { apt_name: aptNm, question: text })
    } finally { setLoading(false) }
  }

  return (
    <div className="qna-card">
      <div className="qna-head">
        <span className="qna-title">더 궁금한 건 직접 물어보세요</span>
        <span className="qna-sub">모아둔 이야기에서 AI가 답을 찾아드려요</span>
      </div>
      <div className="qna-chips">
        {SUGGESTED.map((s) => (
          <button key={s} className="qna-chip" onClick={() => ask(s, 'chip')} disabled={loading}>{s}</button>
        ))}
      </div>
      <form className="qna-form" onSubmit={(e) => { e.preventDefault(); ask(q, 'free') }}>
        <input
          className="qna-input"
          // placeholder는 입력을 시작하면 사라지므로 라벨이 될 수 없다.
          aria-label="이 단지에 대해 궁금한 점"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예: 초품아인가요? 전세 물량 많아요?"
          maxLength={100}
        />
        <button type="submit" className="qna-submit" disabled={loading || !q.trim()}>물어보기</button>
      </form>
      {asked && (
        <div className="qna-thread">
          <div className="qna-q">{asked}</div>
          {loading ? (
            <div className="qna-a qna-loading">이야기 뒤져보는 중이에요...</div>
          ) : error ? (
            <div className="qna-a qna-error">지금은 답을 못 찾았어요. 다시 시도해 주세요.</div>
          ) : answer ? (
            <div className="qna-a">{answer}</div>
          ) : null}
        </div>
      )}
    </div>
  )
}

/* ── 동네·이야기 통합 탭 ─────────────────── */
function NeighborhoodStoriesTab({ dong, aptNm, addr, apt }) {
  const [vibe, setVibe] = useState(null)
  const [vibeSummary, setVibeSummary] = useState(null)
  const [vibeLoading, setVibeLoading] = useState(true)
  // stories 비노출 중 — API 호출도 중단 (복구 시 아래 주석 해제 + 위 UI 주석도 해제)
  const [stories, setStories] = useState([])
  const [storiesLoading, setStoriesLoading] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    setVibe(null); setVibeSummary(null); setVibeLoading(true)
    fetch(`/api/vibe?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`, { signal })
      .then(r => r.json())
      .then(data => { setVibe(data?.categories || []); setVibeSummary(data?.summary || null); setVibeLoading(false) })
      .catch(e => { if (e.name !== 'AbortError') { setVibe([]); setVibeLoading(false) } })
    // fetch(`/api/stories?aptName=${encodeURIComponent(aptNm)}&location=${encodeURIComponent(dong || '')}`, { signal })
    //   .then(r => r.json())
    //   .then(data => { setStories(Array.isArray(data) ? data : []); setStoriesLoading(false) })
    //   .catch(e => { if (e.name !== 'AbortError') { setStories([]); setStoriesLoading(false) } })
    return () => controller.abort()
  }, [aptNm, dong])

  return (
    <div className="neighborhood-tab">
      {/* 수군수군 — 동네 이야기 */}
      <div className="vibe-card">
        <div className="vibe-card-header">
          <span className="vibe-card-badge">수군수군</span>
          <span className="vibe-card-sub">인터넷에 떠도는 이야기를 AI가 모아봤어요</span>
        </div>
        {vibeLoading ? (
          <div className="vibe-loading">소문 수집 중이에요...</div>
        ) : vibe && vibe.length > 0 ? (
          <>
            {vibeSummary && (
              <div className="vibe-summary">{vibeSummary}</div>
            )}
            <div className="vibe-feed">
              {vibe.map((cat) => {
                const CAT_ICON = { 교통: '🚇', 학군: '📚', 분위기: '🏘️', 이슈: '📣' }
                return cat.lines.length > 0 && (
                  <div key={cat.label} className="vibe-feed-item">
                    <div className="vibe-feed-label">
                      <span className="vibe-feed-icon">{CAT_ICON[cat.label] || '💬'}</span>
                      {cat.label}
                    </div>
                    <div className="vibe-feed-lines">
                      {cat.lines.map((line, i) => (
                        <p key={i} className="vibe-feed-line">{line}</p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="vibe-source-note">
              직접 임장 가보는 게 제일 정확해요 😊
            </div>
          </>
        ) : (
          <div className="vibe-empty">아직 소문이 없네요</div>
        )}
      </div>

      {/* 동네 Q&A */}
      <NeighborhoodQnA aptNm={aptNm} dong={dong} />

      {/* 단지 인포 카드 */}
      <AptInfoCard apt={apt} />

      {/* 지도 */}
      <KakaoMap aptNm={aptNm} addr={addr} />
      <div className="map-deeplinks">
        {(() => { const q = encodeURIComponent(addr ? `${aptNm} ${addr.split(' ').slice(0, 3).join(' ')}` : aptNm); return (<>
          <a className="map-deeplink-btn" href={`https://map.kakao.com/link/search/${q}`} target="_blank" rel="noopener noreferrer" onClick={() => track('map_deeplink_click', { apt_name: aptNm, service: 'kakao' })}>카카오지도</a>
          <a className="map-deeplink-btn" href={`https://map.naver.com/p/search/${q}`} target="_blank" rel="noopener noreferrer" onClick={() => track('map_deeplink_click', { apt_name: aptNm, service: 'naver' })}>네이버지도</a>
        </>)})()}
      </div>

      {/* 블로그 후기 — 클릭률 낮아 임시 비노출 (SHOW_STORIES=true 로 복구) */}
      {/* <Accordion label="블로그 · 카페 후기" count={storiesLoading ? null : stories.length}>
        {storiesLoading ? (
          <div className="detail-loading">후기 불러오는 중...</div>
        ) : !stories || stories.length === 0 ? (
          <div className="detail-empty">실거주 후기를 찾지 못했습니다</div>
        ) : (
          <div className="stories-tab">
            {stories
              .filter(s => s.link && isValidUrl(s.link))
              .map((s, i) => (
              <a key={i} className="story-card" href={s.link} target="_blank" rel="noopener noreferrer" onClick={() => track('story_link_click', { apt_name: aptNm, source: s.source })}>
                <div className="story-card-title">{s.title}</div>
                {s.description && <div className="story-card-desc">{s.description}</div>}
                <div className="story-card-meta">{s.source}{s.date ? ` · ${s.date}` : ''}</div>
              </a>
            ))}
          </div>
        )}
      </Accordion> */}

      <p className="data-disclaimer">실거래 데이터는 국토교통부 실거래가 공개시스템 기준이에요. 동네 분위기·후기 요약은 AI가 웹에서 수집한 정보예요.</p>
    </div>
  )
}

/* ── 평형 분포 ───────────────────────────── */
function AreaBreakdown({ trades, selected, onSelect }) {
  // 전용면적을 반올림해 묶는다. 59.94·59.82처럼 미세하게 다르게 들어오지만
  // 같은 평형이므로 정수로 모으면 하나가 된다.
  // 10평 버킷("30평형대")은 그 안에서도 억 단위로 갈려 예산 매칭에 못 쓴다.
  const groups = {}
  trades.forEach(t => {
    const band = Math.round(t.area)
    if (!band) return
    if (!groups[band]) groups[band] = []
    groups[band].push(t.amt)
  })

  const median = arr => {
    const a = [...arr].sort((x, y) => x - y)
    const m = Math.floor(a.length / 2)
    return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2)
  }

  const rows = Object.entries(groups)
    .map(([band, amts]) => ({
      band: Number(band),
      py: Math.round(Number(band) / SQM_TO_PYEONG),
      count: amts.length,
      // 평균은 특이 거래 하나에 끌려간다. 면적당 표본이 한 자릿수인 경우가 흔해
      // 중앙값이 더 정직하고, 폭은 min~max로 따로 보여준다.
      mid: median(amts),
      min: Math.min(...amts),
      max: Math.max(...amts),
    }))
    .sort((a, b) => a.band - b.band)

  if (rows.length === 0) return null

  return (
    <div className="area-dist">
      <div className="area-dist-head">
        <span>평형별 실거래</span>
        <span className="area-dist-hint">중앙값 · 최저~최고</span>
      </div>
      {rows.map(r => (
        <button
          key={r.band}
          className={`area-dist-row${selected === r.band ? ' on' : ''}`}
          onClick={() => onSelect(r.band)}
        >
          <span className="adr-area">{r.band}㎡<em>{r.py}평</em></span>
          <span className="adr-mid">{fP(r.mid)}</span>
          <span className="adr-range">
            {r.count >= 2 ? `${fP(r.min)}~${fP(r.max)}` : '단일 거래'}
          </span>
          {/* 표본이 적으면 숨기지 않고 드러낸다 — 2~3건은 우연일 수 있다 */}
          <span className={`adr-count${r.count <= 2 ? ' few' : ''}`}>{r.count}건</span>
        </button>
      ))}
    </div>
  )
}

/* ── 카카오 지도 ─────────────────────────── */
const MAX_COORD_CACHE = 100
const coordCache = new Map()
function setCoordCache(key, val) {
  if (coordCache.size >= MAX_COORD_CACHE) coordCache.delete(coordCache.keys().next().value)
  coordCache.set(key, val)
}

function KakaoMap({ aptNm, addr }) {
  const mapRef = useRef(null)
  const [coords, setCoords] = useState(null)
  const [failed, setFailed] = useState(false)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    const cacheKey = `${aptNm}|${addr}`
    if (coordCache.has(cacheKey)) { setCoords(coordCache.get(cacheKey)); return }

    if (!window.kakao?.maps?.services) { setFailed(true); return }
    const places = new window.kakao.maps.services.Places()

    const tryKeyword = (q, cb) => {
      places.keywordSearch(q, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
          const lat = parseFloat(result[0].y), lon = parseFloat(result[0].x)
          if (!isNaN(lat) && !isNaN(lon)) { cb({ lat, lon }); return }
        }
        cb(null)
      })
    }

    // 1차: 아파트명 + 주소(시 구 동), 2차 fallback: 아파트명만
    const addrShort = addr ? addr.split(' ').slice(0, 4).join(' ') : ''
    const q1 = addrShort ? `${aptNm} ${addrShort}` : aptNm
    const q2 = aptNm

    tryKeyword(q1, c => {
      if (c) { setCoordCache(cacheKey, c); setCoords(c); return }
      tryKeyword(q2, c2 => {
        if (c2) { setCoordCache(cacheKey, c2); setCoords(c2) }
        else setFailed(true)
      })
    })
  }, [aptNm, addr])

  useEffect(() => {
    if (!coords || !mapRef.current) return
    if (!window.kakao?.maps) { setMapError(true); return }
    const { kakao } = window
    const center = new kakao.maps.LatLng(coords.lat, coords.lon)
    const map = new kakao.maps.Map(mapRef.current, { center, level: 3 })
    new kakao.maps.Marker({ position: center, map })
  }, [coords])

  if (failed || mapError) return <div className="osm-map osm-map-loading">지도를 불러올 수 없습니다</div>
  if (!coords) return <div className="osm-map osm-map-loading">지도 불러오는 중...</div>

  return <div ref={mapRef} className="osm-map" />
}

