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
export const PORT = 9333
export const PROFILE_DIR = join(process.cwd(), '.chrome-publish-profile')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function probe() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(1000) })
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
export async function connectChrome({ headless = false } = {}) {
  if (!existsSync(CHROME)) throw new Error(`Chrome을 찾지 못했다: ${CHROME}`)
  if (!existsSync(PROFILE_DIR)) mkdirSync(PROFILE_DIR, { recursive: true })

  let info = await probe()
  let child = null

  if (!info) {
    const args = [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE_DIR}`,
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
      info = await probe()
    }
    if (!info) throw new Error(`Chrome이 ${PORT} 포트를 열지 않았다 (10초 대기)`)
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
