// src/supabase.js — Supabase 클라이언트 (지연 로딩)
//
// 왜 지연 로딩인가:
//   정적 import로 두면 supabase-js가 메인 번들에 들어가 +226KB(gzip +61KB)가 된다.
//   suzip 방문자는 대부분 검색으로 들어와 한 페이지만 보고 떠나는 사람이고
//   그들은 로그인을 쓰지 않는다. 안 쓰는 사람에게 첫 로드 비용을 지울 이유가 없다.
//
//   그래서 두 경우에만 받는다.
//     1) 이미 로그인한 적이 있다(저장된 세션 토큰이 있다)
//     2) 지금 로그인 버튼을 눌렀다
//
// 왜 Vercel 함수를 안 쓰는가:
//   suzip의 서버리스 함수는 12/12로 Hobby 한도에 꽉 차 있다. 직접 OAuth를 구현하면
//   콜백 엔드포인트가 필요해 한도를 넘는다. Supabase Auth는 인가 요청부터 콜백까지를
//   자기 도메인에서 처리하므로 프론트만으로 끝난다.

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isAuthEnabled = () => !!(URL && ANON)

// Supabase는 세션을 localStorage의 sb-<ref>-auth-token 키에 넣는다.
// 이 키가 있으면 이미 로그인한 사용자이므로 SDK를 받아 세션을 복원한다.
export function hasStoredSession() {
  if (!isAuthEnabled()) return false
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true
    }
  } catch { /* 프라이빗 모드 등 */ }
  return false
}

let client = null
let loading = null

/** 필요한 시점에만 SDK를 받아 클라이언트를 만든다. 비활성이면 null. */
export function getSupabase() {
  if (!isAuthEnabled()) return Promise.resolve(null)
  if (client) return Promise.resolve(client)
  if (loading) return loading

  loading = import('@supabase/supabase-js')
    .then(({ createClient }) => {
      client = createClient(URL, ANON, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // 카카오에서 돌아올 때 URL의 토큰을 자동으로 세션으로 바꾼다.
          detectSessionInUrl: true,
        },
      })
      return client
    })
    .catch(() => null)

  return loading
}
