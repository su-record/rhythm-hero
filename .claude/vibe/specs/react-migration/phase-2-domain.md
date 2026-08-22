---
status: complete
phase: 2
lastUpdated: 2026-08-22
---

# SPEC: react-migration — Phase 2: 도메인 로직 단일화

**Master**: `.claude/vibe/specs/react-migration/_index.md`

## Persona
<role>
순수 함수와 불변 데이터로 도메인을 모델링하는 시니어 엔지니어.
UI를 모르는 계층을 먼저 못 박고, 그 위에 화면을 올린다.
</role>

## Context
<context>
### Background
같은 함수가 두 벌 존재한다. `app.js:3-84`는 `time-utils.mjs`와 `state-utils.mjs`를 통째로 복제한 것이며, 차이는 파라미터명(`state` → `currentState`)뿐이다. 테스트는 `.mjs` 쪽만 검증하므로 브라우저가 실제로 실행하는 사본이 틀려도 테스트는 초록이다. Phase 1이 빌드 스텝을 도입했으므로 이제 단일 소스로 합칠 수 있다.

### 이관 대상 함수 (출처 → 목적지)

| 목적지 | 함수 |
|--------|------|
| `src/domain/time.ts` | `dayBounds`, `overlapMsForDay`, `durationMs`, `formatMinutes`, `formatClock`, `sameLocalDay`, `dayKey`, `localDateInput`, `localTimeInput` |
| `src/domain/state.ts` | `createDefaultState`, `normalizeState`, `placeCategoryInSlot`, `applyActiveAssignments`, `completeActiveSession`, `updateSessionMemo`, `getPendingMemoSessionIds` |
| `src/domain/stats.ts` | `sessionsForDay`, `minutesFor`, `todayMinutes`, `allCompleted`, `categoryStats`, `getDays` |
| `src/domain/reflection.ts` | `reflectionPeriodBounds`, `overlapMsForPeriod`, `getReflectionPeriodStats`, `createReflectionFingerprint`, `getReflectionReport` |
| `src/domain/format.ts` | `safeColor`, `formatReflectionPeriod`, `formatReflectionMinutes` |

### escapeHtml 처리
`escapeHtml`(`app.js:278`)은 innerHTML 문자열 조립 때문에만 존재한다. React는 텍스트를 자동 이스케이프하므로 뷰 이관이 끝나면 불필요하다. Phase 2에서는 옮기지 않고, Phase 4 종료 시 참조 0건을 확인한 뒤 폐기한다.

### getReflectionReport 분해
현재 127줄 단일 함수(`app.js:679-806`)로 규칙 5종(비교/최다/연속/균형/기록수)이 한 몸이다. 각 규칙을 `(current, previous) => ReflectionFact | null` 시그니처의 독립 생성기로 분해하고, `getReflectionReport`는 생성기 배열을 순회해 조립만 한다. **규칙 추가가 함수 하나 추가로 끝나는 것**이 이 Phase의 확장성 목표다.

### 타입 정의
`src/domain/types.ts`에 `Category`, `Session`, `ActiveSession`, `AppState`, `ReflectionFact`, `ReflectionStats`, `HistoryRange`를 정의한다. `Session.status`는 `"completed" | "deleted"`, `memoCaptureState`는 `"pending" | "saved" | "skipped"` 유니온으로 좁힌다.
</context>

## Task
<task>
### 1. 타입 선언
1. [ ] `src/domain/types.ts` — 위 7개 타입 정의. 옵셔널 필드(`memo`, `goal`, `dayDurationMs`, `deletedAt`)를 정확히 표기
   - Verify: `npm run typecheck`

### 2. 순수 모듈 이관
1. [ ] `src/domain/time.ts` — `time-utils.mjs` + `app.js`의 시간 유틸 통합
2. [ ] `src/domain/state.ts` — `state-utils.mjs` 내용을 TS로 이관, 불변성 유지
3. [ ] `src/domain/stats.ts` — 전역 `state`를 읽던 함수들을 **첫 인자로 상태를 받도록** 시그니처 변경
4. [ ] `src/domain/format.ts`
5. [ ] `src/domain/reflection.ts` — 규칙 5종을 개별 생성기로 분해

### 3. 중복 제거
1. [ ] `time-utils.mjs` 삭제
2. [ ] `state-utils.mjs` 삭제
3. [ ] Verify: `grep -rn "function completeActiveSession" src/ *.mjs 2>/dev/null | wc -l` → `1`

### 4. 테스트 이관 및 확장
1. [ ] `tests/session-state.test.mjs` → `tests/domain/state.test.ts` (단언 8개 그대로 유지)
2. [ ] `tests/domain/time.test.ts` 신규 — 자정 경계 세션의 `overlapMsForDay` 분할, 진행 중 세션의 `durationMs`
3. [ ] `tests/domain/reflection.test.ts` 신규 — 규칙 생성기별 케이스, 기록 0건일 때 `insufficient: true`, 동일 입력의 `createReflectionFingerprint` 안정성
4. [ ] `package.json`의 `test`를 `node --test --experimental-strip-types` 기반으로 변경
   - Node 22.17 기준으로 `.ts` 직접 실행에 추가 의존성이 없다
</task>

## Constraints
<constraints>
- 도메인 모듈은 `document`, `window`, `localStorage`, `fetch`를 참조하지 않는다. 순수 함수만 둔다.
- 기존 계산 결과를 바꾸지 않는다. 반올림·경계 조건까지 동일해야 한다.
- 규칙 생성기 하나당 30줄을 넘기지 않는다.
- 시드 데이터(`createDefaultState`의 21건)는 값 그대로 옮긴다.
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/domain/types.ts`, `time.ts`, `state.ts`, `stats.ts`, `format.ts`, `reflection.ts`
- `tests/domain/state.test.ts`, `time.test.ts`, `reflection.test.ts`

### Files to Delete
- `time-utils.mjs`, `state-utils.mjs`, `tests/session-state.test.mjs`

### Verification Commands
- `npm run typecheck`
- `npm test`
- `grep -rn "export function completeActiveSession" src/ | wc -l`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: 도메인 함수 중 2곳 이상에 정의된 것이 **0개**다
- [ ] AC-2: `src/domain/` 안에서 `document`/`window`/`localStorage`/`fetch` 참조가 **0건**이다
- [ ] AC-3: 기존 세션 상태 테스트 8개 단언이 전부 유지된 채 통과한다
- [ ] AC-4: `getReflectionReport`가 30줄 이하이고, 규칙 생성기가 함수 단위로 분리돼 있다
- [ ] AC-5: 신규 테스트가 시간 경계·리플렉션 규칙·지문 안정성을 각각 1건 이상 덮는다
- [ ] AC-6: `npm run typecheck` 에러 0건, `any` 사용 0건
</acceptance>

## 구현 결과 (2026-08-22)

| AC | 결과 | 실측 |
|----|------|------|
| AC-1 이중 정의 0 | ✅ | `completeActiveSession` 정의 위치 1곳 (`src/domain/state.ts`) |
| AC-2 도메인 순수성 | ✅ | `src/domain/`의 `document`/`window`/`localStorage`/`fetch` 참조 0건 |
| AC-3 기존 단언 유지 | ✅ | 세션 상태 테스트 8개 단언 전부 보존 |
| AC-4 리포트 조립 함수 | ✅ | `getReflectionReport` 15줄, 규칙 3종이 `REFLECTION_RULES` 배열로 분리 |
| AC-5 신규 테스트 | ✅ | 시간 경계 8건 + 리플렉션 7건 + 상태 10건 = 25건 |
| AC-6 타입 검사 | ✅ | 에러 0건, `any` 0건 |

전체 테스트 **8개 → 28개** (통합 3 + 도메인 25).

### SPEC과 달라진 점

| 항목 | SPEC | 실제 | 이유 |
|------|------|------|------|
| 리플렉션 규칙 수 | 5종 | **3종** (`comparison`/`top-share`/`rhythm`) | 원본 확인 결과 규칙은 3개이고 각각 분기 2~3개를 갖는 구조였다. 분기를 별도 함수로 빼 규칙당 30줄 제약을 지켰다 |
| `app.js` 삭제 시점 | Phase 4 | **Phase 2** | Phase 1에서 이미 참조가 끊긴 죽은 코드이고, 남겨두면 AC-1(이중 정의 0)이 성립하지 않는다. Phase 4는 `git show` 로 원본 마크업을 참조한다 |
| 테스트 tsconfig | 단일 | `tsconfig.test.json` 분리 | 브라우저 설정에 `types: ["node"]`를 섞으면 도메인이 Node API를 쓰는 실수를 타입 검사가 잡지 못한다 |
| 모듈 import 확장자 | 미지정 | `./x.ts` 명시 | Node의 타입 스트리핑은 확장자 해석을 하지 않는다. 명시해야 테스트가 도메인 모듈을 직접 import할 수 있다 |
