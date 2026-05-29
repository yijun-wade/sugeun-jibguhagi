import { useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams, useNavigate } from 'react-router-dom'
import ReportInputForm from './ReportInputForm.jsx'
import ReportResult from './ReportResult.jsx'
import { getCachedReport, setCachedReport, clearCachedReport } from './report-cache.js'
import { track } from './analytics.js'

const LOADING_MSGS = [
  '단지 데이터를 모으고 있어요...',
  '시나리오를 계산하고 있어요...',
  '분석을 정리하고 있어요...',
]

export default function ReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // URL 파라미터에서 초기값 추출
  const initialInput = {
    kaptCode: searchParams.get('kaptCode') || '',
    aptName: searchParams.get('aptName') || '',
    price: parseInt(searchParams.get('price') || '0', 10) || 50000,
    years: parseInt(searchParams.get('years') || '0', 10) || 5,
    savings: parseInt(searchParams.get('savings') || '0', 10) || 10000,
  }

  const [submittedInput, setSubmittedInput] = useState(null)  // 분석 시작 후 입력값
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    track('report_page_view', {
      source: searchParams.get('source') || 'direct',
      has_prefill: !!initialInput.kaptCode,
    })
  }, [])

  // 폼 제출
  const handleSubmit = useCallback(async (input) => {
    setError(null)
    setReport(null)

    // URL 동기화 (공유 가능하게)
    setSearchParams({
      kaptCode: input.kaptCode,
      aptName: input.aptName,
      price: String(input.price),
      years: String(input.years),
      savings: String(input.savings),
    })

    // 1) localStorage 캐시 조회
    const cached = getCachedReport({
      kaptCode: input.kaptCode,
      priceManwon: input.price,
      years: input.years,
      savingsManwon: input.savings,
    })
    if (cached) {
      setSubmittedInput(input)
      setReport({ ...cached, cacheHit: true })
      track('report_complete', {
        apt_name: input.aptName,
        cache_hit: true,
        source: 'local',
      })
      return
    }

    // 2) API 호출
    setLoading(true)
    setSubmittedInput(input)
    setLoadingMsg(LOADING_MSGS[0])
    setElapsedSec(0)
    const startedAt = Date.now()
    let msgIdx = 1
    const msgTimer = setInterval(() => {
      setLoadingMsg(LOADING_MSGS[Math.min(msgIdx, LOADING_MSGS.length - 1)])
      msgIdx++
    }, 18000)
    const elapsedTimer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)

    track('report_loading_start', { apt_name: input.aptName, kapt_code: input.kaptCode })

    try {
      const params = new URLSearchParams({
        kaptCode: input.kaptCode,
        price: String(input.price),
        years: String(input.years),
        savings: String(input.savings),
      })
      const r = await fetch(`/api/report?${params}`)
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}))
        throw new Error(errData.error || `보고서 생성 실패 (${r.status})`)
      }
      const data = await r.json()
      setReport(data)
      setCachedReport({
        kaptCode: input.kaptCode,
        priceManwon: input.price,
        years: input.years,
        savingsManwon: input.savings,
      }, data)
    } catch (e) {
      setError(e.message)
      track('report_error', { error_type: e.message })
    } finally {
      clearInterval(msgTimer)
      clearInterval(elapsedTimer)
      setLoading(false)
    }
  }, [setSearchParams])

  const handleRegenerate = useCallback(() => {
    if (!submittedInput) return
    clearCachedReport({
      kaptCode: submittedInput.kaptCode,
      priceManwon: submittedInput.price,
      years: submittedInput.years,
      savingsManwon: submittedInput.savings,
    })
    track('report_regenerate', { apt_name: submittedInput.aptName })
    // force=1로 서버 캐시도 무시
    handleSubmit(submittedInput)
  }, [submittedInput, handleSubmit])

  const handleBetaSignup = useCallback(() => {
    track('report_full_beta_signup', { apt_name: submittedInput?.aptName })
    // V1에서는 mailto: 또는 외부 폼 링크
    window.location.href = `mailto:fiveio27@gmail.com?subject=${encodeURIComponent('살까말까 풀 보고서 베타 신청')}&body=${encodeURIComponent('단지: ' + (submittedInput?.aptName || '') + '\n\n관심 사항: ')}`
  }, [submittedInput])

  return (
    <div className="app">
      <Helmet>
        <title>살까말까 보고서 · 수군수군 우리집</title>
        <meta name="description" content="이 집 사도 될까 고민될 때. AI가 12 가지 관점으로 진단해드려요. 4시나리오 가격·5축 점수·징검다리 판단까지." />
      </Helmet>

      <header className="site-header">
        <a href="/" className="site-header-logo">
          <span className="logo-accent">수</span>군수군 우리<span className="logo-accent">집</span>
          <span className="logo-beta">Beta</span>
        </a>
        <nav className="site-header-nav">
          <a href="/" className="site-nav-link">이불 속 임장</a>
          <a href="/briefing" className="site-nav-link">속닥속닥 뉴스</a>
          <a href="/policy" className="site-nav-link">이불 속 정책</a>
          <a href="/glossary" className="site-nav-link">이불 속 사전</a>
          <a href="/report" className="site-nav-link site-nav-active">살까말까 보고서</a>
        </nav>
      </header>

      <div className="report-page">
        <h1 className="report-page-title">살까말까 보고서</h1>
        <p className="report-page-subtitle">
          이 집 사도 될까 고민될 때<br />
          <span className="report-page-subtitle-strong">AI가 12 가지 관점으로 진단해드려요</span>
        </p>

        <ReportInputForm initial={initialInput} onSubmit={handleSubmit} />

        {loading && (
          <div className="report-loading-card" role="status" aria-live="polite">
            <div className="report-loading-spinner" aria-hidden="true" />
            <div className="report-loading-title">살까말까 보고서를 만들고 있어요</div>
            <div className="report-loading-progress-wrap">
              <div
                className="report-loading-progress-fill"
                style={{ width: `${Math.min(100, (elapsedSec / 90) * 100)}%` }}
              />
            </div>
            <div className="report-loading-meta">
              <span className="report-loading-elapsed">{elapsedSec}초 경과</span>
              <span className="report-loading-eta">보통 60~90초</span>
            </div>
            <div className="report-loading-step">{loadingMsg}</div>
          </div>
        )}

        {error && (
          <div className="error-block">
            <div className="error-msg">{error}</div>
            <button className="retry-btn" onClick={() => submittedInput && handleSubmit(submittedInput)}>
              다시 시도하기
            </button>
          </div>
        )}

        {report && !loading && (
          <ReportResult
            data={report}
            onRegenerate={handleRegenerate}
            onBetaSignup={handleBetaSignup}
          />
        )}
      </div>
    </div>
  )
}
