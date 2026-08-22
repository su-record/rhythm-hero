# Rhythm Hero — 해커톤 프로토타입

중요한 네 가지 활동 시간을 물리 버튼처럼 간단히 기록하는 반응형 PWA입니다.

## 실행

`index.html`을 직접 열어도 메뉴와 로컬 기록 기능을 사용할 수 있습니다. 서비스 워커, 서버 동기화, AI 리플렉션과 PWA 동작까지 확인하려면 프로젝트 폴더에서 내장 정적 서버를 실행하세요.

```powershell
npm start
```

그 뒤 [http://localhost:4173](http://localhost:4173)을 엽니다.

구문과 서버 통합 테스트는 다음으로 실행합니다.

```powershell
npm run check
npm test
```

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

기록은 브라우저 `localStorage`에 저장됩니다. 현재 버전은 해커톤 H0 범위를 구현한 프론트엔드 프로토타입이며, 실제 기기는 `window.habitToy.pressButton(1..4)` 브리지를 BLE/Wi-Fi 이벤트 수신기로 교체해 연결할 수 있습니다.

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

메시지 형식과 펌웨어 처리 규칙은 [Hardware-Serial-Protocol.md](Hardware-Serial-Protocol.md)에 정리했습니다.
