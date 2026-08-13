// macOS 알림. 조용한 실패를 막는 유일한 채널이라 여기서 예외를 던지면 안 된다.
// 알림 실패가 파이프라인을 죽이면 본말전도다.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

// AppleScript 문자열 리터럴 이스케이프
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')

export async function notify(title, message, { sound = false } = {}) {
  const script = `display notification "${esc(message)}" with title "${esc(title)}"${sound ? ' sound name "Basso"' : ''}`
  try {
    await run('osascript', ['-e', script], { timeout: 5000 })
    return true
  } catch (e) {
    console.warn(`  (알림 실패: ${e.message})`)
    return false
  }
}

export const notifyFail = (msg) => notify('suzip 발행 실패', msg, { sound: true })
export const notifyOk = (msg) => notify('suzip 발행', msg)
