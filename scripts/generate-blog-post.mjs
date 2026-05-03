// 브리핑 JSON → 네이버 블로그 초안 자동 생성
// 사용법: node scripts/generate-blog-post.mjs [YYYY-MM-DD]
// 날짜 생략 시 오늘 기준

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

async function main() {
  const targetDate = process.argv[2]
  const dateStr = targetDate || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

  const briefingPath = join(process.cwd(), 'public', 'briefings', `${dateStr}.json`)
  if (!existsSync(briefingPath)) {
    console.error(`브리핑 파일 없음: ${briefingPath}`)
    process.exit(1)
  }

  const outPath = join(process.cwd(), 'blog-posts', `${dateStr}-부동산브리핑.md`)
  if (existsSync(outPath)) {
    console.log(`이미 존재: ${outPath}`)
    return
  }

  const briefing = JSON.parse(readFileSync(briefingPath, 'utf-8'))

  const prompt = `다음 부동산 브리핑 데이터를 바탕으로 네이버 블로그 글을 써줘.

[브리핑 데이터]
날짜: ${briefing.date}
제목: ${briefing.title}
핵심 뉴스:
- ${briefing.news.join('\n- ')}
정부 의도: ${briefing.intent}
시장 변화: ${briefing.market}
실수요자 체감:
- 매매: ${briefing.demand.buy}
- 전세: ${briefing.demand.lease}
- 월세: ${briefing.demand.rent}

[글 형식 — 반드시 이 형식으로만 출력]

[제목]
(클릭하고 싶은 제목. 브리핑 제목을 그대로 쓰지 말고 재해석. 25자 이내)

[본문]
(아래 규칙을 따르는 블로그 글. 마크다운 형식)

형식 규칙:
- 맨 위에 요약 3줄 (굵은 텍스트 + 대시): **정부** — 한줄 / **시장** — 한줄 / **실수요자** — 한줄
- 그 아래 --- 구분선 한 번만
- 본문은 자연스러운 문단 전개. 소제목은 헤더(#) 없이 **굵은 글씨**로 인라인으로 시작
- 600~800자 분량
- 마지막 문단 다음 줄: 관심 단지 실거래가가 궁금하시면 suzip.kr에서 확인해보세요.
- 맨 마지막 줄: *뉴스를 바탕으로 개인적으로 정리한 내용이에요. 투자 판단의 근거로 사용하지 마세요.*

말투 규칙:
- 사람이 쓴 것처럼. AI 느낌 절대 금지
- 1인칭: "저도", "제 생각엔", "~것 같아요"
- 독자에게 말 걸듯: "~하시죠?", "~하더라고요"
- 이모지 금지 (글 전체에 0개)
- ──── 구분선 금지
- "실수요자 입장에서는?" 같은 딱딱한 섹션 금지
- ## 📊 같은 AI스러운 소제목 금지

[태그]
(네이버 블로그 태그 5~7개, 쉼표로 구분)

다른 설명 없이 위 형식만 출력.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) throw new Error(`Claude API 오류: ${res.status}`)
  const raw = (await res.json()).content?.[0]?.text || ''

  const parse = (label) => {
    const regex = new RegExp(`\\[${label}\\]\\n([\\s\\S]*?)(?=\\n\\[|$)`)
    return raw.match(regex)?.[1]?.trim() || ''
  }

  const title = parse('제목')
  const body = parse('본문')
  const tags = parse('태그')

  const md = `# ${title}

> 카테고리: 부동산 브리핑
> 태그: ${tags}
> 발행: 전체공개

${body}
`

  writeFileSync(outPath, md)
  console.log(`완료: ${outPath}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
