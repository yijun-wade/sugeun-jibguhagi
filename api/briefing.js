// 오늘의 부동산 뉴스 브리핑 — 네이버 뉴스 수집 후 Claude 분석
export const config = { maxDuration: 45, regions: ['icn1'] }

import { stripHtml, naverSearch, setCors, NAVER_NEWS } from './_utils.js'

// 당일 캐시 (Vercel 서버리스 인스턴스 재사용 시)
let cache = { date: '', data: null }

function today() {
  return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
}

export default async function handler(req, res) {
  if (setCors(req, res)) return

  if (cache.date === today() && cache.data) {
    return res.json(cache.data)
  }

  if (!process.env.NAVER_CLIENT_ID) return res.status(500).json({ error: 'Naver API 키 없음' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API 키 없음' })

  try {
    const queries = [
      '부동산 정책',
      '아파트 매매 전세',
      '주택 대출 규제',
      '부동산 시장 전망',
    ]

    const results = await Promise.allSettled(
      queries.map(q => naverSearch(NAVER_NEWS, q, 5))
    )

    const seen = new Set()
    const allNews = results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .filter(item => {
        if (seen.has(item.link)) return false
        seen.add(item.link)
        return true
      })
      .slice(0, 15)

    if (allNews.length === 0) return res.status(500).json({ error: '뉴스를 불러오지 못했어요' })

    const newsText = allNews
      .map(item => `- 제목: ${stripHtml(item.title)}\n  내용: ${stripHtml(item.description)}`)
      .join('\n\n')

    const dateStr = new Date().toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric'
    })

    const prompt = `오늘(${dateStr}) 부동산 관련 뉴스입니다:\n\n${newsText}\n\n위 뉴스를 바탕으로 아파트 매매나 전월세를 고민하는 실수요자를 위한 브리핑을 작성해줘.\n\n반드시 아래 형식으로만 출력해:\n\n[제목]\n(오늘 부동산 뉴스를 한 줄로 압축한 제목. 핵심 키워드 포함. 20자 이내)\n\n[오늘의 핵심 뉴스]\n뉴스1: (한 줄 요약)\n뉴스2: (한 줄 요약)\n뉴스3: (한 줄 요약)\n\n[정부 의도]\n(정부가 이 정책을 꺼낸 이유와 목적을 2~3문장으로. 쉽게)\n\n[시장 변화]\n(이 정책으로 인해 부동산 시장이 어떻게 달라질지 2~3문장으로)\n\n[실수요자 체감]\n매매: (집 살 사람은 어떻게 느껴지나 한 문장)\n전세: (전세 구하는 사람은 어떻게 느껴지나 한 문장)\n월세: (월세 사는 사람은 어떻게 느껴지나 한 문장)\n\n말투 규칙:\n- 어렵지 않게, 친구한테 설명하듯\n- 전문용어 쓸 때는 바로 풀어서 설명\n- 이모지 금지\n- 다른 설명 없이 위 형식만 출력`

    const claude = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!claude.ok) throw new Error('Claude API 오류')
    const claudeData = await claude.json()
    const raw = claudeData.content?.[0]?.text || ''

    // 섹션 파싱
    const parse = (label) => {
      const regex = new RegExp(`\\[${label}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`)
      return raw.match(regex)?.[1]?.trim() || ''
    }

    const newsSection = parse('오늘의 핵심 뉴스')
      .split('\n')
      .filter(Boolean)
      .map(l => l.replace(/^뉴스\d+:\s*/, '').trim())

    const result = {
      date: dateStr,
      title: parse('제목'),
      news: newsSection,
      intent: parse('정부 의도'),
      market: parse('시장 변화'),
      demand: {
        buy: parse('실수요자 체감').match(/매매:\s*(.+)/)?.[1]?.trim() || '',
        lease: parse('실수요자 체감').match(/전세:\s*(.+)/)?.[1]?.trim() || '',
        rent: parse('실수요자 체감').match(/월세:\s*(.+)/)?.[1]?.trim() || '',
      },
    }

    cache = { date: today(), data: result }
    return res.json(result)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
