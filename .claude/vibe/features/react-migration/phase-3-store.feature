# Feature: react-migration - Phase 3: 상태 계층과 동기화

**SPEC**: `.claude/vibe/specs/react-migration/phase-3-store.md`
**Master Feature**: `.claude/vibe/features/react-migration/_index.feature`

## User Story
**As a** 개발자
**I want** React 안팎에서 동일하게 접근되는 단일 상태 소유자
**So that** 화면을 추가할 때 render() 수동 결선을 잊어 UI가 어긋나는 일이 없다

## Scenarios

### Scenario 1: 기존 사용자 데이터가 그대로 살아난다
```gherkin
Scenario: 저장 포맷 호환
  Given localStorage에 기존 "habit-toy-state-v1" 상태가 있을 때
  When React 버전 앱을 처음 연다
  Then 카테고리·세션·목표가 모두 이전과 동일하게 표시된다
```
**Verification**: AC-1

### Scenario 2: 저장소가 막혀도 앱이 산다
```gherkin
Scenario: Edge - localStorage 예외
  Given 시크릿 모드 등으로 localStorage 접근이 예외를 던질 때
  When 세션을 시작하고 종료하면
  Then 메모리 폴백에 기록되고 앱이 정상 동작한다
```
**Verification**: AC-2

### Scenario 3: 원격 동기화가 디바운스된다
```gherkin
Scenario: 연속 변경
  Given 300ms 간격으로 상태를 3번 바꿀 때
  When 마지막 변경 후 650ms가 지나면
  Then 서버 PUT이 정확히 1회 발생한다
```
**Verification**: AC-3

### Scenario 4: React 밖에서 상태를 바꿔도 화면이 따라온다
```gherkin
Scenario: 펌웨어 브리지
  Given 앱이 렌더된 상태에서
  When 콘솔에서 window.habitToy.pressButton(1)을 호출하면
  Then 1번 활동 세션이 시작되고 화면이 즉시 갱신된다
```
**Verification**: AC-4

### Scenario 5: 불필요한 통지를 하지 않는다
```gherkin
Scenario: Edge - 동일 값 dispatch
  Given 현재 상태와 동일한 결과를 만드는 액션을 dispatch할 때
  When 스토어가 다음 상태를 계산하면
  Then 구독자에게 통지하지 않는다
```
**Verification**: AC-5

## Coverage
| Scenario | SPEC AC | 상태 |
|----------|---------|------|
| 1 | AC-1 | ⬜ |
| 2 | AC-2 | ⬜ |
| 3 | AC-3 | ⬜ |
| 4 | AC-4 | ⬜ |
| 5 | AC-5, AC-6 | ⬜ |
