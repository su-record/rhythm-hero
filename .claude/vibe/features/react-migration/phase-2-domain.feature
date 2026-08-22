# Feature: react-migration - Phase 2: 도메인 로직 단일화

**SPEC**: `.claude/vibe/specs/react-migration/phase-2-domain.md`
**Master Feature**: `.claude/vibe/features/react-migration/_index.feature`

## User Story
**As a** 개발자
**I want** 도메인 규칙이 한 곳에만 존재하는 순수 모듈
**So that** 고친 로직이 실제 실행되는 코드와 같음을 테스트가 보장한다

## Scenarios

### Scenario 1: 이중 정의가 사라진다
```gherkin
Scenario: 단일 소스
  Given 기존에 completeActiveSession이 app.js와 state-utils.mjs 두 곳에 있었고
  When 도메인 모듈로 통합하면
  Then 프로젝트 전체에서 해당 함수 정의가 정확히 1개다
```
**Verification**: AC-1

### Scenario 2: 도메인이 브라우저를 모른다
```gherkin
Scenario: 순수성 보장
  Given src/domain 아래 모든 모듈에 대해
  When document/window/localStorage/fetch 참조를 검색하면
  Then 결과가 0건이다
```
**Verification**: AC-2

### Scenario 3: 계산 결과가 바뀌지 않는다
```gherkin
Scenario: 자정 경계 세션
  Given 23:40에 시작해 00:20에 끝난 세션이 있을 때
  When overlapMsForDay로 두 날짜의 겹침을 구하면
  Then 각각 20분과 20분으로 기존과 동일하게 분할된다
```
**Verification**: AC-3, AC-5

### Scenario 4: 리플렉션 규칙을 함수 하나로 추가할 수 있다
```gherkin
Scenario: 규칙 생성기 분해
  Given getReflectionReport가 규칙 생성기 배열을 순회하는 구조일 때
  When 새 규칙 생성기 함수를 배열에 추가하면
  Then 다른 규칙 코드를 수정하지 않고 새 근거 카드가 나타난다
```
**Verification**: AC-4

### Scenario 5: 기록이 없는 기간
```gherkin
Scenario: Edge - 완료 기록 0건
  Given 선택한 기간에 완료된 세션이 없을 때
  When 리플렉션 리포트를 생성하면
  Then 비교 근거가 insufficient: true로 표시되고 앱이 오류 없이 렌더된다
```
**Verification**: AC-5

## Coverage
| Scenario | SPEC AC | 상태 |
|----------|---------|------|
| 1 | AC-1 | ⬜ |
| 2 | AC-2 | ⬜ |
| 3 | AC-3, AC-5 | ⬜ |
| 4 | AC-4 | ⬜ |
| 5 | AC-5, AC-6 | ⬜ |
