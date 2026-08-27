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
  실거래가분석: { slug: '실거래가', naver: '실거래가 분석' },
}

// ── 후보 풀 ──────────────────────────────────────────────────
function buildPools() {
  const pools = { 용어사전: [], 정책: [], 임장가이드: [], 실거래가분석: [] }

  try {
    for (const g of readJson('glossary.json')) {
      pools.용어사전.push({ category: '용어사전', subject: g.term, data: g })
    }
  } catch (e) { console.warn(`  glossary 로드 실패: ${e.message}`) }

  // 큐레이션(policies.json)과 자동 수집(policies-auto.json)을 합친다.
  // 전자는 서비스 페이지(PolicyPage)가 쓰는 검수된 데이터, 후자는 블로그 소재 전용이다.
  // 자동 수집분을 서비스 페이지에 섞지 않는 이유는 collect-policies.mjs 주석 참조.
  try {
    const seen = new Set()
    for (const file of ['policies.json', 'policies-auto.json']) {
      let list = []
      try { list = readJson(file).policies || [] } catch { continue }
      for (const p of list) {
        const k = String(p.name || '').replace(/\s+/g, '')
        if (!k || seen.has(k)) continue
        seen.add(k)
        pools.정책.push({ category: '정책', subject: p.name, data: p })
      }
    }
  } catch (e) { console.warn(`  policies 로드 실패: ${e.message}`) }

  try {
    const apts = readJson('seoul-apt-enriched.json')
    const prices = readJson('apt-prices.json')
    let trend = {}
    try { trend = readJson('apt-price-trend.json') } catch { /* 없어도 진행 */ }
    const withPrice = apts
      .filter((a) => a.sigungu && a.dong && prices[a.kaptCode]?.avg)
      .map((a) => ({ ...a, price: prices[a.kaptCode], series: trend[a.kaptCode] || null }))

    // ── 임장가이드: 동 단위 ──────────────────────────────────
    // 구 단위(25개)는 한 달이면 소진된다. 동으로 쪼개면 117개가 나오고,
    // 글도 "노원구 전체"보다 "상계동"이 구체적이라 검색 의도에 더 맞는다.
    const byDong = new Map()
    for (const a of withPrice) {
      const k = `${a.sigungu} ${a.dong}`
      if (!byDong.has(k)) byDong.set(k, [])
      byDong.get(k).push(a)
    }
    for (const [k, list] of byDong) {
      // 실거래가 5건 미만이면 "동네"를 말할 근거가 부족하다 — 일반론이 된다
      if (list.length < 5) continue
      const [gu, dong] = k.split(' ')
      pools.임장가이드.push({ category: '임장가이드', subject: k, data: { gu, dong, list } })
    }

    // ── 실거래가 분석: 단지 단위 ─────────────────────────────
    // 거래 1건짜리는 우연일 수 있어 2건 이상만 쓴다. 동·구 평균과 비교해야
    // "비싼가 싼가"를 말할 수 있으므로 평균을 같이 실어 보낸다.
    const dongAvg = new Map()
    for (const [k, list] of byDong) {
      dongAvg.set(k, Math.round(list.reduce((s2, a) => s2 + a.price.avg, 0) / list.length))
    }
    for (const a of withPrice) {
      if ((a.price.count || 0) < 2) continue
      if (!a.kaptdaCnt || a.kaptdaCnt < 100) continue // 소규모는 비교 근거가 약하다
      const k = `${a.sigungu} ${a.dong}`
      pools.실거래가분석.push({
        category: '실거래가분석',
        subject: a.kaptName,
        data: { apt: a, dongAvg: dongAvg.get(k), dongCount: byDong.get(k)?.length || 0 },
      })
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

[제목 규칙 — 노출을 좌우한다]
제목이 일반적일수록 뉴스 기사 수천 건과 경쟁해 검색에서 밀린다.
실측(2026-08-27): 경쟁 20건 이하 제목은 노출 100%, 경쟁 100건 넘는 제목은 전부 30위 밖.
  ❌ "세제 개편이 전세난을 부른다" (경쟁 238건 → 밀림)
  ❌ "양도세 강화, 1주택자인 저도 세금 더 내나요?" (경쟁 10,300건 → 밀림)
  ✅ "DSR 몰라서 대출 2억 덜 받았던 썰 풉니다" (경쟁 6건 → 6위)
그래서 제목에는 반드시 다음 중 하나 이상을 넣어라:
 - 고유명사(단지명·동명·구체적 제도명)
 - 구체적 숫자(금액·비율·기간)
 - 1인칭 경험담 어투("~했던", "~해봤더니")
뉴스 헤드라인처럼 들리는 제목은 쓰지 마라 — 그건 언론사와 싸우는 것이다.

[출력 형식 — 반드시 이대로만]
[제목]
(위 규칙을 지킨 제목, 32자 이내)

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
    // 상위만 보여주면 "저렴한 곳은 6억대"처럼 실제보다 비싸게 말한다(실측: 5.1억 단지를
    // 못 봄). 가격대 분포를 말하는 글이므로 위·아래를 모두 실어야 한다.
    const sorted = d.list.slice().sort((a, b) => b.price.avg - a.price.avg)
    // 단지 대표값만 쓰면 어느 평형인지 모른 채 "이 단지 12억"이 된다.
    // 대표 면적을 함께 밝히고, 평형이 여럿이면 폭도 같이 준다.
    const fmt = (a) => {
      const ar = a.price.areas || []
      const span = ar.length >= 2
        ? `, ${ar[0].area}~${ar[ar.length - 1].area}㎡ ${(ar[0].median / 10000).toFixed(1)}~${(ar[ar.length - 1].median / 10000).toFixed(1)}억`
        : ''
      return `  - ${a.kaptName}: ${(a.price.avg / 10000).toFixed(1)}억(${a.price.mainArea}㎡ 기준), 평당 ${a.price.perPy}만원${span} (${a.kaptdaCnt}세대${a.useAprDay ? `, ${a.useAprDay.slice(0, 4)}년` : ''})`
    }
    const top = sorted.length <= 12
      ? sorted.map(fmt)
      : [...sorted.slice(0, 7).map(fmt), `  … (중간 ${sorted.length - 12}개 생략)`, ...sorted.slice(-5).map(fmt)]
    const avg = Math.round(d.list.reduce((s2, a) => s2 + a.price.avg, 0) / d.list.length)
    const lo = sorted[sorted.length - 1], hi = sorted[0]
    return `서울 ${d.gu} ${d.dong} 아파트 임장 가이드를 써줘. 1400자 내외.

[근거 데이터 — 실거래 기반. 여기 없는 단지·가격을 지어내지 말 것]
${d.gu} ${d.dong}, 실거래 확인된 단지 ${d.list.length}개, 평균 ${(avg / 10000).toFixed(1)}억
가격대: 최저 ${(lo.price.avg / 10000).toFixed(1)}억(${lo.kaptName}) ~ 최고 ${(hi.price.avg / 10000).toFixed(1)}억(${hi.kaptName})
${top.join('\n')}

이 동네를 처음 보는 사람이 "여기 나한테 맞나"를 판단할 수 있게 써줘.
가격대 분포(제일 비싼 곳과 저렴한 곳의 차이가 왜 나는지), 연식과 세대수로 본 성격,
어떤 사람에게 맞는 동네인지. 단지명·가격·세대수·연식은 위 목록에서만 인용할 것.
가격을 말할 때는 반드시 면적을 함께 밝혀라 — 같은 단지도 평형마다 값이 크게 다르다.
지하철·학군처럼 데이터에 없는 사실은 단정하지 말고 일반적으로 알려진 수준에서만.
${TONE}`
  }

  if (topic.category === '실거래가분석') {
    const a = d.apt
    const diff = d.dongAvg ? Math.round(((a.price.avg - d.dongAvg) / d.dongAvg) * 100) : null
    const 억 = (v) => (v / 10000).toFixed(1)

    // 면적별 분포. 예전에는 평형을 섞은 평균 하나만 줘서, 어느 평형도 아닌
    // 숫자를 "이 단지 가격"으로 쓰게 됐다. 같은 단지에서 9억 벌어지는 경우도 있다.
    const areaLines = (a.price.areas || []).map((x) =>
      `  ${x.area}㎡(${x.py}평): 중앙값 ${억(x.median)}억, 범위 ${억(x.min)}~${억(x.max)}억, 평당 ${x.perPy}만원 (${x.count}건)`)

    // 추세. "비싼가 싼가"만 말하고 "오르는 중인가"를 못 말하던 빈칸을 채운다.
    let trendLine = '추세 데이터 없음'
    if (a.series && a.series.length >= 3) {
      const f = a.series[0], l = a.series[a.series.length - 1]
      const pct = Math.round(((l.avg - f.avg) / f.avg) * 100)
      const pts = a.series.map((s2) => `${s2.ym.slice(2, 4)}.${s2.ym.slice(4)} ${억(s2.avg)}억(${s2.count}건)`).join(' → ')
      trendLine = `${f.ym} ${억(f.avg)}억 → ${l.ym} ${억(l.avg)}억 (${pct > 0 ? '+' : ''}${pct}%)\n월별: ${pts}`
    }

    return `"${a.kaptName}" 실거래가를 분석하는 블로그 글을 써줘. 1400자 내외.

[근거 데이터 — 여기 없는 수치를 지어내지 말 것]
단지명: ${a.kaptName}
위치: ${a.sigungu} ${a.dong} (${a.doroJuso || '주소 미상'})
세대수: ${a.kaptdaCnt}세대${a.kaptDongCnt ? ` / ${a.kaptDongCnt}개 동` : ''}
준공: ${a.useAprDay ? `${a.useAprDay.slice(0, 4)}년 ${Number(a.useAprDay.slice(4, 6))}월` : '미상'}
난방: ${a.codeHeatNm || '미상'}

■ 면적별 실거래 (최근 12개월, 총 ${a.price.totalCount}건)
${areaLines.join('\n')}

■ 가격 추세
${trendLine}

■ 동네 비교
같은 동(${a.dong}) 평균: ${d.dongAvg ? `${억(d.dongAvg)}억 (단지 ${d.dongCount}개)` : '비교 불가'}
동네 평균 대비: ${diff === null ? '비교 불가' : `${diff > 0 ? '+' : ''}${diff}%`}
단지 소개: ${a.summary || '없음'}

[반드시 지킬 것]
- "이 단지 얼마"라고 뭉뚱그리지 마라. 평형마다 값이 다르므로 면적을 반드시 밝혀라.
- 추세가 있으면 "오르는 중인지 내리는 중인지"를 말해라. 없으면 없다고 해라.
- 거래 건수가 적은 면적은 그 사실을 밝혀라. 2~3건짜리는 우연일 수 있다.
- 예산을 가진 사람이 "나는 어느 평형을 봐야 하나"를 판단할 수 있게 써라.
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
