// 발행 전용 Chrome 기동 + CDP 연결.
//
// 평소 쓰는 크롬과 프로파일을 분리한다. 같은 프로파일을 쓰면
//  - 사람이 브라우저를 켜둔 동안 자동화가 못 붙고(프로파일 잠금),
//  - 자동화가 도는 중에 사람이 탭을 만지면 조작이 엉킨다.
// 네이버 로그인 세션은 이 전용 프로파일 안에만 산다. 최초 1회 사람이 로그인해야 한다.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

const CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// 프로파일을 둘로 나눈다.
//
//  publish — 네이버 로그인 세션이 사는 곳. 창이 보이는 상태로만 쓴다.
//  render  — 카드 이미지 렌더 전용. 로그인이 전혀 필요 없다.
//
// 처음에는 하나였는데, 렌더가 headless로 같은 포트를 먼저 잡으면 그 뒤 로그인하려고
// 띄운 크롬이 "이미 열려 있으니 붙는다" 경로를 타서 보이지 않는 창에 로그인하게 된다.
// 세션도 그쪽에 갇힌다(2026-08-14). 렌더가 로그인 세션을 건드릴 이유가 없으므로 분리한다.
const PROFILES = {
  publish: { dir: '.chrome-publish-profile', port: 9333 },
  render: { dir: '.chrome-render-profile', port: 9334 },
}

export const PORT = PROFILES.publish.port
export const PROFILE_DIR = join(process.cwd(), PROFILES.publish.dir)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function probe(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) })
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

/**
 * 이미 9333이 열려 있으면 새로 띄우지 않고 붙는다.
 * (스펙 STEP 3: 브라우저는 한 번만 띄우고 재사용 — 장마다 5초짜리 기동이 붙지 않게)
 * @returns {{browser, spawned: boolean, close: () => Promise<void>}}
 */
export async function connectChrome({ headless = false, profile = 'publish' } = {}) {
  if (!existsSync(CHROME)) throw new Error(`Chrome을 찾지 못했다: ${CHROME}`)
  const cfg = PROFILES[profile]
  if (!cfg) throw new Error(`알 수 없는 프로파일: ${profile}`)
  // 로그인 세션이 사는 프로파일을 headless로 열면 사람이 로그인할 창이 없어진다.
  if (profile === 'publish' && headless) throw new Error('publish 프로파일은 headless로 열지 않는다 — 로그인 창이 보여야 한다')

  const dir = join(process.cwd(), cfg.dir)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  let info = await probe(cfg.port)
  let child = null

  if (!info) {
    const args = [
      `--remote-debugging-port=${cfg.port}`,
      `--user-data-dir=${dir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate',
      'about:blank',
    ]
    if (headless) args.unshift('--headless=new')

    child = spawn(CHROME, args, { detached: true, stdio: 'ignore' })
    child.unref()

    for (let i = 0; i < 40 && !info; i++) {
      await sleep(250)
      info = await probe(cfg.port)
    }
    if (!info) throw new Error(`Chrome이 ${cfg.port} 포트를 열지 않았다 (10초 대기)`)
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: info.webSocketDebuggerUrl,
    defaultViewport: null,
  })

  return {
    browser,
    spawned: Boolean(child),
    // 붙기만 한 경우엔 프로세스를 죽이지 않는다. 사람이 열어둔 창일 수 있다.
    close: async () => { await browser.disconnect() },
  }
}

/** 빈 탭을 재사용해 페이지를 하나 확보한다. */
export async function newPage(browser) {
  const pages = await browser.pages()
  const blank = pages.find((p) => p.url() === 'about:blank')
  return blank || (await browser.newPage())
}
