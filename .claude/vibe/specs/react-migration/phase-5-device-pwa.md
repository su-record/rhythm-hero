---
status: pending
phase: 5
lastUpdated: 2026-08-22
---

# SPEC: react-migration — Phase 5: 하드웨어·PWA 통합

**Master**: `.claude/vibe/specs/react-migration/_index.md`

## Persona
<role>
브라우저 하드웨어 API와 서비스워커 수명주기를 다루는 시니어 엔지니어.
비동기 루프의 정리(cleanup)를 빠뜨리지 않는다.
</role>

## Context
<context>
### Background
Web Serial 코드(`app.js:1120-1213`)는 읽기 루프·쓰기 큐·연결 해제 정리가 모듈 전역 객체(`serialDevice`)에 얹혀 있다. React로 옮길 때 가장 위험한 부분은 **effect 정리 누락으로 reader lock이 남는 것**이다. 현재 구현은 `releaseLock()`을 `finally`로 보장하고 있으므로 이 구조를 훅으로 옮기되 보장을 잃지 않아야 한다.

### 순수/부수효과 분리

| 모듈 | 책임 |
|------|------|
| `src/device/protocol.ts` | `parseHardwareLine`(순수), LED payload 생성(순수) |
| `src/device/useSerialDevice.ts` | 포트 열기/닫기, 읽기 루프, 쓰기 큐, 상태 노출 |

`parseHardwareLine`을 순수화하면 `BUTTON:3`·JSON·잡음 입력을 단위 테스트로 덮을 수 있다. 현재는 내부에서 곧장 `pressButton`을 호출해 테스트가 불가능하다.

### LED 송신 중복 억제
현재 payload를 JSON 문자열로 지문화해 동일하면 송신을 생략한다(`app.js:1155-1158`). 이 최적화를 유지한다. 훅에서는 `useRef`에 마지막 지문을 보관한다.

### PWA
Phase 1에서 이미 설치 가능성·오프라인 폴백·설치 패널이 완성돼 있다. 이 Phase는 그 로직을 훅으로 옮기는 것뿐이며 **동작을 바꾸지 않는다**.

- `useInstallPrompt` — 상태 5종(`ready`/`ios`/`installed`/`dismissed`/`hidden`) 유지
- `registerServiceWorker` — `controllerchange` 시 1회 리로드 가드 유지
</context>

## Task
<task>
### 1. 프로토콜 순수화
1. [ ] `src/device/protocol.ts` — `parseHardwareLine(line): number | null`, `buildLedPayload(state): LedPayload`
2. [ ] `tests/device/protocol.test.ts` — `BUTTON:1`~`BUTTON:4`, 대소문자·공백 변형, JSON 이벤트, 범위 밖 인덱스, 잡음 문자열

### 2. Serial 훅
1. [ ] `src/device/useSerialDevice.ts`
   - `connect()`, `disconnect()`, `connected`, `send(payload)`
   - 읽기 루프는 `AbortController`/플래그로 정리하고 `reader.releaseLock()`을 `finally`로 보장
   - 언마운트 시 포트 정리
2. [ ] `navigator.serial`의 `disconnect` 이벤트 구독 유지(`app.js:1363`)
3. [ ] LED 지문 비교로 중복 송신 억제

### 3. PWA 훅
1. [ ] `src/pwa/useInstallPrompt.ts` — 5상태 머신, `beforeinstallprompt`/`appinstalled` 처리
2. [ ] `src/pwa/registerServiceWorker.ts` — 등록 + `controllerchange` 1회 리로드 가드
3. [ ] `src/components/InstallPanel.tsx` — 문구 4종 그대로

### 4. 입력 통합
1. [ ] 키보드·카드 클릭·Serial·`window.habitToy` 네 경로가 모두 동일한 `pressButton` 액션으로 수렴하는지 확인
</task>

## Constraints
<constraints>
- Web Serial 미지원 브라우저에서 앱이 깨지지 않아야 한다. `"serial" in navigator` 가드 유지.
- 시리얼 baudRate 115200, 프로토콜 문자열 형식을 바꾸지 않는다 (`Hardware-Serial-Protocol.md` 계약).
- 설치 패널 문구 4종과 상태 판정 조건(`navigator.standalone === false`로 iOS Safari 식별)을 유지한다.
- 서비스워커 `CACHE` 값은 배포 시에만 올린다. 이 Phase에서 임의로 바꾸지 않는다.
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/device/protocol.ts`, `src/device/useSerialDevice.ts`
- `src/pwa/useInstallPrompt.ts`, `src/pwa/registerServiceWorker.ts`
- `src/components/InstallPanel.tsx`
- `tests/device/protocol.test.ts`

### Verification Commands
- `npm run typecheck`
- `npm test`
- Chrome에서 `설정 → USB 연결` 수동 확인 (보드 없으면 취소 경로만 확인)
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: `parseHardwareLine`이 순수 함수이며 6종 이상 입력 케이스가 테스트로 덮인다
- [ ] AC-2: 연결 해제 후 reader lock이 남지 않는다 (재연결이 즉시 성공한다)
- [ ] AC-3: 동일한 LED 상태에서 중복 송신이 발생하지 않는다
- [ ] AC-4: Web Serial 미지원 브라우저에서 토스트 안내만 뜨고 앱은 정상 동작한다
- [ ] AC-5: 설치 패널 5상태가 기존과 동일하게 판정된다
- [ ] AC-6: 버튼 입력 4경로가 모두 동일한 액션으로 수렴한다
</acceptance>
