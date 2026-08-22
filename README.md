# Rhythm Hero — 해커톤 프로토타입

중요한 네 가지 활동 시간을 물리 버튼처럼 간단히 기록하는 반응형 PWA입니다.

## 구조

```
src/
  domain/     시간·상태·통계·리플렉션 규칙 (순수 함수, 브라우저 API 비참조)
  store/      useSyncExternalStore 기반 외부 스토어와 액션
  sync/       서버 동기화와 AI 리플렉션 호출
  device/     Web Serial 프로토콜과 훅
  pwa/        설치 프롬프트, 서비스 워커 등록
  views/      오늘·기록·돌아보기·설정
  components/ 화면 조각
  dialogs/    다이얼로그 7종
public/       manifest, 서비스 워커, 아이콘 (변형 없이 복사됨)
dist/client/  빌드 산출물 (server.mjs가 서빙하는 대상)
dist/server/  공개 목업 Cloudflare Worker
```

## 실행

개발 중에는 Vite 개발 서버를 씁니다. `/api` 요청은 아래 API 서버로 프록시됩니다.

```powershell
npm start        # 터미널 1: API + 정적 서버 (http://localhost:4173)
npm run dev      # 터미널 2: Vite HMR (http://localhost:5173)
```

배포 형태 그대로 확인하려면 빌드한 뒤 `npm start`만 실행하면 됩니다.

```powershell
npm run build
npm start
```

빌드 산출물은 `dist/client/index.html`을 **파일로 직접 열어도** 동작합니다. 진입 스크립트를 모듈이 아닌 지연 로딩 클래식 스크립트로 만들기 때문입니다. 이 경우 서비스 워커와 서버 동기화는 브라우저 제약으로 동작하지 않습니다.

타입 검사와 테스트는 다음으로 실행합니다.

```powershell
npm run typecheck
npm test
```

`npm test`는 실행 전 자동으로 빌드합니다. 통합 테스트가 실제 배포되는 산출물을 검증하기 때문입니다.

## 앱 설치 (PWA)

`npm start`로 연 뒤 설정 탭의 `홈 화면에 추가`를 누르면 홈 화면 앱으로 설치됩니다. Chrome·Edge는 설치 배너를 대신 띄워 주고, iOS Safari에는 공유 → `홈 화면에 추가` 안내가 표시됩니다. 설치된 앱은 주소창 없이 전체 화면으로 열리며, 오프라인에서도 서비스 워커 캐시로 실행됩니다.

앱 아이콘은 의존성 없이 브랜드 마크에서 직접 렌더링합니다.

```powershell
npm run build:icons
```

결과물은 `assets/icons/`에 저장되며 `npm run build:mockup`이 자동으로 먼저 실행합니다. 배포 버전을 갱신할 때는 `sw.js`의 `CACHE` 값만 올리면 됩니다.

## 데모 조작

- Active 4 카드 클릭: 해당 활동 시작 또는 종료
- 키보드 `1`~`4`: 하드웨어 버튼 시뮬레이션
- 설정 → 버튼 테스트: 1번 버튼 입력 시뮬레이션
- 개발 도구 콘솔: `window.habitToy.pressButton(1)`
- 우측 상단 `↺`: 시드 데이터를 포함한 데모 상태로 초기화
- 기록 탭: 7일/30일 히트맵 전환 및 기존 기록 수정·삭제
- 오늘 탭 → `앱에서 직접 기록`: 현재 타이머 시작 또는 과거 시간 직접 추가
- 설정: Category 추가·보관, 삭제 기록 복구, 목표 수정, JSON 내보내기
- 설정 → `USB 연결`: Chrome Web Serial로 실제 개발보드 연결

기록은 브라우저 `localStorage`에 저장됩니다. 현재 버전은 해커톤 H0 범위를 구현한 프론트엔드 프로토타입이며, 실제 기기는 `window.habitToy.pressButton(1..4)` 브리지를 BLE/Wi-Fi 이벤트 수신기로 교체해 연결할 수 있습니다. 이 브리지는 React 트리 밖에서 스토어에 직접 접근합니다.

앱을 `npm start`로 열면 로컬 저장소를 우선 사용하면서, 같은 브라우저의 기기 ID에 연결된 상태를 서버에도 자동 저장합니다. 서버 데이터는 `.habit-toy-data/`에 저장되며 `.gitignore`에 포함되어 있습니다. 네트워크가 끊겨도 기록은 로컬에 남고, 연결이 복구되면 다시 동기화를 시도합니다.

## OpenAI 리플렉션 연결

OpenAI API 키는 브라우저에 넣지 않습니다. 프로젝트 루트의 [`.env.example`](.env.example)을 참고해 PowerShell 환경 변수로만 설정한 뒤 서버를 시작하세요.

```powershell
$env:OPENAI_API_KEY="your_key_here"
npm start
```

리플렉션 탭의 `AI 리플렉션 만들기`는 서버의 `/api/reflection` 엔드포인트를 호출합니다. 서버는 계산된 시간 통계만 전송하고, 생성된 제목이 선택한 근거 카드와 연결되는지 검증합니다. 키가 없거나 AI 요청이 실패해도 로컬 근거 기반 리플렉션과 모든 기록 기능은 계속 동작합니다.

## 실제 개발보드 연결

Chrome에서 설정의 `USB 연결`을 누르면 Web Serial로 USB 개발보드를 직접 연결할 수 있습니다. 보드는 `BUTTON:1`~`BUTTON:4` 또는 한 줄 JSON 이벤트를 보내면 되고, 앱은 목표 진행률과 현재 실행 상태를 다시 LED 명령으로 보냅니다.

메시지 형식과 펌웨어 처리 규칙은 [Hardware-Serial-Protocol.md](docs/Hardware-Serial-Protocol.md)에 정리했습니다.

## 문서

- [디자인 시스템](docs/DESIGN.md), [구현 핸드오프](docs/DESIGN-HANDOFF.md)
- [제품 명세](docs/Habit-Toy-App-Spec-v1.md)
- [회귀 체크리스트](docs/migration-checklist.md) — 자동 테스트가 덮지 못하는 수동 확인 목록
