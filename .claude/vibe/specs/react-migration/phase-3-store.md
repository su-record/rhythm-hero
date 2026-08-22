---
status: complete
phase: 3
lastUpdated: 2026-08-22
---

# SPEC: react-migration — Phase 3: 상태 계층과 동기화

**Master**: `.claude/vibe/specs/react-migration/_index.md`

## Persona
<role>
React 렌더 모델과 외부 부수효과의 경계를 설계하는 시니어 엔지니어.
"누가 상태를 소유하는가"를 한 곳으로 못 박는다.
</role>

## Context
<context>
### Background
현재 상태는 모듈 전역 `let state`이고, 변경 후 `saveState()` + `render()`를 **손으로** 호출한다(`app.js:200`). 호출을 빠뜨리면 화면이 어긋나고, 화면을 추가할 때마다 `render()`(`app.js:923`)에 등록을 잊으면 안 된다. 이 수동 결선이 확장을 막는 두 번째 병목이다.

### 외부 스토어를 쓰는 이유
React 트리 바깥의 소비자 3종(`window.habitToy`, Serial 읽기 루프, LED 송신)이 이미 존재한다(Master SPEC 참조). `useSyncExternalStore`는 트리 안팎에서 같은 스토어를 쓰게 해 주고, 셀렉터 구독으로 "1초 틱 → 전체 리렌더"를 막는다.

### 스토어 계약

```
createStore(initial): {
  getState(): AppState
  subscribe(listener): () => void
  dispatch(action): void      // 도메인 순수 함수를 호출해 다음 상태를 만든다
}
```

- `dispatch`는 도메인 함수의 결과를 그대로 채택한다. 스토어에 비즈니스 규칙을 두지 않는다.
- 상태가 바뀌면 `persist()`(localStorage) → `scheduleRemoteSync()`(650ms 디바운스) 순으로 부수효과가 걸린다. 기존 `saveState()`의 동작과 동일하다.

### 동기화 계층 분리
`syncToServer`/`restoreRemoteState`는 현재 DOM 문구 갱신(`setSyncStatus`)까지 함께 한다(`app.js:206-253`). 이를 둘로 나눈다.

| 모듈 | 책임 |
|------|------|
| `src/sync/client.ts` | fetch만. `putState`, `getState` 반환값은 데이터/에러. DOM 무관 |
| `src/sync/useRemoteSync.ts` | 훅. 온라인/오프라인 이벤트, 디바운스, 상태 문구를 React 상태로 노출 |

### 동기화 의미 보존 (중요)
현재 원격 복원은 `updatedAt` 비교 기반의 통짜 LWW다(`app.js:243-252`). **이 의미를 바꾸지 않는다.** 증분 병합은 별도 SPEC의 범위이며, 여기서 손대면 회귀 원인을 구분할 수 없게 된다.
</context>

## Task
<task>
### 1. 저장소 어댑터
1. [ ] `src/store/storage.ts` — `readStoredValue`/`writeStoredValue` 이관. localStorage 예외 시 메모리 Map 폴백 유지(`app.js:105-111`)
2. [ ] `clientId` 발급 로직 이관 (`app.js:186-192`), 키 이름 `habit-toy-client-id-v1` 유지

### 2. 스토어
1. [ ] `src/store/store.ts` — `createStore` 구현, 구독자 통지, 상태 교체 시에만 통지(참조 동일이면 무통지)
2. [ ] `src/store/actions.ts` — 액션 정의
   - `startSession`, `stopSession`, `pressButton`, `saveSessionEdit`, `deleteSession`, `restoreSession`
   - `setAssignments`, `addCategory`, `renameCategory`, `setGoal`, `toggleArchive`
   - `settleMemo`, `setHistoryRange`, `setReflectionRange`, `setAiReflection`, `resetDemo`
3. [ ] `src/store/useAppState.ts` — `useSyncExternalStore` 셀렉터 훅. 동일 셀렉터 결과면 리렌더하지 않는다
4. [ ] `src/store/persistence.ts` — 상태 변경 구독 → localStorage 기록 + 원격 동기화 예약

### 3. 동기화
1. [ ] `src/sync/client.ts` — `putState(clientId, state)`, `fetchState(clientId)`. 404는 "미존재"로 구분해 반환
2. [ ] `src/sync/useRemoteSync.ts` — 부팅 복원, online/offline 리스너, 문구 4종(`로컬에 저장됨`, `동기화 중…`, `안전하게 동기화됨`, `오프라인 · 로컬 기록`, `기록 확인 중…`) 그대로 유지
3. [ ] `src/sync/reflectionApi.ts` — `/api/reflection` 호출. 실패 시 로컬 근거 리플렉션으로 폴백하는 기존 동작 유지(`app.js:1215`)

### 4. 외부 브리지
1. [ ] `src/bridge/habitToy.ts` — `window.habitToy = { pressButton, getState }` 등록. `getState`는 `structuredClone` 유지
2. [ ] 전역 타입 선언 추가 (`declare global { interface Window { habitToy?: HabitToyBridge } }`)

### 5. 테스트
1. [ ] `tests/store/store.test.ts` — dispatch가 도메인 함수 결과를 채택하는지, 구독자 통지 횟수
2. [ ] `tests/sync/client.test.ts` — 404/500/정상 응답 분기 (fetch 스텁)
</task>

## Constraints
<constraints>
- 스토어에 비즈니스 규칙을 넣지 않는다. 계산은 전부 `src/domain/`에 있다.
- localStorage 키 `habit-toy-state-v1`, `habit-toy-client-id-v1`을 바꾸지 않는다. 기존 사용자 데이터가 유실된다.
- 원격 동기화의 LWW 의미를 바꾸지 않는다.
- 디바운스 650ms, 상태 문구 문자열을 그대로 유지한다.
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/store/storage.ts`, `store.ts`, `actions.ts`, `useAppState.ts`, `persistence.ts`
- `src/sync/client.ts`, `useRemoteSync.ts`, `reflectionApi.ts`
- `src/bridge/habitToy.ts`
- `tests/store/store.test.ts`, `tests/sync/client.test.ts`

### Verification Commands
- `npm run typecheck`
- `npm test`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: 기존 localStorage 상태(`habit-toy-state-v1`)를 그대로 읽어 동일 화면 데이터를 만든다
- [ ] AC-2: localStorage 접근이 예외를 던져도 메모리 폴백으로 앱이 동작한다
- [ ] AC-3: 상태 변경 1회당 원격 PUT이 650ms 디바운스로 1회만 발생한다
- [ ] AC-4: `window.habitToy.pressButton(1)`이 React 트리 밖에서 호출돼도 화면이 갱신된다
- [ ] AC-5: 동일 값으로 dispatch하면 구독자에게 통지하지 않는다
- [ ] AC-6: `src/store/`에 도메인 계산식이 **0건**이다 (전부 `src/domain/` 호출)
</acceptance>

## 구현 결과 (2026-08-22)

| AC | 결과 | 실측 |
|----|------|------|
| AC-1 기존 데이터 호환 | ✅ | `STORAGE_KEY`/`CLIENT_ID_KEY` 그대로, `normalizeState` 경유 로드 |
| AC-2 저장소 폴백 | ✅ | 예외를 던지는 localStorage / 아예 없는 환경 모두 테스트로 덮음 |
| AC-3 650ms 디바운스 | ✅ | `createDebouncer`를 분리해 가짜 타이머로 검증 (3연속 변경 → 1회 write) |
| AC-4 React 밖 접근 | ✅ | `installHabitToyBridge`가 스토어를 직접 읽고 쓴다 |
| AC-5 동일 값 무통지 | ✅ | `store.update`가 참조 동일 시 구독자 통지 생략, 테스트로 확인 |
| AC-6 스토어에 도메인 계산 0 | ✅ | `60_000` 등 시간 연산 잔존 0건 (`endTimeFor`로 이관) |

전체 테스트 **28개 → 55개**.

### 설계상 정정 1건

`useSyncExternalStore`용 셀렉터 훅을 처음에 `useAppState(selector)` 형태로 만들었으나, 인라인 셀렉터가 매 호출 새 객체를 반환하면 스냅샷 비교가 항상 실패해 **무한 렌더**에 빠진다. 다음으로 교체했다.

- `useAppState()` — 상태 전체 구독. 스토어 쓰기는 사용자 조작 시에만 발생하므로 비용이 낮고, 파생값은 컴포넌트의 `useMemo`가 담당한다.
- `useAppStateField(selector)` — 모듈 스코프에 정의된 안정적 셀렉터 전용. 계약을 주석으로 명시했다.

1초 시계는 스토어를 건드리지 않는 별도 티커이므로 Phase 4의 "카드 재생성 0건" 기준과 충돌하지 않는다.

### 추가 분리
- `isDuplicateCategoryName`을 `src/domain/state.ts`로 이동 — 카테고리에 대한 순수 술어이므로 도메인에 속한다.
- `endTimeFor`를 `src/domain/time.ts`에 추가 — 스토어에 남아 있던 마지막 시간 연산을 걷어냈다.
