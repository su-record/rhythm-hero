# Feature: react-migration - Phase 5: 하드웨어·PWA 통합

**SPEC**: `.claude/vibe/specs/react-migration/phase-5-device-pwa.md`
**Master Feature**: `.claude/vibe/features/react-migration/_index.feature`

## User Story
**As a** 개발보드를 연결해 쓰는 사용자
**I want** 이전과 동일한 USB 연결·LED 피드백·앱 설치 경험
**So that** 하드웨어 데모가 그대로 재현된다

## Scenarios

### Scenario 1: 보드 입력이 파싱된다
```gherkin
Scenario: 프로토콜 순수 함수
  Given parseHardwareLine이 순수 함수일 때
  When "BUTTON:3", "button : 2", JSON 이벤트, 잡음 문자열을 각각 넣으면
  Then 앞의 셋은 버튼 인덱스를, 잡음은 null을 반환한다
```
**Verification**: AC-1

### Scenario 2: 연결 해제 후 재연결된다
```gherkin
Scenario: Edge - reader lock 누수 없음
  Given USB 보드가 연결된 상태에서
  When 연결을 해제하고 곧바로 다시 연결하면
  Then 잠금 오류 없이 재연결에 성공한다
```
**Verification**: AC-2

### Scenario 3: LED 중복 송신을 억제한다
```gherkin
Scenario: 지문 비교
  Given 목표 진행률과 실행 상태가 변하지 않았을 때
  When 렌더가 여러 번 발생하면
  Then 보드로 나가는 LED payload는 추가 송신되지 않는다
```
**Verification**: AC-3

### Scenario 4: 미지원 브라우저
```gherkin
Scenario: Edge - Web Serial 없음
  Given Safari처럼 navigator.serial이 없는 브라우저에서
  When "USB 연결"을 누르면
  Then 안내 토스트만 표시되고 앱은 계속 정상 동작한다
```
**Verification**: AC-4

### Scenario 5: 설치 패널 상태 판정
```gherkin
Scenario: iOS Safari 안내
  Given navigator.standalone이 false인 iOS Safari에서
  When 설정 탭을 열면
  Then 공유 버튼 안내 문구가 표시되고 설치 버튼은 숨겨진다
```
**Verification**: AC-5

### Scenario 6: 입력 경로 수렴
```gherkin
Scenario: 네 경로 동일 동작
  Given 카드 클릭, 키보드 1, 보드 BUTTON:1, window.habitToy.pressButton(1)에 대해
  When 각각을 실행하면
  Then 모두 동일한 세션 시작/종료 결과를 만든다
```
**Verification**: AC-6

## Coverage
| Scenario | SPEC AC | 상태 |
|----------|---------|------|
| 1 | AC-1 | ⬜ |
| 2 | AC-2 | ⬜ |
| 3 | AC-3 | ⬜ |
| 4 | AC-4 | ⬜ |
| 5 | AC-5 | ⬜ |
| 6 | AC-6 | ⬜ |
