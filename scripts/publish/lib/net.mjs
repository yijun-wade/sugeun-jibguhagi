// 네트워크가 실제로 살아난 뒤에만 발행을 시작한다.
//
// 왜 필요한가 — launchd는 맥을 깨우지 못한다. 7:30·13:00에 맥이 자고 있으면 작업은
// "다음 깨어남"으로 밀리는데, 배터리로 딥슬립 중인 맥은 15분마다 2초짜리 DarkWake만
// 반복한다. 그 2초 창에서 크롬을 띄우고 네이버로 이동하다 와이파이가 내려가면
// net::ERR_NETWORK_CHANGED로 죽는다. 2026-08-17~09-02, 17일 연속 이 이유로 0편이었다.
//
// 더 나쁜 건 오진이었다. 이동이 실패한 뒤 URL만 보고 "세션 만료 — 사람이 로그인해야 한다"로
// 판정해, 멀쩡한 로그인을 17번 의심했다. 그래서 이 게이트는 실패 사유를 가르는 근거도 된다.

const PROBE_URL = 'https://blog.naver.com/'

/** 한 번 찔러본다. 네트워크가 없으면 즉시 실패하므로 타임아웃은 짧게. */
export async function reachable(timeoutMs = 4000) {
  try {
    const r = await fetch(PROBE_URL, { method: 'HEAD', signal: AbortSignal.timeout(timeoutMs) })
    return r.ok || r.status < 500
  } catch {
    return false
  }
}

/**
 * 네이버에 닿을 때까지 기다린다.
 *
 * 깨어남 직후 와이파이 재연결은 보통 수 초~수십 초다. 다만 맥이 곧바로 다시 잠들면
 * 이 프로세스도 함께 얼었다가 다음 깨어남에 이어서 돈다 — 그래서 대기 상한은
 * "경과 시간"이 아니라 "시도 횟수"로 잡는다. 자다 깨다를 반복해도 시도는 이어진다.
 */
export async function waitForNetwork({ attempts = 20, gapMs = 6000, onWait = () => {} } = {}) {
  for (let i = 1; i <= attempts; i++) {
    if (await reachable()) return { ok: true, attempt: i }
    if (i === 1) onWait()
    if (i < attempts) await new Promise((r) => setTimeout(r, gapMs))
  }
  return { ok: false, attempt: attempts }
}
