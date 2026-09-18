// 수근수근 요약 — 블로그/카페/뉴스/지식인 수집 후 Claude로 3줄 요약
export const config = { maxDuration: 45, regions: ['icn1'] }

import { stripHtml, naverSearch, setCors, NAVER_BLOG, NAVER_CAFE, NAVER_KIN } from './_utils.js'
import { filterRelevant } from './_vibe-filter.js'
import { generateVibe } from './_vibe-core.js'

function formatItems(items, tag) {
  return items
    .map(item => `[${tag}] 제목: ${stripHtml(item.title)}\n내용: ${stripHtml(item.description)}`)
    .join('\n\n')
}

export default async function handler(req, res) {
  if (setCors(req, res)) return
  const { aptName, location, question, gu } = req.query
  // 같은 이름의 다른 단지 글을 거른다(_vibe-filter.js). 단지명으로 검색한 결과에만 적용 —
  // 동 이름으로 검색한 글은 애초에 그 동네 이야기다.
  const own = (items) => filterRelevant(items, { aptName, gu, dong: location, requireSubject: true })
  const where = [gu, location].filter(Boolean).join(' ')
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
      const [qb, qcRaw, qk, qb2] = settled.map(r => r.status === 'fulfilled' ? r.value : []).map((v, i) => (i === 1 && location) ? v : own(v))
      const qc = qcRaw
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

      const qPrompt = `누군가 "${aptName}"${where ? ` (${where})` : ''}에 대해 이렇게 물었어: "${q}"\n\n아래는 인터넷에서 모은 관련 글이야:\n\n${context || '(관련 글을 거의 못 찾았어요)'}\n\n이 자료를 바탕으로 질문에 답해줘.\n규칙:\n- 친한 친구한테 귓속말로 알려주듯 "~대요", "~래요", "~는 편이래요" 같은 전달 말투\n- 자료에 근거해서만 답하고, 자료에 없으면 "이건 자료가 부족해서 확실친 않은데요"라고 솔직하게\n- 지어내지 말 것. 모르면 모른다고 해줘\n- 이름이 같은 다른 지역 단지 이야기는 이 단지 이야기가 아니야. 섞지 마\n- 2~4문장, 이모지 없이\n- 마지막에 "직접 확인해보는 게 제일 정확해요" 같은 과신 경계 한 마디를 자연스럽게`

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
      if (answer) res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
      return res.json({ answer })
    }

    // 요약 본체는 _vibe-core.js — 사전 생성 배치(scripts/build-apt-vibe.mjs)와 같은 코드를 쓴다.
    let result
    try {
      result = await generateVibe({ aptName, location, gu })
    } catch (e) {
      console.error('vibe generate error:', e.message)
      return res.json({ categories: [] })
    }
    // 같은 단지를 열 때마다 네이버 5쿼리 + Haiku를 다시 돌 이유가 없다. 엣지에 하루 두고,
    // 만료 뒤에도 일주일은 옛 응답을 먼저 주고 뒤에서 갱신한다.
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
    if (result.empty) return res.json({ categories: [], empty: true })
    return res.json({ categories: result.categories, summary: result.summary, links: result.links })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
