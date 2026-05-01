import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import AdFitBanner from './AdFitBanner.jsx'
import { track } from './analytics.js'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const CHEONGAN    = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
const CHEONGAN_KO = ['갑목','을목','병화','정화','무토','기토','경금','신금','임수','계수']
const JIJI        = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']
const OHAENG_MAP  = { '甲':'목','乙':'목','丙':'화','丁':'화','戊':'토','己':'토','庚':'금','辛':'금','壬':'수','癸':'수' }

function getYearGan(year) { return CHEONGAN[(year - 4 + 4000) % 10] }
function getYearJi(year)  { return JIJI[(year - 4 + 4000) % 12] }

// ── 입력 화면 ─────────────────────────────────────────────
function SajuInput({ onPreview }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear]     = useState('')
  const [month, setMonth]   = useState('')
  const [day, setDay]       = useState('')
  const [hour, setHour]     = useState('')
  const [gender, setGender] = useState('male')

  const years  = Array.from({ length: 80 }, (_, i) => currentYear - 15 - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const days   = Array.from({ length: 31 }, (_, i) => i + 1)
  const hours  = Array.from({ length: 24 }, (_, i) => i)
  const canGo  = year && month && day

  function handleSubmit() {
    if (!canGo) return
    track('saju_start', { year, month, day, has_hour: !!hour, gender })
    onPreview({ year, month, day, hour, gender,
      yearGan: getYearGan(Number(year)),
      yearJi:  getYearJi(Number(year)) })
  }

  return (
    <div className="saju-wrap">
      <Helmet>
        <title>이불 속 터잡기 — 내 사주로 찾는 동네 기운 | 수군수군 우리집</title>
        <meta name="description" content="생년월일 입력하면 용신 오행으로 나와 맞는 서울 동네를 찾아드려요. 5월 무료." />
        <meta property="og:title" content="이불 속 터잡기 — 내 사주로 찾는 동네 기운" />
        <meta property="og:description" content="용신 오행으로 읽는 지역 터. 내 기운과 맞는 서울 동네를 찾아드려요." />
        <meta property="og:image" content="https://www.suzip.kr/saju-og.png" />
        <meta property="og:url" content="https://www.suzip.kr/saju" />
      </Helmet>
      {/* 프로모션 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ background: '#f97316', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 20 }}>
          5월 오픈기념 무료
        </span>
        <span style={{ fontSize: 13, color: '#9CA3AF', textDecoration: 'line-through' }}>원가 1,900원</span>
      </div>

      <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 700, marginBottom: 8 }}>이불 속 터잡기</div>
      <h1 className="saju-title" style={{ fontSize: 28 }}>내 사주로 찾는<br/>동네 기운</h1>
      <p className="saju-desc">용신 오행으로 읽는 지역 터 — 내 기운과 맞는 서울 동네를 찾아드려요</p>

      <div className="saju-form">
        <div className="saju-field">
          <label>생년월일</label>
          <div className="saju-row">
            <select value={year} onChange={e => setYear(e.target.value)}>
              <option value="">년도</option>
              {years.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={month} onChange={e => setMonth(e.target.value)}>
              <option value="">월</option>
              {months.map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
            <select value={day} onChange={e => setDay(e.target.value)}>
              <option value="">일</option>
              {days.map(d => <option key={d} value={d}>{d}일</option>)}
            </select>
          </div>
        </div>

        <div className="saju-field">
          <label>태어난 시간 <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(모르면 건너뛰어요)</span></label>
          <select style={{ width: '100%' }} value={hour} onChange={e => setHour(e.target.value)}>
            <option value="">시간 모름</option>
            {hours.map(h => <option key={h} value={h}>{h}시</option>)}
          </select>
        </div>

        <div className="saju-field">
          <label>성별</label>
          <div className="saju-gender">
            <button className={gender === 'male' ? 'active' : ''} onClick={() => setGender('male')}>남성</button>
            <button className={gender === 'female' ? 'active' : ''} onClick={() => setGender('female')}>여성</button>
          </div>
        </div>

        <button className="saju-btn-main" disabled={!canGo} onClick={handleSubmit}>
          무료로 내 사주 확인하기 →
        </button>
      </div>

      {/* 샘플 미리보기 */}
      <div className="saju-sample">
        <div className="saju-sample-label">실제 이런 결과가 나와요 (샘플)</div>
        <div className="saju-sample-card">

          {/* 히어로 */}
          <div className="saju-sample-hero">
            <span className="saju-sample-ilgan">甲木</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>신강 · 용신 水</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3, lineHeight: 1.5 }}>
                木 과다 — 水로 목기를 흘려보내야 에너지 순환
              </div>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>이사 타이밍</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24' }}>88점</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>지금이 적기</div>
            </div>
          </div>

          {/* 대운 힌트 */}
          <div style={{ padding: '10px 16px', background: '#F0FDF4', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', background: '#DCFCE7', padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>대운</span>
            <span style={{ fontSize: 12, color: '#15803d' }}>癸巳 대운(2020-2030) — 용신 水 보충 구간. 정착·안정 에너지</span>
          </div>

          {/* 1순위 지역 */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>1순위</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>마포구</span>
              <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>水 오행</span>
              <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 900, color: '#2563eb' }}>95점</span>
            </div>
            <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, marginBottom: 6 }}>
              麻浦(마포) — 浦자에 水변, 한강 포구의 물기운 담은 땅
            </div>
            <div style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.65, marginBottom: 10 }}>
              甲木에게 水는 자식 오행이자 에너지 순환 통로. 한강이 옆에 있으면 과도한 목기가 자연스럽게 흘러내려 일상 속 답답함이 해소됨. 지명 麻浦도 水 기운을 담아 땅의 기운과 용신이 삼중으로 맞아 떨어짐
            </div>

            {/* 점수 breakdown */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[['오행궁합','#2563eb',24],['지명오행','#7c3aed',23],['지형','#0891b2',24],['생활','#16a34a',24]].map(([l,c,s]) => (
                <div key={l} style={{ flex: 1, background: c+'12', borderRadius: 8, padding: '4px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: c, fontWeight: 700 }}>{l}</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: c }}>{s}</div>
                </div>
              ))}
            </div>

            {/* 궁합 아파트 */}
            <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', marginBottom: 8 }}>궁합 아파트</div>
              {[
                { name: '마포래미안푸르지오', dong: '아현동', year: 2014, avg: 22.0 },
                { name: '공덕SK리더스뷰', dong: '공덕동', year: 2010, avg: 22.8 },
              ].map(apt => (
                <div key={apt.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{apt.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{apt.dong} · {apt.year}년</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#2563eb' }}>{apt.avg}억</div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6, textAlign: 'right' }}>+ 더 많은 단지 →</div>
            </div>
          </div>

          {/* 2·3순위 블러 */}
          <div style={{ padding: '12px 16px', position: 'relative', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ filter: 'blur(4px)', pointerEvents: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>2순위 ████ · 85점</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>용신 水 · 한강변</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>3순위 ████ · 76점</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>용신 水 · 한강 접근</span>
              </div>
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 18 }}>🔒</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>내 사주로 분석하면 달라져요</span>
            </div>
          </div>

          {/* 주의 시기 힌트 */}
          <div style={{ padding: '10px 16px', background: '#FFF7ED', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#C2410C' }}>주의 시기 포함</div>
              <div style={{ fontSize: 11, color: '#9A3412' }}>특정 연도 삼형살 구간 — 이 시기 전 정착 권장</div>
            </div>
          </div>

          <div style={{ padding: '10px 16px', background: '#F9FAFB', fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
            내 생년월일을 입력하면 실제 내 사주로 분석해드려요
          </div>
        </div>
      </div>
    </div>
  )
}

const LOADING_STEPS = [
  { text: '사주 원국 확인 중',      sub: '생년월일로 일간과 오행을 읽고 있어요' },
  { text: '용신 에너지 분석 중',    sub: '내 기운에 맞는 오행을 찾고 있어요' },
  { text: '나와 맞는 터 탐색 중',   sub: '서울 25개 구를 사주로 대입하고 있어요' },
  { text: '이불 속 임장 떠나는 중', sub: '지명 오행과 지형 에너지를 확인하고 있어요' },
  { text: '궁합 아파트 고르는 중',  sub: '추천 동네 실거래 단지를 정리하고 있어요' },
  { text: '주의 시기 확인 중',      sub: '삼형살·충 구간을 점검하고 있어요' },
  { text: '리포트 완성 중',         sub: '거의 다 됐어요, 잠시만 기다려주세요' },
]

// ── 분석 중 + 광고 화면 ───────────────────────────────────
function SajuLoading({ birthData, onResult, onError }) {
  const [seconds, setSeconds]   = useState(40)
  const [stepIdx, setStepIdx]   = useState(0)
  const [fadeIn, setFadeIn]     = useState(true)
  const doneRef = useRef(false)

  useEffect(() => {
    const { year, month, day, hour, gender } = birthData
    fetch(`/api/saju?year=${year}&month=${month}&day=${day}&hour=${hour}&gender=${gender}`)
      .then(r => r.json())
      .then(data => {
        if (doneRef.current) return
        doneRef.current = true
        if (data.error) {
          track('saju_error', { error: data.error })
          onError(data.error)
        } else {
          track('saju_complete', {
            ilgan: data.ilgan,
            yongshin: data.saju?.yongshin,
            top_gu: data.regions?.[0]?.gu,
            top_score: data.regions?.[0]?.score,
            timing_score: data.timing?.timingScore,
          })
          onResult(data)
        }
      })
      .catch(() => {
        if (!doneRef.current) { doneRef.current = true; onError('분석 중 오류가 발생했어요. 다시 시도해주세요.') }
      })

    // 카운트다운
    const iv = setInterval(() => {
      setSeconds(p => {
        if (p <= 1) { clearInterval(iv); return 1 }
        return p - 1
      })
    }, 1000)

    // 스텝 순환 (6초마다)
    const stepIv = setInterval(() => {
      setFadeIn(false)
      setTimeout(() => {
        setStepIdx(p => (p + 1) % LOADING_STEPS.length)
        setFadeIn(true)
      }, 300)
    }, 6000)

    return () => { clearInterval(iv); clearInterval(stepIv); doneRef.current = true }
  }, [])

  const step = LOADING_STEPS[stepIdx]

  return (
    <div style={{
      minHeight: '100vh', textAlign: 'center',
      backgroundImage: 'url(/saju-loading-bg.png)',
      backgroundSize: 'cover', backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    }}>
    <div className="saju-wrap" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.88)', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
      {/* 상태 표시 */}
      <div style={{ marginBottom: 28 }}>
        {/* 카운트다운 원 */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 900, color: '#fff',
            boxShadow: '0 4px 20px rgba(37,99,235,0.35)',
          }}>
            {seconds}
          </div>
        </div>

        {/* 스텝 메시지 */}
        <div style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.3s ease' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
            {step.text}
          </div>
          <div style={{ fontSize: 13, color: '#6B7280' }}>{step.sub}</div>
        </div>

        {/* 진행 도트 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
          {LOADING_STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === stepIdx ? 20 : 6,
              height: 6, borderRadius: 3,
              background: i === stepIdx ? '#2563eb' : '#E5E7EB',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      </div>

      {/* 광고 섹션 */}
      <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 16, padding: '20px 16px', marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
          🙏 광고 클릭으로 무료 서비스를 응원해주세요
        </p>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
          클릭해도 이 페이지는 그대로 유지돼요 (새 탭으로 열림)
        </p>
        <AdFitBanner />
      </div>

      <p style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
        이 서비스는 광고 수익으로 운영돼요.<br/>원가 1,900원을 광고 클릭으로 대신해주세요.
      </p>
    </div>
    </div>
  )
}

// ── 결과 화면 ─────────────────────────────────────────────
function SajuResult({ result, onBack }) {
  const s  = result.saju  || {}
  const t  = result.timing || {}
  const resultRef = useRef(null)
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPdf() {
    if (!resultRef.current || downloading) return
    setDownloading(true)
    track('saju_pdf_download', { ilgan: result.ilgan })
    try {
      const canvas = await html2canvas(resultRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#F9FAFB',
        scrollY: -window.scrollY,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW - 16
      const imgH = (canvas.height * imgW) / canvas.width
      let y = 8
      let remaining = imgH
      while (remaining > 0) {
        pdf.addImage(imgData, 'PNG', 8, y, imgW, imgH)
        remaining -= (pageH - 16)
        if (remaining > 0) { pdf.addPage(); y = 8 - (imgH - remaining) }
      }
      pdf.save(`수군수군_사주터잡기_${result.ilgan || '결과'}.pdf`)
    } catch (e) {
      console.error(e)
    } finally {
      setDownloading(false)
    }
  }
  const SCORE_META = {
    ohaengMatch:  { label: '오행 궁합', color: '#2563eb' },
    jimingOhaeng: { label: '지명 오행', color: '#7c3aed' },
    landscape:    { label: '지형 에너지', color: '#0891b2' },
    lifeEnergy:   { label: '생활 에너지', color: '#16a34a' },
  }

  return (
    <div className="saju-wrap saju-result">
      <div ref={resultRef}>
      <div className="saju-result-hero">
        <div style={{ fontSize: 48, fontWeight: 900, color: '#fff' }}>{result.ilgan}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
          {s.sinkang} · 용신 {s.yongshin}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 12, lineHeight: 1.7, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px' }}>
          {result.summary}
        </div>
      </div>

      <section className="saju-section">
        <div className="saju-section-title">사주 원국 분석</div>
        {[
          ['오행 분포', s.ohaengDist],
          ['신강·신약', s.sinkang],
          ['용신', `${s.yongshin} — ${s.yongShinReason}`],
          ['대운', s.daewon],
          ['세운', s.sewon],
        ].filter(([,v]) => v).map(([k, v]) => (
          <div key={k} className="saju-info-row">
            <span className="saju-info-key">{k}</span>
            <span className="saju-info-val">{v}</span>
          </div>
        ))}
      </section>

      {t.reason && (
        <section className="saju-section">
          <div className="saju-section-title" style={{ color: t.isGoodYear ? '#16a34a' : '#dc2626' }}>
            {t.isGoodYear ? '✅' : '⚠️'} 지금 이사·계약 타이밍 — {t.timingScore}점
          </div>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{t.reason}</p>
          {t.bestMonths && <p style={{ fontSize: 13, color: '#6B7280', marginTop: 6 }}>추천 시기: {t.bestMonths}</p>}
        </section>
      )}

      <div className="saju-section-title" style={{ margin: '8px 0' }}>궁합 지역 TOP 3</div>

      {(result.regions || []).map((region, i) => {
        const sb = region.scoreBreakdown || {}
        return (
          <section key={region.gu} className="saju-region-card">
            <div className="saju-region-header">
              <div>
                <span style={{ fontSize: 12, color: '#9CA3AF', marginRight: 6 }}>{i+1}순위</span>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{region.gu}</span>
              </div>
              <span className="saju-region-score">{region.score}점</span>
            </div>
            {region.jiming && <div className="saju-region-jiming">{region.jiming}</div>}
            {region.whyThisGu && <p className="saju-region-why">{region.whyThisGu}</p>}
            <div className="saju-score-breakdown">
              {Object.entries(sb).map(([key, val]) => {
                const m = SCORE_META[key] || { label: key, color: '#2563eb' }
                return (
                  <div key={key} className="saju-score-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: m.color }}>{val.score}점</span>
                    </div>
                    {val.reason && <p style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.6 }}>{val.reason}</p>}
                  </div>
                )
              })}
            </div>
            {region.dailyLife && (
              <div className="saju-daily">
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>일상 에너지</span>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginTop: 4 }}>{region.dailyLife}</p>
              </div>
            )}
            {region.apts?.length > 0 && (
              <div className="saju-apts">
                {region.apts.map(apt => (
                  <div key={apt.name} className="saju-apt-row">
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{apt.name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{apt.dong} · {apt.year}년 · {apt.units?.toLocaleString()}세대</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{apt.avg}억</div>
                  </div>
                ))}
              </div>
            )}
            <a
              href={`/?tab=discover&gu=${encodeURIComponent(region.gu)}`}
              onClick={() => track('saju_discover_click', { gu: region.gu, rank: i + 1 })}
              style={{
                display: 'block', marginTop: 14, padding: '10px 0',
                background: i === 0 ? '#2563eb' : '#F3F4F6',
                color: i === 0 ? '#fff' : '#374151',
                borderRadius: 10, textAlign: 'center',
                fontSize: 14, fontWeight: 700, textDecoration: 'none',
              }}
            >
              {region.gu} 아파트 탐색하기 →
            </a>
          </section>
        )
      })}

      {result.regionComparison && (
        <section className="saju-section">
          <div className="saju-section-title">지역 비교</div>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75 }}>{result.regionComparison}</p>
        </section>
      )}

      {result.warning?.reason && (
        <section className="saju-section" style={{ borderColor: '#FCA5A5' }}>
          <div className="saju-section-title" style={{ color: '#DC2626' }}>⚠️ 주의 시기 — {result.warning.year}</div>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 8 }}>{result.warning.reason}</p>
          <p style={{ fontSize: 14, color: '#DC2626', fontWeight: 700 }}>대비: {result.warning.action}</p>
        </section>
      )}

      {result.finalVerdict && (
        <div className="saju-verdict">
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>최종 판단</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.75 }}>{result.finalVerdict}</p>
        </div>
      )}

      {/* 결과 하단 광고 */}
      <div style={{ background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: '16px', marginBottom: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>📢 광고 클릭으로 무료 서비스를 응원해주세요</p>
        <AdFitBanner />
      </div>

      <p className="saju-disclaimer">AI 기반 사주 분석 참고 자료예요. 실제 부동산 결정은 전문가 상담을 병행하세요.</p>
      </div>{/* /resultRef */}

      {/* 액션 버튼 3개 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, marginBottom: 24 }}>
        <button
          className="saju-btn-main"
          onClick={handleDownloadPdf}
          disabled={downloading}
          style={{ opacity: downloading ? 0.6 : 1 }}
        >
          {downloading ? '⏳ PDF 저장 중...' : '📄 결과 PDF로 저장하기'}
        </button>
        <button
          className="saju-btn-main"
          onClick={async () => {
            const url = 'https://www.suzip.kr/saju'
            const text = `내 사주 용신으로 찾은 서울 동네 — ${result.ilgan || ''} 일간 결과`
            if (navigator.share) {
              try { await navigator.share({ title: '이불 속 터잡기', text, url }) } catch {}
            } else {
              await navigator.clipboard.writeText(`${text}\n${url}`)
              alert('링크가 복사됐어요!')
            }
            track('saju_share', { ilgan: result.ilgan })
          }}
          style={{ background: '#fff', color: '#2563eb', border: '2px solid #2563eb' }}
        >
          🔗 결과 공유하기
        </button>
        <button
          className="saju-btn-main"
          onClick={onBack}
          style={{ background: '#F3F4F6', color: '#374151', fontWeight: 700 }}
        >
          🔄 다른 사주로 찾아보기
        </button>
      </div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────
export default function SajuPage() {
  const [view, setView]         = useState('input')   // input | loading | result | error
  const [birthData, setBirthData] = useState(null)
  const [result, setResult]     = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  if (view === 'loading') {
    return (
      <SajuLoading
        birthData={birthData}
        onResult={data => { setResult(data); setView('result') }}
        onError={msg  => { setErrorMsg(msg); setView('error') }}
      />
    )
  }

  if (view === 'result' && result) {
    return <SajuResult result={result} onBack={() => { setView('input'); setResult(null) }} />
  }

  if (view === 'error') {
    return (
      <div className="saju-wrap" style={{ textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>😢</div>
        <p style={{ color: '#DC2626', fontWeight: 700, marginBottom: 16 }}>{errorMsg}</p>
        <button className="saju-btn-main" onClick={() => setView('input')}>다시 시도</button>
      </div>
    )
  }

  return (
    <SajuInput
      onPreview={data => { setBirthData(data); setView('loading') }}
    />
  )
}
