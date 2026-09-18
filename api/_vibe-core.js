// 수근수근 요약의 본체 — /api/vibe(실시간)와 scripts/build-apt-vibe.mjs(사전 생성)가 같이 쓴다.
//
// 왜 나눴나: 요약은 방문마다 네이버 5쿼리 + Haiku 1회를 새로 돌아 5~6초 뒤에 떴다(2026-09 실측,
// 평균 세션 15~27초). 크롤러에는 아예 안 보였다. 미리 만들어 정적 파일로 두려면
// 배치가 API와 똑같은 수집·필터·프롬프트·파서를 써야 한다 — 두 벌이 되면 반드시 어긋난다.
import { stripHtml, naverSearch as defaultSearch, NAVER_BLOG, NAVER_CAFE, NAVER_NEWS, NAVER_KIN } from './_utils.js'
import { filterRelevant, mentionsSubject } from './_vibe-filter.js'

export const VIBE_MODEL = 'claude-haiku-4-5-20251001'
// 이보다 글이 적으면 요약하지 않는다. 글 한두 개로 만든 "동네 분위기"는 그 글의 요약일 뿐이고,
// 사전 생성에서는 그 빈약한 결과가 한 달 동안 고정된다.
export const MIN_SOURCES = 3
const LABELS = ['교통', '학군', '분위기', '이슈']

function formatItems(items, tag) {
  return items
    .map(item => `[${tag}] 제목: ${stripHtml(item.title)}\n내용: ${stripHtml(item.description)}`)
    .join('\n\n')
}

export function parseVibe(text) {
  const t = String(text || '')
  const categories = LABELS.map(label => {
    const match = t.match(new RegExp(`\\[${label}\\]([\\s\\S]*?)(?=\\[|$)`))
    const lines = match
      ? match[1].split('\n').map(l => l.trim()).filter(l => l && l !== '정보 없음')
      : []
    return { label, lines }
  })
  const summaryMatch = t.match(/\[총평\]([\s\S]*?)(?=\[|$)/)
  const summary = summaryMatch
    ? summaryMatch[1].split('\n').map(l => l.trim()).filter(l => l && l !== '정보 없음')[0] || null
    : null
  return { categories, summary }
}

/** 네이버에서 글을 모아 동명 단지 글을 거른다. */
export async function collectSources({ aptName, location, gu }, deps = {}) {
  const search = deps.naverSearch || defaultSearch
  // 단지명으로 검색한 결과에만 필터 적용 — 동 이름으로 검색한 글은 애초에 그 동네 이야기다.
  const own = (items) => filterRelevant(items, { aptName, gu, dong: location, requireSubject: true })
  const settled = await Promise.allSettled([
    search(NAVER_BLOG, `${aptName} 살아보니`),
    search(NAVER_BLOG, location ? `${location} 동네 분위기` : `${aptName} 동네 분위기`),
    search(NAVER_CAFE, location ? `${location} 살기 어때` : `${aptName} 살기 어때`),
    search(NAVER_NEWS, `${aptName}`, 3),
    search(NAVER_KIN, `${aptName} 어때요`, 4),
  ])
  const [b1, blog2, cafeRaw, n1, k1] = settled.map(r => r.status === 'fulfilled' ? r.value : [])
  const blog1 = own(b1), news = own(n1), kin = own(k1)
  // 동 이름으로 검색해도 절·맛집·다른 동 글이 걸린다("공덕동 동네 분위기" → "성북동 길상사").
  // 동 이름이 본문에 실제로 나온 글만 쓴다.
  const aboutDong = (items) => items.filter(i => stripHtml(`${i.title} ${i.description}`).replace(/\s+/g, '').includes(location))
  const blogDong = location ? aboutDong(blog2) : own(blog2)
  const cafe = location ? aboutDong(cafeRaw) : own(cafeRaw)

  const seen = new Set()
  const dedup = (items) => items.filter(i => {
    if (seen.has(i.link)) return false
    seen.add(i.link)
    return true
  })
  const groups = [
    ['블로그', dedup([...blog1, ...blogDong]).slice(0, 6)],
    ['카페', dedup(cafe).slice(0, 3)],
    ['뉴스', dedup(news).slice(0, 3)],
    ['지식인', dedup(kin).slice(0, 4)],
  ]
  const sections = groups.map(([tag, items]) => formatItems(items, tag)).filter(Boolean).join('\n\n---\n\n')
  const all = groups.flatMap(([tag, items]) => items.map(i => ({ tag, item: i })))
  // 사람에게 보여줄 원문 링크는 이 단지를 직접 말한 글만(동네 글·맛집 글 제외).
  const links = all
    .filter(({ item }) => item.link && mentionsSubject(item, { aptName }))
    .slice(0, 5)
    .map(({ tag, item }) => ({ tag, title: stripHtml(item.title), link: item.link }))
  return { sections, count: all.length, links }
}

export function buildSummaryPrompt({ aptName, location, gu, sections, aptType }) {
  const where = [gu, location].filter(Boolean).join(' ')
  // 임대 단지를 보러 오는 사람은 매수자가 아니라 입주 예정자다(2026-09 실측: 질문이 소음·주차·관리비·내부 구조).
  // 실제로 "청년·저소득층 중심의 동네 같은데"라는 총평이 나왔다 — 읽는 사람이 바로 그 입주자다.
  const rentalRule = aptType === 'rental'
    ? `\n- 이 단지는 공공임대·청년주택이야. 당첨됐거나 신청을 고민하는 사람이 읽어. 입주해서 살기에 어떤지(소음·주차·관리비·내부 구조·수납·주변 편의) 중심으로 써줘\n- 거주자의 소득·계층을 평가하거나 짐작하는 말은 쓰지 마. 매매가·투자 가치 이야기도 하지 마`
    : ''
  return `다음은 "${aptName}"${where ? ` (${where})` : ''} 관련 인터넷 글이야. 블로그 후기, 카페 글, 뉴스, 지식인 Q&A를 포함해.\n\n${sections}\n\n이 내용을 바탕으로, 이 동네에 실제로 살거나 이사를 고민하는 사람들이 카페에서 소곤소곤 나눌 법한 말투로 요약해줘.\n딱딱한 분석이나 리포트 말투 금지. 친한 친구한테 귓속말로 알려주는 느낌으로.\n\n출력 형식 (반드시 지켜줘):\n[교통]\n한 줄 내용\n한 줄 내용\n[학군]\n한 줄 내용\n한 줄 내용\n[분위기]\n한 줄 내용\n한 줄 내용\n[이슈]\n한 줄 내용\n한 줄 내용\n[총평]\n한 줄 종합 평가\n\n말투 규칙:\n- "~대요", "~래요", "~다고들 해요", "~다네요", "~는 편이에요" 같은 전달 말투 사용\n- 숫자나 구체적 사실은 살려줘 (예: "지하철역까지 걸어서 5분이래요", "학교가 도보 10분이래요")\n- 이모지 사용 금지\n- 각 줄은 15~45자 이내\n- 총평은 이 동네를 한 줄로 — 친구한테 "거기 살 만해?" 물어봤을 때 대답하듯이\n- 교통은 지하철·버스 접근성, 출퇴근 혼잡도 중심\n- 학군은 초·중·고 학교 수준, 학원가, 교육 환경 중심\n- 분위기는 동네 성격·주민층·거리 느낌·상권 중심\n- 이슈는 최근 개발 소식·주민 불만·핫토픽 중심\n- 이름이 같은 다른 지역 단지 이야기는 버려. 이 단지는 ${where || '위에 적힌 곳'}에 있어\n- 동네 전체 소식과 이 단지의 일을 구분해. 옆 단지·동네의 재건축이나 분양 소식을 이 단지 일처럼 쓰지 마\n- 정보가 부족한 카테고리는 "정보 없음"으로 채워줘${rentalRule}\n- 다른 설명 없이 위 형식만 출력`
}

// 실시간 API는 지연 때문에 Haiku, 사전 생성 배치는 상위 모델을 쓴다(한 달에 한 번 도는 일이라
// 단지당 몇 원 차이고, Haiku는 "공덕역 2호선"(실제 5·6호선) 같은 사실 오류를 냈다).
export const BATCH_MODEL = 'claude-opus-5'

export async function callClaude(prompt, { model = VIBE_MODEL, maxTokens } = {}) {
  const isHaiku = model.startsWith('claude-haiku')
  const body = { model, messages: [{ role: 'user', content: prompt }] }
  const headers = {
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  }
  if (isHaiku) {
    body.max_tokens = maxTokens || 800
  } else {
    // Opus 5·Sonnet 5는 생각이 기본으로 켜져 있고 그 토큰도 max_tokens에 든다. 요약은 가벼운 일이라 effort는 낮게.
    body.max_tokens = maxTokens || 6000
    body.output_config = { effort: 'low' }
    if (model === 'claude-opus-5') {
      // 안전 분류기가 요청을 거절하면 서버가 권장 모델로 같은 요청을 다시 돌린다.
      body.fallbacks = 'default'
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'
    }
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    const e = new Error(`Anthropic ${r.status}: ${err?.error?.message || ''}`)
    e.status = r.status
    throw e
  }
  const data = await r.json()
  if (data?.stop_reason === 'refusal') throw new Error('Anthropic refusal')
  // 생각 블록이 앞에 올 수 있다 — content[0]이 아니라 text 블록을 찾는다.
  const text = (data?.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
  callClaude.lastUsage = data?.usage || null
  return text
}

/**
 * @returns {{empty:true, sourceCount:number} | {categories:Array, summary:string|null, sourceCount:number, links:Array}}
 */
export async function generateVibe(ctx, deps = {}) {
  const callModel = deps.callModel || ((prompt) => callClaude(prompt, { model: deps.model }))
  const { sections, count, links } = await collectSources(ctx, deps)
  if (count < MIN_SOURCES) return { empty: true, sourceCount: count }
  const text = await callModel(buildSummaryPrompt({ ...ctx, sections }))
  const { categories, summary } = parseVibe(text)
  if (!summary && categories.every(c => c.lines.length === 0)) return { empty: true, sourceCount: count }
  return { categories, summary, sourceCount: count, links }
}
