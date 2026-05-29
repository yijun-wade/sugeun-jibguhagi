// 서버 캐시 — V1은 pure no-op
// V2에서 Upstash Redis 마이그레이션 예정 (@vercel/kv가 deprecated)
// 클라이언트 localStorage(24h TTL)가 1차 캐시 역할을 담당
//
// 함수 인터페이스는 유지해서 api/report.js 호출부 변경 없이 v2에서 활성화 가능

export async function kvGet(_key) {
  return null
}

export async function kvSet(_key, _value) {
  // no-op
}

export async function kvDel(_key) {
  // no-op
}
