// 카테고리별 블로그 초안 생성 — 브리핑 외 3종.
// 사용법: ANTHROPIC_API_KEY=... node scripts/generate-category-posts.mjs [YYYY-MM-DD] [--count 3]
//
// 왜 카테고리를 늘리나: 4시간 간격 발행(하루 4편)을 브리핑 하나로 채울 수 없다.
// 같은 카테고리 두 편은 서로 검색 순위를 잡아먹으므로 소재를 카테고리별로 돌린다.
//
// 각 생성기는 반드시 "근거 데이터"를 프롬프트에 실어 보낸다. 데이터 없이 쓰면
// 어느 블로그에나 있는 일반론이 나오고, 그런 글은 노출도 못 받고 계정 품질만 깎는다.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pickTopics, keyOf } from './publish/lib/topics.mjs'

const ROOT = process.cwd()
const POSTS = join(ROOT, 'blog-posts')
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, 'public', p), 'utf-8'))

const args = process.argv.slice(2)
const DATE = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
const COUNT = Number((args.find((a) => a.startsWith('--count=')) || '--count=3').split('=')[1])

// ── 카테고리 정의 ────────────────────────────────────────────
// slug는 파일명에 쓰인다. 발행 파이프라인이 이 이름으로 초안을 찾는다.
const CATEGORY_META = {
  용어사전: { slug: '용어', naver: '진짜 쉬운 용어사전' },
  정책: { slug: '정책', naver: '요즘 부동산 정책' },
  임장가이드: { slug: '임장가이드', naver: '동네 임장 가이드' },
}

// ── 후보 풀 ──────────────────────────────────────────────────
function buildPools() {
  const pools = { 용어사전: [], 정책: [], 임장가이드: [] }

  try {
    for (const g of readJson('glossary.json')) {
      pools.용어사전.push({ category: '용어사전', subject: g.term, data: g })
    }
  } catch (e) { console.warn(`  glossary 로드 실패: ${e.message}`) }

  try {
    for (const p of readJson('policies.json').policies) {
      pools.정책.push({ category: '정책', subject: p.name, data: p })
    }
  } catch (e) { console.warn(`  policies 로드 실패: ${e.message}`) }

  try {
    const apts = readJson('seoul-apt-enriched.json')
    const prices = readJson('apt-prices.json')
    const byGu = new Map()
    for (const a of apts) {
      if (!a.sigungu) continue
      if (!byGu.has(a.sigungu)) byGu.set(a.sigungu, [])
      byGu.get(a.sigungu).push({ ...a, price: prices[a.kaptCode] || null })
    }
    for (const [gu, list] of byGu) {
      // 실거래가가 붙은 단지가 충분한 구만 쓴다 — 숫자 없는 임장 가이드는 일반론이 된다
      const priced = list.filter((a) => a.price?.avg)
      if (priced.length < 8) continue
      pools.임장가이드.push({ category: '임장가이드', subject: gu, data: { gu, total: list.length, priced } })
    }
  } catch (e) { console.warn(`  아파트 데이터 로드 실패: ${e.message}`) }

  return pools
}

/** 이미 쓴 소재 — 파일명에서 역산한다. 별도 장부를 두면 파일과 어긋난다. */
function usedKeys() {
  const used = []
  for (const f of readdirSync(POSTS)) {
    const m = f.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/)
    if (!m) continue
    const name = m[1]
    if (name.includes('부동산브리핑')) continue
    for (const [cat, meta] of Object.entries(CATEGORY_META)) {
      if (name.endsWith(meta.slug)) used.push(`${cat}:${name.slice(0, -meta.slug.length)}`)
    }
  }
  return used
}

// ── 프롬프트 ─────────────────────────────────────────────────
const TONE = `
말투 규칙 (반드시 지킬 것):
- 사람이 쓴 것처럼. AI 느낌 절대 금지
- 1인칭: "저도", "제 생각엔", "~것 같아요"
- 독자에게 말 걸듯: "~하시죠?", "~하더라고요"
- 이모지 금지 (글 전체에 0개)
- ──── 구분선 금지
- "## 📊" 같은 AI스러운 소제목 금지
- 소제목은 헤더(#) 없이 **굵은 글씨** 한 줄로

형식 규칙:
- 소제목 3~4개로 나눌 것 (각각 **굵게** 한 줄, 그 아래 문단)
- 마지막 문단 다음 줄: 관심 단지 실거래가가 궁금하시면 suzip.kr에서 확인해보세요.
- 맨 마지막 줄: *개인적으로 정리한 내용이에요. 투자 판단의 근거로 사용하지 마세요.*

[출력 형식 — 반드시 이대로만]
[제목]
(클릭하고 싶은 제목, 32자 이내)

[본문]
(마크다운)

[태그]
(태그 5~7개, 쉼표로 구분)

다른 설명 없이 위 형식만 출력.`

function promptFor(topic) {
  const d = topic.data
  if (topic.category === '용어사전') {
    return `부동산 초보에게 "${d.term}"을 설명하는 블로그 글을 써줘. 1200자 내외.

[근거 데이터 — 이 내용을 벗어나지 말 것]
용어: ${d.term} (분류: ${d.category})
한줄 정의: ${d.definition}
쉬운 설명: ${d.explain}
예시: ${d.example}

이 용어를 몰라서 실제로 손해 보거나 헷갈리는 상황을 하나 들고, 그걸 풀어주는 방식으로 써줘.
${TONE}`
  }

  if (topic.category === '정책') {
    return `부동산 정책 "${d.name}"을 실수요자 눈높이로 풀어주는 블로그 글을 써줘. 1200자 내외.

[근거 데이터 — 이 내용을 벗어나지 말 것. 없는 수치·기한을 지어내지 말 것]
정책명: ${d.name}
요약: ${d.summary}
상세: ${d.detail}
상태: ${d.status}

"나한테 해당되나?"를 판단할 수 있게 써줘. 조건이 데이터에 없으면 단정하지 말고
"확인해보셔야 해요"로 열어둘 것.
${TONE}`
  }

  if (topic.category === '임장가이드') {
    const byDong = new Map()
    for (const a of d.priced) {
      if (!byDong.has(a.dong)) byDong.set(a.dong, [])
      byDong.get(a.dong).push(a)
    }
    const lines = [...byDong.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .map(([dong, list]) => {
        const top = list.sort((a, b) => b.price.avg - a.price.avg).slice(0, 5)
          .map((a) => `    - ${a.kaptName}: ${(a.price.avg / 10000).toFixed(1)}억 (${a.kaptdaCnt}세대${a.useAprDay ? `, ${a.useAprDay.slice(2, 4)}년` : ''})`)
        return `  ${dong} (단지 ${list.length}개)\n${top.join('\n')}`
      })
    return `서울 ${d.gu} 동네별 임장 가이드를 써줘. 1500자 내외.

[근거 데이터 — 실거래 기반. 여기 없는 단지·가격을 지어내지 말 것]
${d.gu} 전체 단지 ${d.total}개, 실거래가 확인된 단지 ${d.priced.length}개
${lines.join('\n')}

동네별로 나눠서, 각 동의 성격(교통·학군·연식·가격대)을 위 데이터에 근거해 설명해줘.
단지명과 가격은 위 목록에서만 인용할 것. 지하철 노선처럼 데이터에 없는 사실은
일반적으로 알려진 수준에서만 언급하고 단정하지 말 것.
${TONE}`
  }
  throw new Error(`알 수 없는 카테고리: ${topic.category}`)
}

// ── Claude 호출 ──────────────────────────────────────────────
async function generate(topic) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      messages: [{ role: 'user', content: promptFor(topic) }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API 오류: ${res.status} ${await res.text().catch(() => '')}`)
  const raw = (await res.json()).content?.[0]?.text || ''

  const parse = (label) =>
    raw.match(new RegExp(`\\[${label}\\]\\n([\\s\\S]*?)(?=\\n\\[(?:제목|본문|태그)\\]|$)`))?.[1]?.trim() || ''

  const title = parse('제목')
  const body = parse('본문')
  const tags = parse('태그')
  // 상류 파싱이 실패하면 `# [본문]` 같은 잔재가 초안에 남아 발행까지 흘러간다.
  // 실제로 그런 초안이 2편 있었다. 여기서 막는다.
  if (!title || !body) throw new Error(`응답 파싱 실패 (제목 ${title.length}자 / 본문 ${body.length}자)`)
  if (/\[(제목|본문|태그)\]/.test(body)) throw new Error('본문에 라벨이 남아 있다')

  return { title, body, tags }
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  const pools = buildPools()
  const used = usedKeys()
  console.log(`소재 풀: ${Object.entries(pools).map(([k, v]) => `${k} ${v.length}`).join(' / ')} (사용됨 ${used.length})`)

  const { picked, warnings } = pickTopics(pools, used, COUNT, DATE)
  warnings.forEach((w) => console.warn(`  ⚠ ${w}`))
  if (!picked.length) { console.log('뽑을 소재가 없다'); return }

  for (const topic of picked) {
    const meta = CATEGORY_META[topic.category]
    const safe = String(topic.subject).replace(/[\/\\:*?"<>|\s]/g, '')
    const out = join(POSTS, `${DATE}-${safe}${meta.slug}.md`)
    if (existsSync(out)) { console.log(`  이미 존재: ${out.split('/').pop()}`); continue }

    try {
      const { title, body, tags } = await generate(topic)
      writeFileSync(out, `# ${title}\n\n> 카테고리: ${meta.naver}\n> 태그: ${tags}\n> 발행: 전체공개\n\n${body}\n`)
      console.log(`  ✅ ${topic.category} — ${topic.subject} → ${out.split('/').pop()}`)
    } catch (e) {
      console.error(`  ❌ ${topic.category} — ${topic.subject}: ${e.message}`)
    }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
