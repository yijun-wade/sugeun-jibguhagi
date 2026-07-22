# suzip.kr Play Store 등록 가이드 (TWA via PWABuilder)

## 현재 상태 (2026-07-23)
- suzip.kr = 완전한 PWA (manifest·서비스워커·HTTPS·아이콘·assetlinks 모두 라이브)
- 이 폴더에 Play Store 등록에 필요한 에셋 전부 준비됨
- ⚠️ **아직 Play Console에 등록 안 됨** (kr.suzip.app 존재 여부 확인 필요)

## 에셋 목록 (이 폴더)
- `icon-play-512.png` — Play Console 앱 아이콘 (512×512)
- `feature-graphic-1024x500.png` — 기능 그래픽
- `screenshot-1-home.png` / `screenshot-2-apt.png` / `screenshot-3-briefing.png` — 폰 스크린샷 (1080×2400, 최소 2장 필요)
- (아이콘 any/maskable는 public/에 반영되어 manifest가 참조)

## STEP 1 — PWABuilder로 .aab 빌드
1. https://www.pwabuilder.com 접속 → `https://www.suzip.kr` 입력 → Start
2. PWA 점수 확인 (manifest/SW/HTTPS 통과해야 함 — 현재 다 준비됨)
3. **Package For Stores → Android → Google Play** 선택
4. 옵션:
   - Package ID: **kr.suzip.app** (assetlinks와 반드시 일치)
   - App name: **수군수군 우리집**
   - Signing key: **New** 선택 → 생성된 **키스토어 파일 + 비밀번호를 반드시 저장/백업**
     ⚠️ 이 키스토어를 잃으면 앱 업데이트 영구 불가 (Play App Signing 쓰면 완화됨 — 아래 참고)
5. Download → 압축 안에 **.aab + signing.keystore + assetlinks.json** 들어있음

## STEP 2 — assetlinks 지문 교체 (필수! 안 하면 앱이 주소창 뜨거나 깨짐)
- PWABuilder가 준 `assetlinks.json`의 sha256 지문을 확인
- `public/.well-known/assetlinks.json`을 그 값으로 교체 → 커밋 → 배포 (vercel --prod)
- (Play App Signing 사용 시: Play Console > 앱 무결성에서 제공하는 SHA-256을 넣어야 함. 보통 PWABuilder 키와 다르니 **최종적으로 Play Console의 서명 인증서 지문 기준으로 맞출 것**)

## STEP 3 — Play Console 등록
1. 앱 만들기: 이름 "수군수군 우리집", 한국어, 무료, 앱
2. **비공개(내부) 테스트 트랙**에 .aab 먼저 업로드 → 테스터 등록 → 검증 후 프로덕션
3. 스토어 등록정보:
   - 앱 아이콘: `icon-play-512.png`
   - 기능 그래픽: `feature-graphic-1024x500.png`
   - 스크린샷: `screenshot-1~3` (최소 2장)
   - 간단한 설명 / 자세한 설명 (아래 문구 참고)
4. 앱 콘텐츠:
   - 개인정보처리방침: https://www.suzip.kr/privacy
   - 데이터 안전: 앱 상호작용·검색 기록·기기 ID·진단 **수집됨** (Amplitude/Meta), 광고 ID **사용 안 함**
   - 콘텐츠 등급 설문, 타겟 연령, 정부 앱 아님
   - **Play 앱 서명 사용 권장** (키 분실 대비)

## 스토어 문구 초안
- 간단한 설명(80자): "발품 팔기 전, 동네 수군수군 먼저. AI가 단지 후기·시세·사주 동네까지 모아드려요."
- 자세한 설명: 수군수군 우리집은 아파트를 고를 때 궁금한 '이 동네 살 만한가'를 AI가 인터넷에 흩어진 실거주 후기·카페·뉴스에서 모아 요약해주는 서비스입니다. 실거래가, 동네 분위기, 교통·학군, 그리고 내 사주로 맞는 동네까지 한 번에 확인하세요.

## 참고
- sugeun-urizip(단지 진단, 별개 앱)은 2026-05-13 검토요청 완료 상태 — 이 앱과 혼동 주의
- TWA는 live suzip.kr을 로딩 → 앱 콘텐츠는 배포하면 자동 최신 (스토어 재심사 불필요, 껍데기만 심사)
