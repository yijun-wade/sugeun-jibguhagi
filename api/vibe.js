// 수근수근 요약 — 블로그/카페/뉴스/지식인 수집 후 Claude로 3줄 요약
export const config = { maxDuration: 30, regions: ['icn1'] }

import { stripHtml, naverSearch, NAVER_BLOG, NAVER_CAFE, NAVER_NEWS, NAVER_KIN } from './_utils.js'

function formatItems(items, tag) {
  return items
    .map(item => `[${tag}] 제목: ${stripHtml(item.title)}\n내용: ${stripHtml(item.description)}`)
    .join('\n\n')
}

export default async function handler(req, res) {
  const { aptName, location } = req.query
  if (!aptName) return res.status(400).json({ error: 'aptName이 필요해요' })
  if (!process.env.NAVER_CLIENT_ID) return res.status(500).json({ error: 'Naver API 키 없음' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API 키 없음' })

  try {
    const settled = await Promise.allSettled([
      naverSearch(NAVER_BLOG, `${aptName} 살아보니`),
      naverSearch(NAVER_BLOG, `${aptName} 입주 후기`),
      naverSearch(NAVER_CAFE, location ? `${location} 실거주 후기` : `${aptName} 후기`),
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

    const prompt = `다음은 "${aptName}"${location ? ` (${location})` : ''} 관련 인터넷 글이야. 블로그 후기, 카페 글, 뉴스, 지식인 Q&A를 포함해.\n\n${sections}\n\n이 내용을 바탕으로, 이 아파트·동네에 실제로 살거나 관심 있는 사람들이 동네 카페에서 소곤소곤 나눌 법한 말투로 요약해줘.\n딱딱한 분석이나 리포트 말투 금지. 친한 친구한테 귓속말로 알려주는 느낌으로.\n\n출력 형식 (반드시 지켜줘):\n[교통]\n한 줄 내용\n한 줄 내용\n[학군]\n한 줄 내용\n한 줄 내용\n[분위기]\n한 줄 내용\n한 줄 내용\n[이슈]\n한 줄 내용\n한 줄 내용\n[총평]\n한 줄 종합 평가\n\n말투 규칙:\n- "~대요", "~래요", "~다고들 해요", "~다네요", "~는 편이에요" 같은 전달 말투 사용\n- 숫자나 구체적 사실은 살려줘 (예: "뚝섬역까지 걸어서 5분이래요")\n- 이모지 사용 금지\n- 각 줄은 15~40자 이내\n- 총평은 이 단지를 한 줄로 — 친구한테 "거기 어때?" 물어봤을 때 대답하듯이\n- 정보가 부족한 카테고리는 "정보 없음"으로 채워줘\n- 다른 설명 없이 위 형식만 출력`

    const claude = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 550,
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

    // 카테고리 파싱: [교통] ... [학군] ... 형식
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
