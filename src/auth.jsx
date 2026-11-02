// src/auth.jsx — 카카오 로그인 상태를 앱 전역에 제공
//
// 로그인은 끝까지 선택 사항이다. suzip은 검색 유입 1회성 조회 유틸리티로 판정된 서비스라
// (W1 재방문 0.96%, 조회 단지의 90%가 1곳) 로그인 벽을 세우면 유입이 그대로 이탈이 된다.
// 비로그인 사용자의 경험은 로그인 도입 전과 완전히 동일해야 한다.

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { getSupabase, isAuthEnabled, hasStoredSession } from './supabase.js'
import { syncOnLogin, pushLocalToServer } from './sync.js'
import { track, setUserId } from './analytics.js'

const AuthContext = createContext({
  user: null,
  enabled: false,
  signInWithKakao: () => {},
  signOut: () => {},
  pushSync: () => {},
})

export function AuthProvider({ children }) {
  const enabled = isAuthEnabled()
  const [user, setUser] = useState(null)

  // 카카오에서 돌아오면 URL에 토큰이 실려 온다. 그 경우에도 SDK를 받아야 한다.
  const returningFromOAuth =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('access_token') || window.location.search.includes('code='))

  useEffect(() => {
    if (!enabled) return
    // 로그인한 적 없는 방문자에게는 SDK를 받지 않는다. 검색 착지 1회성 방문이 대부분이다.
    if (!hasStoredSession() && !returningFromOAuth) return

    let alive = true
    let unsub = null

    getSupabase().then((supabase) => {
      if (!supabase || !alive) return

      supabase.auth.getSession().then(({ data }) => {
        if (!alive) return
        const u = data?.session?.user ?? null
        setUser(u)
        setUserId(u?.id ?? null)
      })

      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        const next = session?.user ?? null
        setUser(next)
        setUserId(next?.id ?? null)
        // 로그인 직후에만 병합한다. 토큰 갱신(TOKEN_REFRESHED)마다 돌리면 낭비다.
        if (event === 'SIGNED_IN' && next) {
          syncOnLogin(next.id).then((ok) => track('login_sync', { ok }))
        }
      })
      unsub = () => sub?.subscription?.unsubscribe()
    })

    return () => { alive = false; unsub?.() }
  }, [enabled, returningFromOAuth])

  const signInWithKakao = useCallback(async () => {
    track('login_click', { provider: 'kakao' })
    const supabase = await getSupabase()
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: window.location.href,
        // 받을 것만 적는다. scope를 비우면 Supabase가 account_email까지 요청하는데
        // 이메일은 비즈앱 심사가 필요해 동의항목에 없고, 설정하지 않은 항목을
        // 요청하면 카카오가 KOE205로 거부한다.
        // 프로필 사진은 화면 어디에도 쓰지 않으므로 받지 않는다.
        scopes: 'profile_nickname',
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    track('logout_click')
    const supabase = await getSupabase()
    if (!supabase) return
    await supabase.auth.signOut()
    setUserId(null)
    // 로컬 데이터는 남긴다. 지우면 비로그인 사용자보다 못한 상태가 된다.
  }, [])

  // 컬렉션·관심지역이 바뀐 뒤 호출하면 서버로 밀어 올린다.
  const pushSync = useCallback(() => {
    if (user?.id) pushLocalToServer(user.id)
  }, [user])

  const value = useMemo(
    () => ({ user, enabled, signInWithKakao, signOut, pushSync }),
    [user, enabled, signInWithKakao, signOut, pushSync],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

// 카카오가 주는 닉네임 위치가 계정 설정에 따라 갈린다. 없으면 '회원'으로 떨어뜨린다.
export function displayName(user) {
  const m = user?.user_metadata || {}
  return m.name || m.full_name || m.preferred_username || m.nickname || '회원'
}
