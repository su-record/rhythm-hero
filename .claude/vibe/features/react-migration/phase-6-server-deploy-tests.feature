# Feature: react-migration - Phase 6: 서버·배포·테스트 계약 갱신

**SPEC**: `.claude/vibe/specs/react-migration/phase-6-server-deploy-tests.md`
**Master Feature**: `.claude/vibe/features/react-migration/_index.feature`

## User Story
**As a** 이 앱을 배포하고 유지보수하는 사람
**I want** 실제 배포되는 산출물을 검증하는 테스트와 서빙 계약
**So that** 자산이 하나 빠져도 테스트가 잡아준다

## Scenarios

### Scenario 1: 빌드 산출물을 서빙한다
```gherkin
Scenario: dist/client 서빙
  Given "npm run build"가 끝난 상태에서
  When "npm start" 후 루트를 요청하면
  Then 200과 함께 React 셸 HTML이 반환된다
```
**Verification**: AC-1

### Scenario 2: 소스가 노출되지 않는다
```gherkin
Scenario: Edge - 비공개 경로
  Given 서버가 dist/client를 루트로 서빙할 때
  When /src/main.tsx, /server.mjs, /.env, /tests/... 를 요청하면
  Then 모두 404를 반환한다
```
**Verification**: AC-2

### Scenario 3: 테스트 커버리지가 줄지 않는다
```gherkin
Scenario: 단언 대체
  Given React 전환으로 뷰 마크업 단언이 무효해졌을 때
  When 통합 테스트를 갱신하면
  Then 삭제된 단언마다 대체 단언이 존재하고 전체가 통과한다
```
**Verification**: AC-3

### Scenario 4: 목업 Worker가 자산을 자동 수집한다
```gherkin
Scenario: 수동 목록 제거
  Given dist/client에 새 자산 파일을 하나 추가했을 때
  When "npm run build:mockup"을 실행하면
  Then 스크립트를 수정하지 않아도 그 파일이 Worker에 포함된다
```
**Verification**: AC-4

### Scenario 5: 서버 저장 데이터 호환
```gherkin
Scenario: 기존 상태 복원
  Given .habit-toy-data/{clientId}.json이 이전 버전으로 저장돼 있을 때
  When React 버전 앱이 부팅 복원을 수행하면
  Then 기록이 그대로 복원되고 유실이 없다
```
**Verification**: AC-5

### Scenario 6: 회귀 체크리스트
```gherkin
Scenario: 수동 검증
  Given docs/migration-checklist.md의 12개 항목에 대해
  When 순서대로 수동 확인하면
  Then 모든 항목이 통과로 기록된다
```
**Verification**: AC-6, AC-7

## Coverage
| Scenario | SPEC AC | 상태 |
|----------|---------|------|
| 1 | AC-1 | ⬜ |
| 2 | AC-2 | ⬜ |
| 3 | AC-3 | ⬜ |
| 4 | AC-4 | ⬜ |
| 5 | AC-5 | ⬜ |
| 6 | AC-6, AC-7 | ⬜ |
