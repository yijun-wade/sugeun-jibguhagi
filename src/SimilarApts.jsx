// src/SimilarApts.jsx — 상세페이지 하단 "이 근처 비슷한 가격대 단지"
// 목적: 막다른 상세페이지에 2nd 페이지뷰 통로를 만들어 이탈을 낮추고 내부링크(SEO)를 늘린다.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from './analytics.js'

const fmtEok = (man) => {
  if (!Number.isFinite(man) || man <= 0) return '-'
  const eok = man / 10000
  return `${eok % 1 === 0 ? eok : eok.toFixed(1)}억`
}

export default function SimilarApts({ kaptCode, avg, gu, aptNm }) {
  const navigate = useNavigate()
  const [items, setItems] = useState(null) // null=로딩, []=없음

  useEffect(() => {
    if (!kaptCode) return
    let alive = true
    const params = new URLSearchParams({ kaptCode })
    if (avg) params.set('avg', String(avg))
    if (gu) params.set('gu', gu)
    fetch(`/api/nearby?${params.toString()}`)
      .then(r => r.json())
      .then(data => { if (alive) setItems(Array.isArray(data) ? data : []) })
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [kaptCode, avg, gu])

  // 로딩 중이거나 결과 없으면 섹션 자체를 감춘다(깨진 빈 섹션 방지)
  if (!items || items.length === 0) return null

  const go = (target) => {
    track('discover_apt_click', {
      from: 'apt_detail_similar',
      apt_name: aptNm,
      target_name: target.name,
      target_code: target.code,
    })
    navigate(`/apt/${target.code}`)
  }

  return (
    <section className="similar-apts" aria-label="비슷한 가격대 단지">
      <h2 className="similar-apts-title">
        이 근처 비슷한 값 단지
        {gu ? <span className="similar-apts-sub"> · {gu}</span> : null}
      </h2>
      <ul className="similar-apts-list">
        {items.map(a => (
          <li key={a.code}>
            <button type="button" className="similar-apt-card" onClick={() => go(a)}>
              <span className="similar-apt-main">
                <span className="similar-apt-name">{a.name}</span>
                <span className="similar-apt-loc">{a.dong}{a.year ? ` · ${a.year}년` : ''}</span>
              </span>
              <span className="similar-apt-price">{fmtEok(a.avg)}</span>
              <span className="similar-apt-arrow" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
