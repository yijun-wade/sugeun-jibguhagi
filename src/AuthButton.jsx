// src/AuthButton.jsx — 헤더의 로그인/로그아웃 버튼
//
// 환경변수가 없으면(=아직 Supabase를 안 붙였으면) 아무것도 렌더하지 않는다.
// 그래서 이 컴포넌트를 미리 넣어두어도 지금 배포된 서비스에는 변화가 없다.

import { useAuth, displayName } from './auth.jsx'

export default function AuthButton() {
  const { user, enabled, signInWithKakao, signOut } = useAuth()
  if (!enabled) return null

  if (!user) {
    return (
      <button type="button" className="auth-btn auth-btn-kakao" onClick={signInWithKakao}>
        카카오로 시작
      </button>
    )
  }

  return (
    <span className="auth-user">
      <span className="auth-nick" title={displayName(user)}>{displayName(user)}</span>
      <button type="button" className="auth-btn auth-btn-ghost" onClick={signOut}>
        로그아웃
      </button>
    </span>
  )
}
