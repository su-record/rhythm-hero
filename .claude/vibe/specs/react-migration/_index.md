---
status: pending
currentPhase: 5
totalPhases: 6
createdAt: 2026-08-22
lastUpdated: 2026-08-22
---

# SPEC: react-migration (Master)

## Overview

Rhythm Hero의 바닐라 단일 파일 프론트엔드(`app.js` 1387줄)를 **Vite 8 + React 19 + TypeScript** 구조로 전환한다. 목적은 기능 추가가 아니라 **코드 구조 확장성** 확보이며, 사용자에게 보이는 동작은 100% 보존한다.

- Total phases: 6
- 신규 파일: 약 40개 / 삭제: 3개(`app.js`, `state-utils.mjs`, `time-utils.mjs`)
- Dependencies: Phase 1 → 2 → 3 → 4 → 5 → 6 (순차, 각 Phase는 독립 검증 가능)

## Sub-SPECs

| 순서 | SPEC File | Feature File | 상태 |
|------|-----------|--------------|------|
| 1 | phase-1-build-foundation.md | phase-1-build-foundation.feature | ✅ |
| 2 | phase-2-domain.md | phase-2-domain.feature | ✅ |
| 3 | phase-3-store.md | phase-3-store.feature | ✅ |
| 4 | phase-4-views.md | phase-4-views.feature | ✅ |
| 5 | phase-5-device-pwa.md | phase-5-device-pwa.feature | ✅ |
| 6 | phase-6-server-deploy-tests.md | phase-6-server-deploy-tests.feature | ⬜ |

## Shared Context

### 전환의 근거 (실측)

| 병목 | 실측치 | 위치 |
|------|--------|------|
| 도메인 로직 이중 정의 | 동일 함수 7개가 2곳에 존재 | `app.js:3-84` ↔ `state-utils.mjs`/`time-utils.mjs` |
| 단일 파일 비대화 | `app.js` 1387줄, 함수 2개가 50줄 규칙 위반(127줄/96줄) | `getReflectionReport`, `wireEvents` |
| 명령형 DOM 결합 | 고유 `$("#id")` 셀렉터 120개, `addEventListener` 52회 | `app.js` 전역 |
| 렌더 재생성 | 기록 중 **1초마다** `#category-grid` innerHTML 전체 교체 + 리스너 4개 재바인딩 | `app.js:449-462`, 타이머 `app.js:1370` |
| 국소 처방 흔적 | `#now-icon`만 `dataset` 가드로 재생성 회피 | `app.js:468-472` |

### Tech Stack (확정)

- Build: Vite 8.2.x + `@vitejs/plugin-react` 6.1.x
- UI: React 19.2.x (함수 컴포넌트 + 훅 전용, 클래스 컴포넌트 금지)
- Language: TypeScript 5.x, `strict: true`, `any` 금지
- 상태: `useSyncExternalStore` 기반 외부 스토어 (Context/Redux 미사용)
- 테스트: `node:test` + `--experimental-strip-types` (러너 추가 의존성 없음)
- 서버: 기존 `server.mjs`(node:http, 의존성 0) 유지

### 상태 관리에 Context가 아닌 외부 스토어를 쓰는 이유

React 트리 **바깥에서** 상태를 읽고 써야 하는 소비자가 이미 3개 존재한다.

1. `window.habitToy.pressButton(1..4)` — 펌웨어/임베디드 브리지 (`app.js:1373`)
2. Web Serial 읽기 루프 — `readSerialLoop()`의 비동기 콜백 (`app.js:1161`)
3. LED 동기화 — 상태 변경 시 보드로 payload 송신 (`syncDeviceLights`)

Context는 이 셋을 훅 밖에서 접근할 수 없다. 외부 스토어 + `useSyncExternalStore`는 React 안팎 양쪽에서 동일 API로 접근되며, 셀렉터 단위 구독으로 "1초 틱이 카드 전체를 리렌더"하는 문제도 함께 해소한다.

### 절대 보존 대상 (회귀 금지)

| 영역 | 세부 |
|------|------|
| 뷰 | 오늘 / 기록 / 돌아보기 / 설정 4종 |
| 다이얼로그 | `active4`, `record`, `category-detail`, `session`, `completion`, `category`, `device` + `toast` |
| 입력 | 키보드 `1`~`4`, 카드 클릭, `window.habitToy.pressButton` |
| 하드웨어 | Web Serial 연결/해제, `BUTTON:n`·JSON 파싱, LED payload 송신 |
| 동기화 | localStorage 우선 + 650ms 디바운스 원격 PUT + 부팅 시 복원 |
| 리플렉션 | 로컬 규칙 엔진 + `/api/reflection` 호출 + 실패 시 폴백 |
| PWA | manifest·아이콘·서비스워커·설치 패널 4상태·오프라인 폴백 |
| 스타일 | `styles.css` **무수정**. 클래스명과 DOM 계층을 그대로 재현한다 |
| 실행 | `file://`로 빌드 산출물 직접 열기 |

### Constraints (전 Phase 공통)

- `styles.css`는 이번 마이그레이션에서 수정하지 않는다. 디자인 변경은 범위 밖이다.
- 함수 ≤30줄, JSX ≤50줄, 중첩 ≤3, 파라미터 ≤5, 순환복잡도 ≤10.
- `any`, `console.log`, 주석 처리된 코드 금지.
- 사용자 문구(한국어)는 기존 문자열을 **그대로** 옮긴다. 재작성 금지.
- 각 Phase 종료 시 `npm run typecheck && npm test`가 통과해야 다음 Phase로 넘어간다.

### 범위 밖 (명시적 제외)

- 컴포넌트 렌더링 테스트(jsdom/testing-library 도입) — 후속 과제
- 서버 인증, 세션 단위 증분 동기화, 저장소 교체 — 별도 SPEC
- 디자인·문구·기능 추가 변경 일체

### 비기능 요구사항 (수치 확정)

| 항목 | 기준 | 측정 방법 |
|------|------|-----------|
| 번들 크기 | `dist/client/app.js` gzip **150KB 이하** (React 19 런타임 포함) | `gzip -c dist/client/app.js \| wc -c` |
| CSS 크기 | 현재 `styles.css` 37KB 대비 **증가 0** (무수정이므로) | 파일 크기 비교 |
| 초기 렌더 | 로컬 서버 기준 첫 화면 표시 **300ms 이내** | Chrome DevTools Performance, 3회 중앙값 |
| 1초 틱 비용 | `#category-grid` 자식 노드 재생성 **0건 / 10초** | `MutationObserver` (`childList`) |
| 타입 검사 | `tsc --noEmit` 에러 **0건**, `any` **0건** | `npm run typecheck`, `grep -rn ": any" src/` |
| 테스트 | 기존 8개 + 신규 최소 12개, 전부 통과 | `npm test` |
| 빌드 시간 | `npm run build` **20초 이내** | `time npm run build` |

### 보안 요구사항 (현행 유지 + 1건 개선)

- `OPENAI_API_KEY`는 서버 환경변수 전용. 클라이언트 번들에 어떤 비밀도 포함하지 않는다.
- Vite `import.meta.env`로 노출되는 값은 **`VITE_` 접두사 변수만**이며, 이번 범위에서는 사용하지 않는다.
- `/api/state/:id`, `/api/reflection`의 입력 검증 규칙을 변경하지 않는다.
- **개선 1건**: 수동 `escapeHtml` 기반 XSS 방어를 React의 자동 이스케이프로 대체한다. `dangerouslySetInnerHTML` 사용 0건을 AC로 강제한다.
- 서버 정적 서빙 루트를 `dist/client`로 좁혀 소스·설정·테스트 파일의 노출 경로를 구조적으로 제거한다.

### 에러 처리 기준

- 사용자에게 보이는 에러 문구는 **기존 한국어 문자열을 그대로** 사용한다. 신규 작성 금지.
- 네트워크 실패 시 동작 유지: 원격 동기화 실패 → `로컬에 저장됨`, AI 리플렉션 실패 → 로컬 근거 리플렉션 폴백.
- 도메인 함수의 계약 위반은 기존과 동일하게 `throw`한다(예: `Active 4 assignments must be unique`).

### 롤백 전략

- Phase마다 **독립 커밋 1개**를 남긴다. 커밋 메시지에 Phase 번호를 표기한다.
- 각 Phase 종료 시점의 `npm run typecheck && npm test`가 통과 상태여야 커밋한다.
- 문제 발생 시 해당 Phase 커밋만 `git revert`하면 직전 Phase의 동작 상태로 돌아간다.
- 브랜치: `feature/react-migration`. `master` 병합은 Phase 6의 회귀 체크리스트 통과 후에만 수행한다.

### 검증된 기술 전제

| 전제 | 검증 결과 |
|------|-----------|
| Node 22.17에서 `.ts` 테스트 무의존성 실행 | ✅ `node --test --experimental-strip-types` 통과 확인 |
| 레지스트리 접근 및 버전 | ✅ react 19.2.8, vite 8.2.2, @vitejs/plugin-react 6.1.0 |
| 외부 LLM 리서치(GPT/Gemini) | ❌ `@su-record/vibe` 미설치로 사용 불가. 코드베이스 실측으로 대체 |

### 구현 중 확정된 변경 (2026-08-22)

| 변경 | 이유 |
|------|------|
| `server.mjs`의 `dist/client` 서빙과 통합 테스트 계약 갱신을 **Phase 6 → Phase 1로 이동** | 소스가 `src/`로 옮겨진 순간 루트 allowlist 서빙이 무효가 되어, 미루면 Phase 1~5 내내 테스트가 빨간 상태가 된다. Phase 게이트("각 Phase 종료 시 테스트 통과")를 지키려면 같은 Phase에서 처리해야 한다 |
| 빌드 산출 CSS 이름을 `style.css` → `styles.css`로 고정 | 서비스워커가 정확한 파일명으로 프리캐시한다 |
| 패치 스크립트가 `type="module"`을 제거하는 대신 **`defer`로 치환** | 모듈 스크립트는 기본 defer다. 속성만 벗기면 `<head>`의 클래식 스크립트가 `#root` 생성 전에 실행되어 마운트가 실패한다 |
| `@types/node`를 devDependency에 추가 | `tsconfig.node.json`의 `types: ["node"]`에 필요 |

### 검증 도구 (실측)

헤드리스 Chrome으로 빌드 산출물의 실제 렌더 결과를 확인할 수 있다. Phase 4의 마크업 동형 검증에 그대로 사용한다.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --virtual-time-budget=3000 --dump-dom --allow-file-access-from-files \
  "file://$PWD/dist/client/index.html"
```
