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

    const prompt = `다음은 "${aptName}"${location ? ` (${location})` : ''} 관련 인터넷 글이야. 블로그 후기, 카페 글, 뉴스, 지식인 Q&A를 포함해.\n\n${sections}\n\n이 내용을 바탕으로, 이 아파트·동네에 대한 사람들의 솔직한 수근수근을 3줄로 요약해줘.\n- 각 줄은 이모지 하나로 시작\n- 실거주 경험, 동네 분위기, 주요 이슈를 골고루 반영\n- 뉴스에 중요한 이슈(재건축, 호재 등)가 있으면 반드시 포함\n- 한 줄에 20~35자 이내\n- 다른 설명 없이 3줄만 출력`

    const claude = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!claude.ok) {
      const err = await claude.json().catch(() => ({}))
      console.error('Anthropic API error:', claude.status, err)
      return res.json({ lines: [] })
    }
    const data = await claude.json()
    const text = data?.content?.[0]?.text || ''
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3)
    return res.json({ lines })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
