// 지금 분위기 — 네이버 블로그/카페 수집 후 Claude로 3줄 요약
export const config = { regions: ['icn1'] }

const NAVER_BLOG = 'https://openapi.naver.com/v1/search/blog.json'
const NAVER_CAFE = 'https://openapi.naver.com/v1/search/cafearticle.json'

function stripHtml(str) {
  return (str || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

async function naverSearch(endpoint, query, display = 5) {
  const url = `${endpoint}?query=${encodeURIComponent(query)}&display=${display}&sort=sim`
  const r = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
    },
  })
  if (!r.ok) return []
  return (await r.json()).items || []
}

export default async function handler(req, res) {
  const { aptName, location } = req.query
  if (!aptName) return res.status(400).json({ error: 'aptName이 필요해요' })
  if (!process.env.NAVER_CLIENT_ID) return res.status(500).json({ error: 'Naver API 키 없음' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API 키 없음' })

  // 네이버 수집
  const queries = [
    `${aptName} 살아보니`,
    `${aptName} 입주 후기`,
    location ? `${location} 분위기` : `${aptName} 동네`,
  ]
  try {
    const results = await Promise.all([
      naverSearch(NAVER_BLOG, queries[0], 4),
      naverSearch(NAVER_BLOG, queries[1], 4),
      naverSearch(NAVER_CAFE, queries[2], 4),
    ])
    const seen = new Set()
    const items = results.flat()
      .filter(item => {
        if (seen.has(item.link)) return false
        seen.add(item.link)
        return true
      })
      .slice(0, 10)
      .map(item => `제목: ${stripHtml(item.title)}\n내용: ${stripHtml(item.description)}`)
      .join('\n\n')

    if (!items) return res.json({ lines: [] })

    // Claude Haiku로 3줄 요약
    const prompt = `다음은 "${aptName}"${location ? ` (${location})` : ''} 관련 블로그·카페 글이야.\n\n${items}\n\n이 글들을 바탕으로, 지금 거기 사는 사람들의 솔직한 분위기를 3줄로 요약해줘.\n- 각 줄은 이모지 하나로 시작\n- 구체적이고 현실적으로 (장점/단점/생활감 골고루)\n- 한 줄에 20~35자 이내\n- 다른 설명 없이 3줄만 출력`

    const claude = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await claude.json()
    const text = data?.content?.[0]?.text || ''
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3)
    return res.json({ lines })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
