// src/kakao-share.js — 카카오톡 공유 (Kakao JS SDK v2)
//
// 왜 Web Share와 따로 두는가:
//   모바일 네이티브 공유시트는 이미 카톡을 띄우지만 데스크톱에서는 클립보드 복사로 끝난다.
//   그리고 Web Share는 전송 성공 여부를 알려주지 않아 share_click만 찍히고 실제 전송은 측정 불가였다.
//   Kakao SDK는 두 가지를 모두 해결한다. 대신 모바일 흐름은 건드리지 않는다.
//
// 지도 SDK(dapi.kakao.com)와 공유 SDK(kakao_js_sdk)는 별개 스크립트다.
// 같은 앱의 JavaScript 키를 공유하므로 VITE_KAKAO_JS_KEY를 그대로 쓴다.

const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js'
const SDK_INTEGRITY = 'sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4'
const JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY

let loading = null

// SDK는 공유를 누른 순간에만 받는다. 상세페이지 첫 로드를 늦추지 않기 위해서다.
function loadSdk() {
  if (window.Kakao?.Share) return Promise.resolve(window.Kakao)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SDK_URL
    s.integrity = SDK_INTEGRITY
    s.crossOrigin = 'anonymous'
    s.onload = () => {
      try {
        if (!window.Kakao.isInitialized()) window.Kakao.init(JS_KEY)
        resolve(window.Kakao)
      } catch (e) { reject(e) }
    }
    s.onerror = () => reject(new Error('kakao sdk load failed'))
    document.head.appendChild(s)
  })
  return loading
}

export function isKakaoShareAvailable() {
  return !!JS_KEY
}

/**
 * 단지 정보를 카카오톡 피드 카드로 보낸다.
 * @returns {Promise<'sent'|'unavailable'|'failed'>}
 *   'sent'는 공유 창을 띄웠다는 뜻이다. 카카오는 사용자가 실제로 전송했는지는 알려주지 않는다.
 */
export async function shareApt(apt) {
  if (!JS_KEY) return 'unavailable'

  const url = `${window.location.origin}/apt/${apt.kaptCode}`
  const hasVerdict = apt.verdict && apt.verdict !== '실거래 데이터 없음'
  const description = hasVerdict
    ? `${apt.dong} · ${apt.verdict}`
    : `${apt.dong} · 동네 이야기와 실거래가를 한 번에`

  try {
    const Kakao = await loadSdk()
    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${apt.aptNm} — 살만한 동네일까?`,
        description,
        imageUrl: `${window.location.origin}/ogimage.png`,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [
        { title: '단지 보러가기', link: { mobileWebUrl: url, webUrl: url } },
      ],
    })
    return 'sent'
  } catch {
    return 'failed'
  }
}
