# Feature: react-migration - Phase 1: 빌드 기반

**SPEC**: `.claude/vibe/specs/react-migration/phase-1-build-foundation.md`
**Master Feature**: `.claude/vibe/features/react-migration/_index.feature`

## User Story
**As a** 개발자
**I want** 소스와 배포물이 분리된 빌드 체인
**So that** 모듈 분할과 `file://` 실행을 동시에 만족시킬 수 있다

## Scenarios

### Scenario 1: 빌드가 자립 번들을 만든다
```gherkin
Scenario: IIFE 단일 번들 산출
  Given vite.config.ts가 format "iife"로 설정되어 있고
  When "npm run build"를 실행하면
  Then dist/client/app.js와 styles.css가 해시 없는 이름으로 생성되고
  And dist/client/index.html에 type="module"이 0건이다
```
**Verification**: AC-1, AC-2, AC-5

### Scenario 2: file://에서 열린다
```gherkin
Scenario: 디스크에서 직접 실행
  Given 빌드가 완료된 상태에서
  When dist/client/index.html을 file:// 로 연다
  Then 자리표시자가 렌더되고 콘솔 에러가 0건이다
```
**Verification**: AC-3

### Scenario 3: PWA 자산이 산출물에 포함된다
```gherkin
Scenario: public 자산 복사
  Given manifest·sw·아이콘이 public/에 있고
  When 빌드를 실행하면
  Then dist/client에 manifest.webmanifest, sw.js, assets/icons PNG 4개가 존재한다
```
**Verification**: AC-4

### Scenario 4: 기존 테스트가 깨지지 않는다
```gherkin
Scenario: 회귀 없음
  Given 이 Phase는 앱 로직을 옮기지 않았고
  When "npm test"를 실행하면
  Then 기존 8개 테스트가 그대로 통과한다
```
**Verification**: AC-7

## Coverage
| Scenario | SPEC AC | 상태 |
|----------|---------|------|
| 1 | AC-1, AC-2, AC-5 | ⬜ |
| 2 | AC-3 | ⬜ |
| 3 | AC-4 | ⬜ |
| 4 | AC-6, AC-7 | ⬜ |
