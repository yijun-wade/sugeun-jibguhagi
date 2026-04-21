// 서울 아파트 한줄 요약 배치 생성
// 사용법: ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-summaries.mjs

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const FILE = join(process.cwd(), 'public', 'seoul-apt-enriched.json')
const CONCURRENCY = 3  // 동시 요청 수 (rate limit 대응)
const SAVE_INTERVAL = 50  // N개마다 중간 저장

function parseYear(useAprDay) {
  if (!useAprDay || useAprDay.length < 4) return null
  return parseInt(useAprDay.slice(0, 4))
}

function buildPrompt(apt) {
  const year = parseYear(apt.useAprDay)
  const age = year ? `${year}년 준공 (${new Date().getFullYear() - year}년차)` : null
  const parts = [
    `단지명: ${apt.kaptName}`,
    `위치: ${apt.sigungu} ${apt.dong}`,
    apt.kaptdaCnt ? `세대수: ${apt.kaptdaCnt}세대` : null,
    age,
    apt.codeHeatNm ? `난방: ${apt.codeHeatNm}` : null,
  ].filter(Boolean).join(', ')

  return `다음 아파트 정보를 보고 입주를 고민하는 사람에게 유용한 한줄 특징을 작성해주세요.
${parts}

조건:
- 30자 이내
- "~입니다" 말투
- 세대수·준공연도·위치 중 가장 눈에 띄는 특징 1가지만
- 예시: "2,500세대 대단지로 커뮤니티 시설이 풍부합니다", "2019년 준공 신축으로 최신 설비를 갖췄습니다", "강남구 대치동 학군 중심에 위치합니다"
- 한줄만 출력, 따옴표 없이`
}

async function generateSummary(apt) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    messages: [{ role: 'user', content: buildPrompt(apt) }],
  })
  return msg.content[0].text.trim()
}

async function runBatch(items, fn, concurrency) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const chunkResults = await Promise.all(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}

async function main() {
  const data = JSON.parse(readFileSync(FILE, 'utf-8'))

  const todo = data.filter(a => !a.summary)
  console.log(`총 ${data.length}개 중 ${todo.length}개 생성 필요`)

  if (todo.length === 0) {
    console.log('모두 완료되어 있습니다.')
    return
  }

  let done = 0
  const map = new Map(data.map(a => [a.kaptCode, a]))

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const chunk = todo.slice(i, i + CONCURRENCY)
    await Promise.all(chunk.map(async (apt) => {
      try {
        const summary = await generateSummary(apt)
        map.get(apt.kaptCode).summary = summary
        done++
        process.stdout.write(`\r${done}/${todo.length} 완료`)
      } catch (e) {
        console.error(`\n${apt.kaptName} 실패:`, e.message)
      }
    }))

    if (done % SAVE_INTERVAL === 0) {
      writeFileSync(FILE, JSON.stringify([...map.values()], null, 2))
      process.stdout.write(' [저장됨]')
    }
  }

  writeFileSync(FILE, JSON.stringify([...map.values()], null, 2))
  console.log(`\n완료! ${done}개 생성됨`)
}

main().catch(console.error)
