// 오늘의 부동산 브리핑 생성 스크립트
// 사용법: ANTHROPIC_API_KEY=... NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/generate-briefing.mjs

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const NAVER_BLOG = 'https://openapi.naver.com/v1/search/blog.json'
const NAVER_NEWS = 'https://openapi.naver.com/v1/search/news.json'

function stripHtml(str) {
  return (str || '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
}

async function naverSearch(endpoint, query, display = 5) {
  const url = `${endpoint}?query=${encodeURIComponent(query)}&display=${display}&sort=date`
  const r = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
    },
  })
  if (!r.ok) return []
  return (await r.json()).items || []
}

async function main() {
  const targetDate = process.argv[2] // YYYY-MM-DD 형식으로 인자 받기
  const dateObj = targetDate ? new Date(targetDate + 'T09:00:00+09:00') : new Date()
  const today = dateObj.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
    .replace(/\. /g, '-').replace('.', '')
  const isoDate = targetDate || dateObj.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

  const outDir = join(process.cwd(), 'public', 'briefings')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const outFile = join(outDir, `${isoDate}.json`)
  if (existsSync(outFile)) {
    console.log(`이미 존재: ${isoDate}.json`)
    return
  }

  console.log(`브리핑 생성 중: ${isoDate}`)

  const queries = ['부동산 정책', '아파트 매매 전세', '주택 대출 규제', '부동산 시장']
  const results = await Promise.allSettled(queries.map(q => naverSearch(NAVER_NEWS, q, 5)))
  const seen = new Set()
  const allNews = results
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])
    .filter(item => { if (seen.has(item.link)) return false; seen.add(item.link); return true })
    .slice(0, 15)

  if (allNews.length === 0) throw new Error('뉴스를 불러오지 못했어요')

  const newsText = allNews
    .map(item => `- 제목: ${stripHtml(item.title)}\n  내용: ${stripHtml(item.description)}`)
    .join('\n\n')

  const prompt = `오늘(${today}) 부동산 관련 뉴스입니다:\n\n${newsText}\n\n위 뉴스를 바탕으로 아파트 매매나 전월세를 고민하는 실수요자를 위한 브리핑을 작성해줘.\n\n반드시 아래 형식으로만 출력해:\n\n[제목]\n(오늘 부동산 뉴스를 한 줄로 압축한 제목. 핵심 키워드 포함. 20자 이내)\n\n[오늘의 핵심 뉴스]\n뉴스1: (한 줄 요약)\n뉴스2: (한 줄 요약)\n뉴스3: (한 줄 요약)\n\n[정부 의도]\n(정부가 이 정책을 꺼낸 이유와 목적을 2~3문장으로. 쉽게)\n\n[시장 변화]\n(이 정책으로 인해 부동산 시장이 어떻게 달라질지 2~3문장으로)\n\n[실수요자 체감]\n매매: (집 살 사람은 어떻게 느껴지나 한 문장)\n전세: (전세 구하는 사람은 어떻게 느껴지나 한 문장)\n월세: (월세 사는 사람은 어떻게 느껴지나 한 문장)\n\n말투 규칙:\n- 어렵지 않게, 친구한테 설명하듯\n- 전문용어 쓸 때는 바로 풀어서 설명\n- 이모지 금지\n- 다른 설명 없이 위 형식만 출력`

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
  const raw = (await claude.json()).content?.[0]?.text || ''

  const parse = (label) => {
    const regex = new RegExp(`\\[${label}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`)
    return raw.match(regex)?.[1]?.trim() || ''
  }

  const demandRaw = parse('실수요자 체감')
  const result = {
    date: isoDate,
    dateLabel: today,
    title: parse('제목'),
    news: parse('오늘의 핵심 뉴스').split('\n').filter(Boolean).map(l => l.replace(/^뉴스\d+:\s*/, '').trim()),
    intent: parse('정부 의도'),
    market: parse('시장 변화'),
    demand: {
      buy: demandRaw.match(/매매:\s*(.+)/)?.[1]?.trim() || '',
      lease: demandRaw.match(/전세:\s*(.+)/)?.[1]?.trim() || '',
      rent: demandRaw.match(/월세:\s*(.+)/)?.[1]?.trim() || '',
    },
  }

  writeFileSync(outFile, JSON.stringify(result, null, 2))
  console.log(`완료: public/briefings/${isoDate}.json`)

  // index.json 업데이트 — 날짜 내림차순
  const indexFile = join(outDir, 'index.json')
  const existing = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf-8')) : []
  const merged = [{ date: isoDate, title: result.title }, ...existing.filter(e => e.date !== isoDate)]
    .sort((a, b) => b.date.localeCompare(a.date))
  writeFileSync(indexFile, JSON.stringify(merged, null, 2))
  console.log(`index.json 업데이트: ${merged.length}개`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
