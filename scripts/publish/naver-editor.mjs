// STEP 2 — 에디터 조립. 임시저장까지만 하고 멈춘다.
//
// ⚠ 이 파일은 발행도 예약도 하지 않는다. 예약 등록(naver-schedule.mjs)은
//   임시저장이 3회 연속 성공한 뒤에 붙인다 — 되돌릴 수 없는 유일한 구간이라서.
//
// 원칙: 조작마다 "했다"가 아니라 "됐다"를 따로 읽는다. 네이버가 에디터를 고치면
// 여기가 먼저 깨지는데, 조용히 깨지면 빈 글이 발행된다.

import { SEL, sleep, humanPause, openEditor, dismissResumePopup, dismissHelpPanel, assertAccount, ensureBlankEditor } from './lib/editor.mjs'
import { stripInline, formatRanges } from './lib/inline.mjs'

/** 에디터가 들고 있는 본문 문단들 (제목 제외) */
const bodyParagraphs = (frame) =>
  frame.$$eval(`${SEL.bodyComponent} ${SEL.paragraph}`, (els) =>
    els.map((e) => (e.innerText || '').replace(/​/g, '').trim()))

const imageCount = (frame) =>
  frame.$$eval('.se-component.se-image img, .se-component-content img', (els) => els.length).catch(() => 0)

/**
 * 마지막 문단 안에서 [start,end) 문자 구간을 선택한다.
 *
 * 키보드 Shift+화살표로 세지 않는다 — 자동완성·줄바꿈 한 번에 어긋난다.
 * DOM Range를 직접 잡으면 문단이 여러 span으로 쪼개져 있어도 정확하다.
 */
/**
 * 방금 친 문단에서 [start,end) 구간을 "키보드로" 선택한다.
 *
 * DOM Range로 선택하면 안 된다. 네이버 에디터는 DOM Selection을 읽지 않고 자체
 * 커서 모델을 쓴다 — Range를 잡아도 굵게 버튼은 에디터 내부 커서(마지막으로 친
 * 위치)에 적용돼서 서식이 다음 문단에 붙는다(2026-08-14 실측, 두 번 재현).
 * 화살표 키는 에디터의 입력 처리를 거치므로 내부 모델이 따라온다.
 *
 * caretPos(문단 내 문자 위치)를 호출부가 들고 있어야 이동 횟수를 계산할 수 있다.
 */
async function selectRangeByKeys(page, caretPos, start, end) {
  for (let i = 0; i < caretPos - end; i++) await page.keyboard.press('ArrowLeft')
  await page.keyboard.down('Shift')
  for (let i = 0; i < end - start; i++) await page.keyboard.press('ArrowLeft')
  await page.keyboard.up('Shift')
  await sleep(150)
}

/**
 * 문단 서식을 바꾼다 (본문 / 소제목 / 인용구).
 *
 * 문단 전체가 굵은 "단독 소제목"에 인라인 볼드를 쓰면 안 된다. 범위가 문단 전체라
 * Shift+화살표가 문단 시작 경계를 넘어 앞 문단까지 물고, 굵게가 엉뚱한 곳에 붙는다
 * (2026-08-14, 12문단 중 4건 실패). 문단 서식은 범위 선택이 필요 없는 문단 단위
 * 조작이라 이 문제가 아예 생기지 않고, 네이버가 소제목으로 인식해 구조도 낫다.
 */
async function setParagraphFormat(frame, label) {
  // 토글 버튼과 옵션 버튼이 같은 data-name="text-format" 을 쓴다. querySelector로
  // 첫 번째를 집으면 상황에 따라 옵션을 눌러 드롭다운이 안 열린다(2026-08-14).
  // 고유 클래스로 갈라 잡는다: 토글 = se-text-format-toolbar-button,
  // 옵션 = se-toolbar-option-text-button.
  const opened = await frame.evaluate(() => {
    const toggle = [...document.querySelectorAll('.se-text-format-toolbar-button')]
      .find((e) => e.offsetParent !== null)
    if (!toggle) return false
    toggle.click()
    return true
  })
  if (!opened) throw new Error('문단 서식 토글을 찾지 못했다')

  // 옵션이 실제로 보일 때까지 기다린다 — 바로 찾으면 아직 안 그려져 있다
  let clicked = false
  for (let i = 0; i < 12 && !clicked; i++) {
    await sleep(250)
    clicked = await frame.evaluate((want) => {
      const opt = [...document.querySelectorAll('.se-toolbar-option-text-button')]
        .filter((e) => e.offsetParent !== null)
        .find((e) => (e.innerText || '').trim().split('\n')[0].trim() === want)
      if (!opt) return false
      opt.click()
      return true
    }, label)
  }
  if (!clicked) throw new Error(`문단 서식 "${label}" 옵션을 찾지 못했다`)
  await sleep(600)
}

/** 선택된 구간에 서식을 건다. 선택이 있어야 한다 — 커서만 있으면 네이버가 텍스트를 복제한다. */
async function applyFormat(frame, name) {
  const sel = name === 'bold' ? SEL.bold : 'button[data-name="italic"]'
  const btn = await frame.$(sel)
  if (!btn) throw new Error(`${name} 버튼을 찾지 못했다`)
  await btn.click()
  await sleep(250)
}

/**
 * 제목 입력. JS 대입은 안 들어간다 — 클릭으로 커서를 놓고 문자로 친다.
 * 제목이 비면 네이버가 조용히 발행을 거부한다.
 */
async function typeTitle(page, frame, title) {
  const want = title.replace(/\s+/g, ' ').trim()
  const read = () => frame.$eval(SEL.title, (e) => (e.innerText || '').replace(/\s+/g, ' ').trim())

  // 팝업을 닫은 직후에는 에디터가 입력을 받지 않는다. 클릭도 타이핑도 조용히 삼켜지고
  // 플레이스홀더('제목')만 남는다(2026-08-14). 팝업이 없던 실행에서는 한 번에 되므로
  // 고정 대기가 아니라 재시도로 흡수한다.
  for (let attempt = 1; attempt <= 3; attempt++) {
    const el = await frame.$(SEL.title)
    if (!el) throw new Error('제목 요소를 찾지 못했다')
    await el.click()
    await sleep(400 * attempt)
    await page.keyboard.type(title, { delay: 18 })
    await sleep(600)

    const got = await read()
    if (got.includes(want)) return got

    // 실패했으면 다음 시도 전에 남은 찌꺼기를 지운다 — 안 지우면 겹쳐 쌓인다
    if (got && got !== '제목') {
      await frame.evaluate((s) => {
        const r = document.createRange()
        r.selectNodeContents(document.querySelector(s))
        const g = window.getSelection(); g.removeAllRanges(); g.addRange(r)
      }, SEL.title)
      await sleep(200)
      await page.keyboard.press('Backspace')
      await sleep(400)
    }
    if (attempt < 3) console.log(`    (제목 입력 재시도 ${attempt + 1}/3)`)
  }
  throw new Error(`제목이 들어가지 않았다 (3회 시도)\n  기대: ${want}\n  실제: ${await read()}`)
}

/** 본문 영역으로 커서를 옮긴다 */
async function focusBody(frame) {
  const el = await frame.$(`${SEL.bodyComponent} ${SEL.paragraph}`)
  if (!el) throw new Error('본문 문단 요소를 찾지 못했다')
  await el.click()
  await sleep(400)
}

/**
 * 블록 하나를 입력한다 — 평문으로 다 친 뒤 범위를 선택해 서식을 건다.
 *
 * 굵게를 먼저 켜고 타이핑하면 안 된다. 커서만 있는 상태에서 툴바를 누르면
 * 네이버가 "현재 단어" 단위로 처리해, 끌 때 그 단어를 평문으로 한 번 더 써넣는다.
 * 실제로 `<b>정부</b>정부 — …` 가 나왔다(2026-08-14).
 */
async function typeBlock(page, frame, md, { standaloneSubhead = false } = {}) {
  const plain = stripInline(md)
  if (!plain) return

  // 문단 전체가 굵은 소제목은 인라인 볼드가 아니라 네이버 문단 서식으로 넣는다.
  // 서식을 먼저 걸고 타이핑해야 범위 선택이 아예 필요 없다.
  if (standaloneSubhead) {
    // 서식은 타이핑 "뒤"에 건다. 먼저 걸고 치면 반영이 불안정하고, 친 직후에
    // 본문으로 되돌리면 커서가 아직 그 문단에 있어 방금 건 소제목이 취소된다
    // (2026-08-14: 소제목이 15px 본문 그대로 나옴). 본문 복귀는 다음 문단에서 한다.
    await page.keyboard.type(plain, { delay: 8 })
    await sleep(300)
    await setParagraphFormat(frame, '소제목')
    const paras0 = await bodyParagraphs(frame)
    const n0 = (t) => (t || '').replace(/\s+/g, '')
    if (!paras0.some((t) => n0(t) === n0(plain))) {
      throw new Error(`소제목이 문단으로 안 남았다: ${plain.slice(0, 30)}`)
    }
    return
  }

  await page.keyboard.type(plain, { delay: 8 })
  await sleep(250)

  // 커서는 방금 친 텍스트의 끝에 있다. 뒤쪽 구간부터 처리하면 이동이 항상 왼쪽이라
  // 위치 계산이 단순해지고, 앞 구간에 서식이 붙어 span이 쪼개져도 영향이 없다.
  const ranges = formatRanges(md).slice().sort((a, b) => b.end - a.end)
  let caret = plain.length
  for (const r of ranges) {
    await selectRangeByKeys(page, caret, r.start, r.end)
    if (r.bold) await applyFormat(frame, 'bold')
    if (r.italic) await applyFormat(frame, 'italic')
    // 선택을 왼쪽 끝으로 접는다 — 커서가 구간 시작으로 간다
    await page.keyboard.press('ArrowLeft')
    caret = r.start
    await sleep(120)
  }

  // 다음 Enter가 문단 중간을 쪼개지 않도록 커서를 문단 끝으로 되돌린다
  for (let i = 0; i < plain.length - caret; i++) await page.keyboard.press('ArrowRight')
  await sleep(150)

  // 친 내용이 문단으로 남았는지 — 복제·누락의 직접 신호
  const paras = await bodyParagraphs(frame)
  const norm = (t) => (t || '').replace(/\s+/g, '')
  if (!paras.some((t) => norm(t) === norm(plain))) {
    throw new Error(`친 내용이 문단으로 안 남았다\n  기대: ${plain.slice(0, 40)}\n  마지막: ${(paras[paras.length - 1] || '').slice(0, 40)}`)
  }
}

/**
 * 이미지 삽입. 사진 버튼을 누르면 파일 선택창이 뜨고, puppeteer가 그걸 받아 처리한다.
 * 검증은 img 개수의 증가분으로 — 절대 수로 보면 앞서 넣은 것 때문에 항상 통과한다.
 */
async function insertImage(page, frame, filePath, { attempts = 2 } = {}) {
  // 업로드는 네이버 서버 왕복이라 느릴 때가 있다. 20초로는 부족해 하루치 첫 글이
  // 통째로 실패했다(2026-08-16). 그날 다른 글은 같은 코드로 성공했으므로 로직이
  // 아니라 시간 문제다. 넉넉히 기다리고, 그래도 안 되면 한 번 더 시도한다.
  let lastErr = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const before = await imageCount(frame)
    try {
      const [chooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 20000 }),
        frame.evaluate((s) => document.querySelector(s)?.click(), SEL.image),
      ])
      await chooser.accept([filePath])
    } catch (e) {
      // 파일 선택창이 안 뜬 것과 업로드가 안 끝난 것은 원인이 다르다 — 구분해서 남긴다
      lastErr = new Error(`파일 선택창이 열리지 않았다 (${attempt}/${attempts}): ${e.message}`)
      await sleep(1500)
      continue
    }

    for (let i = 0; i < 120; i++) { // 최대 60초
      await sleep(500)
      if ((await imageCount(frame)) > before) return true
    }
    lastErr = new Error(`업로드가 60초 안에 끝나지 않았다 (${attempt}/${attempts}): ${filePath.split('/').pop()}`)
    await sleep(2000)
  }
  throw lastErr
}

/**
 * 본문 + 이미지 조립.
 * placements는 afterBlockIndex 오름차순이어야 한다 — 앞에 끼워 넣으면 뒤 인덱스가 밀린다.
 */
async function assembleBody(page, frame, draft, placements, assets) {
  const byIndex = new Map(placements.map((p) => [p.afterBlockIndex, p]))
  const pathOf = (card) => assets.find((a) => a.key === card)?.path

  await focusBody(frame)

  // -1 = 본문 맨 위(대표 이미지)
  if (byIndex.has(-1)) {
    await insertImage(page, frame, pathOf(byIndex.get(-1).card))
    await humanPause()
  }

  let prevWasSubhead = false
  let prevWasImage = byIndex.has(-1)
  for (let i = 0; i < draft.blocks.length; i++) {
    // 문서 첫 이미지 뒤에는 에디터가 남겨둔 빈 문단이 그대로 커서 자리다.
    // 여기서 Enter를 치면 빈 줄이 하나 더 생긴다.
    const afterLeadImage = i === 0 && prevWasImage
    if ((i > 0 || prevWasImage) && !afterLeadImage) {
      // Enter 한 번은 문단만 바꾼다 — 화면에서는 앞 문단에 딱 붙어 보인다.
      // 초안은 문단 사이가 빈 줄로 떨어져 있으므로 빈 문단을 하나 넣어 그 간격을 살린다.
      // 이미지 뒤에는 에디터가 이미 문단을 만들어 두므로 한 번만 친다.
      await page.keyboard.press('Enter')
      await sleep(180)
      if (!prevWasImage) {
        await page.keyboard.press('Enter')
        await sleep(180)
      }
    }
    prevWasImage = false
    // 소제목 다음 문단은 소제목 서식을 물려받는다. 새 문단에서 본문으로 되돌린다.
    if (prevWasSubhead) {
      await setParagraphFormat(frame, '본문')
      prevWasSubhead = false
    }
    const blk = draft.blocks[i]
    const isSubhead = blk.type === 'subhead' && blk.standalone
    await typeBlock(page, frame, blk.text, { standaloneSubhead: isSubhead })
    prevWasSubhead = isSubhead
    await humanPause(250, 700)

    if (byIndex.has(i)) {
      await page.keyboard.press('Enter')
      await sleep(250)
      await insertImage(page, frame, pathOf(byIndex.get(i).card))
      await humanPause()
      prevWasImage = true
    }
  }
}

/** 태그 입력 */
async function typeTags(page, frame, tags) {
  const el = await frame.$(SEL.tagInput)
  if (!el) return { ok: false, reason: '태그 입력칸 없음(발행 패널에서만 보일 수 있음)' }
  await el.click()
  for (const t of tags) {
    await page.keyboard.type(t, { delay: 20 })
    await page.keyboard.press('Enter')
    await sleep(250)
  }
  return { ok: true }
}

/** 임시저장. 저장 건수의 증가분으로 확인한다. */
async function saveDraft(frame) {
  const readCount = () => frame.evaluate(() => {
    const b = document.querySelector('button.save_count_btn__ZTLNa')
    return b ? parseInt((b.innerText || '0').trim(), 10) : null
  })
  const before = await readCount()
  await frame.evaluate((s) => document.querySelector(s)?.click(), SEL.save)

  for (let i = 0; i < 24; i++) {
    await sleep(500)
    const after = await readCount()
    if (before === null || after === null) continue
    if (after > before) return { before, after }
  }
  throw new Error(`임시저장 건수가 늘지 않았다 (기준 ${before})`)
}

/**
 * 조립 본체.
 * @returns {{title:string, blocks:number, images:number, saved:object}}
 */
export async function assemble(page, { draft, placements, assets }) {
  const frame = await openEditor(page)
  await assertAccount(page)
  await dismissHelpPanel(frame)
  const popup = await dismissResumePopup(frame)
  // 팝업을 닫는 것만으로는 빈 에디터가 보장되지 않는다 — 복원된 잔재 위에 덧씌우면
  // 제목·본문이 겹친다. 빈 상태를 확인하고 아니면 비운다.
  const blank = await ensureBlankEditor(page, frame)
  console.log(`  · 진입 (팝업 ${popup.found ? '닫음' : '없음'}, 에디터 ${blank.wasBlank ? '비어 있음' : '비움'})`)

  console.log('  · 제목 입력')
  const title = await typeTitle(page, frame, draft.title)

  console.log(`  · 본문 ${draft.blocks.length}블록 + 이미지 ${placements.length}장`)
  await assembleBody(page, frame, draft, placements, assets)

  // 블록이 통째로 뭉치지 않았는지 — 통짜 붙여넣기 사고의 신호
  const paras = await bodyParagraphs(frame)
  const nonEmpty = paras.filter(Boolean)
  if (nonEmpty.length < draft.blocks.length) {
    throw new Error(`문단이 뭉쳤다: 기대 ${draft.blocks.length}개 이상, 실제 ${nonEmpty.length}개`)
  }

  const imgs = await imageCount(frame)
  if (imgs < placements.length) throw new Error(`이미지 ${placements.length}장 중 ${imgs}장만 들어갔다`)

  // 본문 텍스트가 실제로 들어갔는지 — 첫 블록과 마지막 블록으로 표본 검사
  const joined = nonEmpty.join('\n')
  for (const b of [draft.blocks[0], draft.blocks[draft.blocks.length - 1]]) {
    const want = stripInline(b.text).slice(0, 18).trim()
    if (want && !joined.replace(/\s+/g, '').includes(want.replace(/\s+/g, ''))) {
      throw new Error(`본문이 누락됐다: "${want}…"`)
    }
  }

  console.log('  · 태그')
  await typeTags(page, frame, draft.tags)

  console.log('  · 임시저장')
  const saved = await saveDraft(frame)

  return { title, blocks: nonEmpty.length, images: imgs, saved }
}
