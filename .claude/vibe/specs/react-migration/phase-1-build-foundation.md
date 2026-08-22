---
status: complete
phase: 1
lastUpdated: 2026-08-22
---

# SPEC: react-migration — Phase 1: 빌드 기반

**Master**: `.claude/vibe/specs/react-migration/_index.md`

## Persona
<role>
Vite/TypeScript 빌드 체인을 다뤄 온 시니어 프론트엔드 엔지니어.
빌드 산출물의 로딩 계약(스크립트 태그 형식, 자산 경로, 캐시 키)을 정확히 통제한다.
</role>

## Context
<context>
### Background
현재는 소스와 배포물이 동일하다. 그래서 모듈 분할이 곧 `file://` 실행 포기를 의미했고, 그 결과 `app.js` 상단에 도메인 로직이 복제되어 있다(`app.js:1-2` 주석이 그 이유를 명시). 빌드 스텝을 도입해 **소스와 배포물을 분리**하면 이 제약이 사라진다.

### 핵심 제약: file:// 실행 유지
`file://`에서는 `<script type="module">`이 CORS로 차단된다. 따라서 번들 포맷을 **IIFE 단일 청크**로 고정하고, 산출된 `index.html`의 스크립트 태그에서 `type="module"`/`crossorigin`을 제거해야 한다. Vite는 iife 포맷에서도 module 태그를 주입할 수 있으므로, 빌드 후 검증 및 필요 시 후처리 스크립트로 보장한다.

### 디렉터리 재배치
Vite 기본 `outDir`이 `dist`인데 현재 `dist/server/index.js`는 목업 Worker 산출 경로다. 충돌하므로 다음처럼 나눈다.

| 경로 | 내용 |
|------|------|
| `dist/client/` | Vite 산출물 (`index.html`, `app.js`, `styles.css`, `assets/`) |
| `dist/server/index.js` | 공개 목업 Worker (Phase 6에서 갱신) |

### 정적 자산 이동
`public/`에 두면 Vite가 변형 없이 그대로 복사한다. 서비스워커의 프리캐시 목록이 파일명에 의존하므로 **해시 없는 고정 파일명**을 사용한다.

| 이동 전 | 이동 후 |
|---------|---------|
| `manifest.webmanifest` | `public/manifest.webmanifest` |
| `sw.js` | `public/sw.js` |
| `assets/icons/*.png` | `public/assets/icons/*.png` |
| `assets/characters/*.png` | `public/assets/characters/*.png` |
</context>

## Task
<task>
### 1. 의존성 설치
1. [ ] `npm i react@^19.2 react-dom@^19.2`
2. [ ] `npm i -D vite@^8.2 @vitejs/plugin-react@^6.1 typescript@^5 @types/react @types/react-dom @types/w3c-web-serial`
   - Verify: `npm ls --depth=0`에 8개 패키지가 보인다
3. [ ] `.gitignore`에 `node_modules/` 추가

### 2. TypeScript 설정
1. [ ] `tsconfig.json` 생성
   - `strict: true`, `noUncheckedIndexedAccess: true`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, `noEmit: true`, `types: ["w3c-web-serial"]`
2. [ ] `tsconfig.node.json` 생성 — `vite.config.ts`와 `scripts/*.mjs` 대상

### 3. Vite 설정
1. [ ] `vite.config.ts` 생성
   - File: `vite.config.ts`
   - `base: "./"` — 상대 경로 산출로 `file://` 및 서브패스 배포 대응
   - `build.outDir: "dist/client"`, `build.emptyOutDir: true`
   - `build.modulePreload: false`, `build.cssCodeSplit: false`
   - `build.rollupOptions.output`: `format: "iife"`, `inlineDynamicImports: true`, `entryFileNames: "app.js"`, `assetFileNames: "[name][extname]"`
   - `server.proxy`: `/api` → `http://localhost:4173` (개발 중 기존 API 서버 재사용)
2. [ ] `scripts/patch-classic-script.mjs` 생성 — 산출된 `dist/client/index.html`에서 `type="module"`과 `crossorigin` 속성 제거
   - 이미 제거되어 있으면 무변경으로 통과(멱등)

### 4. 진입점 골격
1. [ ] `index.html`을 Vite 템플릿으로 교체
   - `<head>`의 PWA 메타·아이콘·manifest 링크는 **현행 그대로 유지**
   - `<body>`는 `<div id="root"></div>` + `<script type="module" src="/src/main.tsx"></script>`
2. [ ] `src/main.tsx` 생성 — `createRoot(document.getElementById("root")!).render(<App />)`
3. [ ] `src/App.tsx` 생성 — Phase 4까지는 `"Rhythm Hero"` 텍스트만 렌더하는 자리표시자
4. [ ] `src/styles.css`로 기존 `styles.css`를 **이동만** 하고 `main.tsx`에서 import
   - 내용 수정 금지. `git mv`로 이력 보존

### 5. 자산 이동
1. [ ] `public/` 디렉터리로 manifest·sw·assets 이동 (`git mv`)
2. [ ] `scripts/build-icons.mjs`의 출력 경로를 `public/assets/icons`로 변경
3. [ ] `public/sw.js`의 `ASSETS` 목록을 빌드 산출 파일명(`./app.js`, `./styles.css`)에 맞춰 확인
   - `time-utils.mjs`/`state-utils.mjs` 항목은 Phase 2에서 파일이 사라지므로 이 Phase에서 **미리 제거**
   - `CACHE`를 `rhythm-hero-v24`로 올린다

### 6. npm 스크립트 재정의
1. [ ] `dev`: `vite`
2. [ ] `build`: `npm run build:icons && tsc --noEmit && vite build && node scripts/patch-classic-script.mjs`
3. [ ] `typecheck`: `tsc --noEmit`
4. [ ] `start`: `node server.mjs` (Phase 6에서 `dist/client` 서빙으로 전환)
5. [ ] `check` 스크립트에서 `node --check app.js` 제거 (Phase 2에서 파일이 사라짐)
</task>

## Constraints
<constraints>
- `styles.css` 내용을 수정하지 않는다. 경로 이동만 허용한다.
- 번들에 해시 파일명을 쓰지 않는다. 서비스워커 프리캐시 목록이 고정 이름에 의존한다.
- `index.html`의 `<head>` PWA 태그(메타 4종, 아이콘 링크 3종, manifest)를 누락하지 않는다.
- 이 Phase에서 앱 기능을 옮기지 않는다. 빌드가 도는 골격까지만.
</constraints>

## Output Format
<output_format>
### Files to Create
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.node.json`
- `src/main.tsx`
- `src/App.tsx`
- `scripts/patch-classic-script.mjs`

### Files to Move
- `styles.css` → `src/styles.css`
- `manifest.webmanifest` → `public/manifest.webmanifest`
- `sw.js` → `public/sw.js`
- `assets/**` → `public/assets/**`

### Files to Modify
- `index.html`, `package.json`, `.gitignore`, `scripts/build-icons.mjs`, `public/sw.js`

### Verification Commands
- `npm run typecheck`
- `npm run build`
- `ls dist/client/app.js dist/client/styles.css dist/client/manifest.webmanifest`
- `grep -c 'type="module"' dist/client/index.html`  → 0 이어야 한다
- `open dist/client/index.html` (macOS) → 콘솔 에러 없이 "Rhythm Hero" 표시
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: `npm run build`가 0 코드로 끝나고 `dist/client/app.js`가 생성된다
- [ ] AC-2: `dist/client/index.html`에 `type="module"`과 `crossorigin`이 **0건**이다
- [ ] AC-3: `dist/client/index.html`을 `file://`로 열면 JS 콘솔 에러 0건으로 자리표시자가 렌더된다
- [ ] AC-4: `dist/client/`에 `manifest.webmanifest`, `sw.js`, `assets/icons/` 4개 PNG가 모두 복사된다
- [ ] AC-5: 산출 파일명에 콘텐츠 해시가 없다 (`app.js`, `styles.css` 고정)
- [ ] AC-6: `npm run typecheck`가 에러 0건이다
- [ ] AC-7: `npm test`가 기존 8개 테스트를 그대로 통과한다 (이 Phase는 앱 로직 미변경)
</acceptance>

## 구현 결과 (2026-08-22)

| AC | 결과 | 실측 |
|----|------|------|
| AC-1 빌드 성공 | ✅ | `dist/client/app.js` 190.1KB (gzip 59.1KB, 예산 150KB) |
| AC-2 module 태그 0건 | ✅ | `<script defer src="./app.js">` |
| AC-3 file:// 렌더 | ✅ | 헤드리스 Chrome `--dump-dom`으로 `#root` 마운트 확인 |
| AC-4 PWA 자산 복사 | ✅ | manifest·sw·아이콘 4·캐릭터 4 = 12파일 |
| AC-5 해시 없는 파일명 | ✅ | `app.js`, `styles.css` |
| AC-6 타입 검사 | ✅ | 에러 0건 |
| AC-7 테스트 | ✅ | 8/8 통과 (계약 갱신 후) |

### 추가로 수행한 작업 (Phase 6에서 이동)
- `server.mjs` 정적 루트를 `dist/client`로 전환, `publicFiles` allowlist 제거, 빌드 부재 시 기동 실패 안내
- `tests/server.integration.test.mjs` 단언 교체 — 삭제한 7건마다 대체 단언을 두었고 비공개 경로 검사를 4개→8개로 확대
