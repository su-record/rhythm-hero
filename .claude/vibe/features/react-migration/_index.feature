# Feature: react-migration (Master)

**Master SPEC**: `.claude/vibe/specs/react-migration/_index.md`

## Sub-Features

| 순서 | Feature File | SPEC File | 상태 |
|------|--------------|-----------|------|
| 1 | phase-1-build-foundation.feature | phase-1-build-foundation.md | ⬜ |
| 2 | phase-2-domain.feature | phase-2-domain.md | ⬜ |
| 3 | phase-3-store.feature | phase-3-store.md | ⬜ |
| 4 | phase-4-views.feature | phase-4-views.md | ⬜ |
| 5 | phase-5-device-pwa.feature | phase-5-device-pwa.md | ⬜ |
| 6 | phase-6-server-deploy-tests.feature | phase-6-server-deploy-tests.md | ⬜ |

## Overall User Story

**As a** Rhythm Hero를 이어서 개발하는 사람
**I want** 도메인·상태·뷰가 모듈로 분리되고 타입으로 보호되는 구조
**So that** 화면이나 규칙을 추가할 때 1387줄 단일 파일을 헤집지 않고, 고친 로직이 실제 실행되는 코드와 같음을 테스트로 보장받는다

## Overarching Scenario: 동작 보존

```gherkin
Scenario: 마이그레이션 전후 사용자 경험이 동일하다
  Given 기존 localStorage 상태 "habit-toy-state-v1"을 가진 사용자가
  When React 버전으로 교체된 앱을 연다
  Then 4개 뷰, 다이얼로그 7종, 기록·메모·히트맵·리플렉션이 이전과 동일하게 동작하고
  And 저장된 기록이 하나도 유실되지 않는다
```
