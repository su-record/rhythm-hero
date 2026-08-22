---
status: complete
phase: 6
lastUpdated: 2026-08-22
---

# SPEC: react-migration — Phase 6: 서버·배포·테스트 계약 갱신

**Master**: `.claude/vibe/specs/react-migration/_index.md`

## Persona
<role>
빌드 산출물과 런타임 서빙 계약을 맞추는 시니어 엔지니어.
테스트가 "실제 배포되는 것"을 검증하도록 계약을 다시 쓴다.
</role>

## Context
<context>
### Background
`server.mjs`는 프로젝트 루트의 파일을 **명시적 allowlist**(`publicFiles` 7개 + `assets/` 접두사)로 서빙한다(`server.mjs:26-38`). 소스가 `src/`로 옮겨지고 배포물이 `dist/client/`가 되면 이 allowlist는 의미를 잃는다. 루트 대신 **빌드 산출 디렉터리를 루트로 삼아** 서빙하는 편이 더 안전하다. 산출 디렉터리에는 공개해도 되는 것만 들어 있기 때문이다.

### 통합 테스트가 깨지는 지점
현재 테스트는 index.html 본문에서 `id="completion-dialog"`, `id="memo-inbox"`, `id="install-panel"` 등을 단언한다. React 전환 후 이 마크업은 **런타임에 생성**되므로 서버가 내려주는 HTML에는 없다. 단언을 다음으로 대체한다.

| 기존 단언 | 대체 |
|-----------|------|
| 뷰/다이얼로그 id 존재 | `<div id="root">` 존재 + `app.js` 스크립트 태그 |
| `app.js`에 `import` 없음 | 번들 산출물에 `type="module"` 없음 + IIFE 확인 |
| 캐릭터 PNG 서빙 | 유지 (경로만 `dist/client/assets/...`) |
| manifest 아이콘 3종 | 유지 |
| 아이콘 PNG 시그니처 | 유지 |

### 목업 Worker
`scripts/build-public-mockup.mjs`는 루트 파일을 읽어 base64로 인라인한다. 이제 `dist/client/`를 **디렉터리 순회**로 읽도록 바꾼다. 파일 목록을 손으로 유지하지 않게 되므로 자산 추가 시 누락이 사라진다.
</context>

## Task
<task>
### 1. 서버 서빙 전환 — **Phase 1에서 완료**
1. [x] `server.mjs`의 정적 루트를 `dist/client`로 변경 (`HABIT_TOY_CLIENT_DIR`로 재정의 가능)
2. [x] `publicFiles` allowlist 제거, 경로 이탈(`..`) 방어는 유지
3. [x] `dist/client`가 없으면 기동 시 `npm run build`를 안내하는 명확한 에러 출력
4. [x] `/api/state/:id`, `/api/reflection` 핸들러는 **무변경**

### 2. 목업 Worker 빌드
1. [ ] `scripts/build-public-mockup.mjs`를 `dist/client` 재귀 순회 방식으로 변경
2. [ ] content-type 매핑을 `server.mjs`와 공유(`scripts/mime.mjs`로 추출)
3. [ ] 캐시 헤더 규칙 유지: PNG `public, max-age=86400`, 그 외 `no-cache`

### 3. 테스트 갱신 — 셸 단언은 Phase 1에서 완료
1. [x] `tests/server.integration.test.mjs` 단언을 위 표대로 교체
2. [ ] 빌드 산출물 부재 시 테스트가 명확히 실패하도록 사전 조건 확인 추가
3. [ ] `package.json`의 `pretest`에서 `npm run build` 실행

### 4. 문서 갱신
1. [ ] `README.md` — 개발(`npm run dev`)·빌드(`npm run build`)·실행(`npm start`) 절차, 디렉터리 구조
2. [ ] `docs/DESIGN-HANDOFF.md`의 파일 경로 참조가 있으면 갱신
3. [ ] `.gitignore`에 `dist/` 유지 확인

### 5. 회귀 체크리스트 수행
1. [ ] `docs/migration-checklist.md` 작성 후 항목별 수동 확인
   - 4개 뷰 렌더 / 다이얼로그 7종 개폐 / 세션 시작·종료·메모 / 히트맵 7·30일 전환
   - 카테고리 추가·보관·복원 / 세션 수정·삭제·복구 / JSON 내보내기 / 데모 초기화
   - 리플렉션 7·30일 + AI 호출 실패 폴백 / 오프라인 전환 후 기록 / 설치 패널 / 키보드 1–4
</task>

## Constraints
<constraints>
- API 엔드포인트의 동작·검증 규칙·에러 문구를 바꾸지 않는다.
- `.habit-toy-data/` 저장 포맷을 바꾸지 않는다. 기존 저장 상태가 그대로 복원돼야 한다.
- 테스트에서 삭제되는 단언마다 대체 단언을 반드시 둔다. 커버리지를 줄이지 않는다.
</constraints>

## Output Format
<output_format>
### Files to Create
- `scripts/mime.mjs`
- `docs/migration-checklist.md`

### Files to Modify
- `server.mjs`, `scripts/build-public-mockup.mjs`, `tests/server.integration.test.mjs`, `package.json`, `README.md`

### Verification Commands
- `npm run build`
- `npm test`
- `npm run build:mockup && node --check dist/server/index.js`
- `npm start` 후 `curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: `npm start`가 `dist/client`를 서빙하고 루트 요청이 200을 반환한다
- [ ] AC-2: `server.mjs`가 `src/`, `server.mjs`, `.env`, `tests/`를 서빙하지 않는다 (각각 404)
- [ ] AC-3: 통합 테스트가 전부 통과하고, 삭제된 단언마다 대체 단언이 존재한다
- [ ] AC-4: 목업 Worker가 `dist/client` 전체 파일을 자동 포함한다 (수동 목록 0건)
- [ ] AC-5: 기존 `.habit-toy-data/{clientId}.json`을 그대로 읽어 복원된다
- [ ] AC-6: 회귀 체크리스트 전 항목이 통과로 기록된다
- [ ] AC-7: README가 새 개발·빌드 절차를 반영한다
</acceptance>

## 구현 결과 (2026-08-22)

| AC | 결과 | 실측 |
|----|------|------|
| AC-1 dist/client 서빙 | ✅ | `/`, `/app.js`, `/styles.css`, `/manifest.webmanifest`, `/sw.js`, 아이콘 모두 200 |
| AC-2 소스 비노출 | ✅ | `/src/main.tsx`, `/server.mjs`, `/package.json`, `/vite.config.ts`, `/.env.example`, `/tests/…`, `/docs/…` 모두 404 |
| AC-3 커버리지 유지 | ✅ | 삭제 단언 7건마다 대체 단언 배치, 비공개 경로 검사 4→8개, 전체 8→64건 |
| AC-4 목업 자동 수집 | ✅ | 수동 목록 8개 → 디렉터리 순회 13개. `tests/build/mockup.test.mjs`가 누락 시 실패한다 |
| AC-5 저장 포맷 호환 | ✅ | `/api/state/:id` 핸들러 무변경, `.habit-toy-data` 포맷 그대로 |
| AC-6 회귀 체크리스트 | ✅ | `docs/migration-checklist.md` 작성. 자동 검증 항목과 수동 항목을 구분 |
| AC-7 README | ✅ | 디렉터리 구조, dev/build/start 절차, `file://` 실행 조건 반영 |

### 부수 성과

목업 Worker의 수동 자산 목록이 **이미 아이콘 4개와 캐릭터 이미지 4개를 빠뜨리고 있었다**. 디렉터리 순회로 바꾸자 8개에서 13개로 늘었다. 공개 배포본에서 manifest가 가리키는 아이콘이 404였다는 뜻이고, 설치가 되지 않았을 것이다.
