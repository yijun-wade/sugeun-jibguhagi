// 수근수근 요약 — 블로그/카페/뉴스/지식인 수집 후 Claude로 3줄 요약
export const config = { maxDuration: 45, regions: ['icn1'] }

import { stripHtml, naverSearch, setCors, NAVER_BLOG, NAVER_CAFE, NAVER_NEWS, NAVER_KIN } from './_utils.js'

function formatItems(items, tag) {
  return items
    .map(item => `[${tag}] 제목: ${stripHtml(item.title)}\n내용: ${stripHtml(item.description)}`)
    .join('\n\n')
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const { aptName, location, question } = req.query
  if (!aptName) return res.status(400).json({ error: 'aptName이 필요해요' })
  if (!process.env.NAVER_CLIENT_ID) return res.status(500).json({ error: 'Naver API 키 없음' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API 키 없음' })

  try {
    // ── 동네 Q&A 모드 — question이 있으면 질문에 답한다 (수집된 글에 근거) ──
    if (question && question.trim()) {
      const q = question.trim().slice(0, 100)
      const settled = await Promise.allSettled([
        naverSearch(NAVER_BLOG, `${aptName} ${q}`),
        naverSearch(NAVER_CAFE, location ? `${location} ${q}` : `${aptName} ${q}`),
        naverSearch(NAVER_KIN,  `${aptName} ${q}`, 4),
        naverSearch(NAVER_BLOG, `${aptName} 살아보니`),
      ])
      const [qb, qc, qk, qb2] = settled.map(r => r.status === 'fulfilled' ? r.value : [])
      const qseen = new Set()
      const qdedup = (items) => items.filter(i => {
        if (qseen.has(i.link)) return false
        qseen.add(i.link)
        return true
      })
      const context = [
        formatItems(qdedup([...qb, ...qb2]).slice(0, 6), '블로그'),
        formatItems(qdedup(qc).slice(0, 4), '카페'),
        formatItems(qdedup(qk).slice(0, 4), '지식인'),
      ].filter(Boolean).join('\n\n---\n\n')

      const qPrompt = `누군가 "${aptName}"${location ? ` (${location})` : ''}에 대해 이렇게 물었어: "${q}"\n\n아래는 인터넷에서 모은 관련 글이야:\n\n${context || '(관련 글을 거의 못 찾았어요)'}\n\n이 자료를 바탕으로 질문에 답해줘.\n규칙:\n- 친한 친구한테 귓속말로 알려주듯 "~대요", "~래요", "~는 편이래요" 같은 전달 말투\n- 자료에 근거해서만 답하고, 자료에 없으면 "이건 자료가 부족해서 확실친 않은데요"라고 솔직하게\n- 지어내지 말 것. 모르면 모른다고 해줘\n- 2~4문장, 이모지 없이\n- 마지막에 "직접 확인해보는 게 제일 정확해요" 같은 과신 경계 한 마디를 자연스럽게`

      const qClaude = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: qPrompt }],
        }),
      })
      if (!qClaude.ok) {
        const err = await qClaude.json().catch(() => ({}))
        console.error('Anthropic API error (qna):', qClaude.status, err)
        return res.status(500).json({ error: '답변 생성에 실패했어요' })
      }
      const qData = await qClaude.json()
      const answer = qData?.content?.[0]?.text?.trim() || ''
      return res.json({ answer })
    }

    const settled = await Promise.allSettled([
      naverSearch(NAVER_BLOG, `${aptName} 살아보니`),
      naverSearch(NAVER_BLOG, location ? `${location} 동네 분위기` : `${aptName} 동네 분위기`),
      naverSearch(NAVER_CAFE, location ? `${location} 살기 어때` : `${aptName} 살기 어때`),
      naverSearch(NAVER_NEWS, `${aptName}`, 3),
      naverSearch(NAVER_KIN,  `${aptName} 어때요`, 4),
    ])
    const [blog1, blog2, cafe, news, kin] = settled.map(r => r.status === 'fulfilled' ? r.value : [])

    const seen = new Set()
    const dedup = (items) => items.filter(i => {
      if (seen.has(i.link)) return false
      seen.add(i.link)
      return true
    })

    const sections = [
      formatItems(dedup([...blog1, ...blog2]).slice(0, 6), '블로그'),
      formatItems(dedup(cafe).slice(0, 3), '카페'),
      formatItems(dedup(news).slice(0, 3), '뉴스'),
      formatItems(dedup(kin).slice(0, 4),  '지식인'),
    ].filter(Boolean).join('\n\n---\n\n')

    if (!sections) return res.json({ lines: [] })

    const prompt = `다음은 "${aptName}"${location ? ` (${location})` : ''} 관련 인터넷 글이야. 블로그 후기, 카페 글, 뉴스, 지식인 Q&A를 포함해.\n\n${sections}\n\n이 내용을 바탕으로, 이 동네에 실제로 살거나 이사를 고민하는 사람들이 카페에서 소곤소곤 나눌 법한 말투로 요약해줘.\n딱딱한 분석이나 리포트 말투 금지. 친한 친구한테 귓속말로 알려주는 느낌으로.\n\n출력 형식 (반드시 지켜줘):\n[교통]\n한 줄 내용\n한 줄 내용\n[학군]\n한 줄 내용\n한 줄 내용\n[분위기]\n한 줄 내용\n한 줄 내용\n[이슈]\n한 줄 내용\n한 줄 내용\n[총평]\n한 줄 종합 평가\n\n말투 규칙:\n- "~대요", "~래요", "~다고들 해요", "~다네요", "~는 편이에요" 같은 전달 말투 사용\n- 숫자나 구체적 사실은 살려줘 (예: "지하철역까지 걸어서 5분이래요", "학교가 도보 10분이래요")\n- 이모지 사용 금지\n- 각 줄은 15~45자 이내\n- 총평은 이 동네를 한 줄로 — 친구한테 "거기 살 만해?" 물어봤을 때 대답하듯이\n- 교통은 지하철·버스 접근성, 출퇴근 혼잡도 중심\n- 학군은 초·중·고 학교 수준, 학원가, 교육 환경 중심\n- 분위기는 동네 성격·주민층·거리 느낌·상권 중심\n- 이슈는 최근 개발 소식·주민 불만·핫토픽 중심\n- 정보가 부족한 카테고리는 "정보 없음"으로 채워줘\n- 다른 설명 없이 위 형식만 출력`

    const claude = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!claude.ok) {
      const err = await claude.json().catch(() => ({}))
      console.error('Anthropic API error:', claude.status, err)
      return res.json({ categories: [] })
    }
    const data = await claude.json()
    const text = data?.content?.[0]?.text || ''

    // 카테고리 파싱: [교통] ... 형식
    const LABELS = ['교통', '학군', '분위기', '이슈']
    const categories = LABELS.map(label => {
      const regex = new RegExp(`\\[${label}\\]([\\s\\S]*?)(?=\\[|$)`)
      const match = text.match(regex)
      const lines = match
        ? match[1].split('\n').map(l => l.trim()).filter(l => l && l !== '정보 없음')
        : []
      return { label, lines }
    })

    // 총평 파싱
    const summaryMatch = text.match(/\[총평\]([\s\S]*?)(?=\[|$)/)
    const summary = summaryMatch
      ? summaryMatch[1].split('\n').map(l => l.trim()).filter(Boolean)[0] || null
      : null

    return res.json({ categories, summary })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
