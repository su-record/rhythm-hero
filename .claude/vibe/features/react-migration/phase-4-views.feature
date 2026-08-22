# Feature: react-migration - Phase 4: 뷰 컴포넌트화

**SPEC**: `.claude/vibe/specs/react-migration/phase-4-views.md`
**Master Feature**: `.claude/vibe/features/react-migration/_index.feature`

## User Story
**As a** Rhythm Hero 사용자
**I want** 이전과 똑같이 보이고 똑같이 동작하는 화면
**So that** 내부 구조가 바뀐 것을 눈치채지 못한다

## Scenarios

### Scenario 1: 화면이 그대로다
```gherkin
Scenario: 마크업 동형
  Given styles.css를 수정하지 않은 상태에서
  When 4개 뷰를 차례로 연다
  Then 클래스 구조와 시각적 결과가 이전과 동일하다
```
**Verification**: AC-1, AC-7

### Scenario 2: 1초 틱이 카드를 재생성하지 않는다
```gherkin
Scenario: 핵심 성능 회귀 제거
  Given 세션을 시작해 기록이 진행 중일 때
  When MutationObserver로 #category-grid를 10초간 관찰하면
  Then childList 변경 이벤트가 0건이고
  And 카드의 시간 텍스트와 진행률만 갱신된다
```
**Verification**: AC-2, AC-3

### Scenario 3: 키보드 단축키의 예외 조건
```gherkin
Scenario: Edge - 입력 중 단축키 무시
  Given 활동 이름 입력창에 포커스가 있을 때
  When 숫자 "1"을 입력하면
  Then 세션이 시작되지 않고 글자가 그대로 입력된다
```
**Verification**: AC-4

### Scenario 4: 다이얼로그 접근성 유지
```gherkin
Scenario: 네이티브 dialog 동작
  Given 기록 수정 다이얼로그를 열었을 때
  When ESC 키를 누르면
  Then 다이얼로그가 닫히고 포커스가 호출 지점으로 돌아온다
```
**Verification**: AC-1

### Scenario 5: XSS 표면이 사라진다
```gherkin
Scenario: 이스케이프 수동 관리 폐지
  Given 활동 이름에 "<script>" 문자열을 넣었을 때
  When 목록과 카드에 표시되면
  Then 문자 그대로 표시되고 dangerouslySetInnerHTML 사용이 0건이다
```
**Verification**: AC-5

## Coverage
| Scenario | SPEC AC | 상태 |
|----------|---------|------|
| 1 | AC-1, AC-7 | ⬜ |
| 2 | AC-2, AC-3 | ⬜ |
| 3 | AC-4 | ⬜ |
| 4 | AC-1 | ⬜ |
| 5 | AC-5, AC-6 | ⬜ |
