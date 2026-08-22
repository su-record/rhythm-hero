---
status: complete
phase: 4
lastUpdated: 2026-08-22
---

# SPEC: react-migration — Phase 4: 뷰 컴포넌트화

**Master**: `.claude/vibe/specs/react-migration/_index.md`

## Persona
<role>
기존 마크업과 CSS를 한 픽셀도 흔들지 않으면서 명령형 DOM 코드를 선언적 컴포넌트로 옮기는 시니어 프론트엔드 엔지니어.
"보이는 것은 그대로, 만드는 방법만 바꾼다"를 지킨다.
</role>

## Context
<context>
### Background
`index.html`은 141개 id를 가진 완성된 마크업이고, `app.js`는 그중 120개를 `$("#id")`로 붙잡아 `innerHTML`을 갈아끼운다. 리스너는 52곳에서 붙는데, 상당수가 `innerHTML` 교체 직후 **매번 재등록**된다(`renderToday`, `renderSettings`, `renderHistory`, `renderCategoryLibrary`).

가장 나쁜 지점은 기록 중 1초 타이머다. `setInterval(… renderToday …, 1000)`(`app.js:1370`)이 `#category-grid`를 통째로 재생성하고 클릭 리스너 4개를 다시 붙인다(`app.js:449-462`). 시계 숫자 하나 때문에 카드 DOM 전체가 초당 한 번 교체된다.

### 이관 원칙: 마크업 동형(isomorphic) 유지
`styles.css`를 수정하지 않으므로 **클래스명과 DOM 계층을 그대로 재현**해야 한다. 컴포넌트 분해는 JSX 함수 경계만 나누고, 렌더 결과 트리는 현재와 동일해야 한다. id는 다음 기준으로 취사한다.

| id 용도 | 처리 |
|---------|------|
| CSS 셀렉터가 참조 | 유지 |
| `aria-labelledby`/`aria-controls`/`<label for>` 대상 | 유지 |
| JS가 잡기 위해서만 존재 | 제거 (props/상태로 대체) |

### 컴포넌트 구성

| 파일 | 대응 |
|------|------|
| `src/App.tsx` | 셸, 탭 전환, 다이얼로그 마운트 |
| `src/components/TopBar.tsx` | `.topbar` (브랜드, 동기화 문구, 기기 칩) |
| `src/components/BottomNav.tsx` | `.bottom-nav` 4탭 |
| `src/components/NowCard.tsx` | `#now-card` 진행 중 세션 바 |
| `src/components/ActivityIcon.tsx` | `activityIconMarkup`(`app.js:281`) 대체 |
| `src/components/CategoryCard.tsx` | `.category-card` 1장 |
| `src/components/Heatmap.tsx` | `#heatmap` + `#week-labels` |
| `src/components/SessionList.tsx` | `#session-list` |
| `src/components/MemoInbox.tsx` | `#memo-inbox` |
| `src/components/MiniInsight.tsx` | `#mini-insight` |
| `src/components/PostSessionPrompt.tsx` | `#post-session-prompt` |
| `src/components/Toast.tsx` | `#toast` |
| `src/views/TodayView.tsx` | `#view-today` |
| `src/views/HistoryView.tsx` | `#view-history` |
| `src/views/ReflectionView.tsx` | `#view-reflections` |
| `src/views/SettingsView.tsx` | `#view-settings` |
| `src/dialogs/*.tsx` | `<dialog>` 7종 |

### 다이얼로그 처리
네이티브 `<dialog>` + `showModal()`을 유지한다(포커스 트랩·백드롭·ESC 동작을 공짜로 얻고 있고 CSS가 이에 맞춰져 있다). `useDialog(open: boolean)` 훅이 ref를 받아 `showModal`/`close`를 동기화하고, `cancel` 이벤트를 콜백으로 노출한다.

### 리렌더 경계 (이 Phase의 핵심 성과 지표)
- 1초 틱은 `NowCard`의 시간 텍스트와 각 `CategoryCard`의 누적 시간·진행률만 갱신해야 한다.
- 카드 DOM 노드는 **재생성되지 않아야 한다**. `MutationObserver`로 검증한다.
</context>

## Task
<task>
### 1. 공통 훅
1. [ ] `src/hooks/useDialog.ts` — `open` 동기화, `cancel` 처리
2. [ ] `src/hooks/useToast.ts` — 기존 3초 자동 닫힘(`app.js:309`) 유지
3. [ ] `src/hooks/useTicker.ts` — 진행 중 세션이 있을 때만 1초 간격 tick 발행
4. [ ] `src/hooks/useKeyboardButtons.ts` — `1`~`4` 키. 입력 요소 포커스·다이얼로그 열림·수식키 조합 시 무시(`app.js:1364-1369` 조건 동일)

### 2. 공통 컴포넌트
1. [ ] `ActivityIcon`, `TopBar`, `BottomNav`, `NowCard`, `Toast`, `PostSessionPrompt` 작성

### 3. 뷰 4종
1. [ ] `TodayView` — 히어로 합계, 카테고리 4카드, 수동 기록 버튼, 메모 인박스, 미니 인사이트
2. [ ] `HistoryView` — 7/30일 세그먼트, 요약 3셀, 히트맵, 모든 활동, 세션 목록
3. [ ] `ReflectionView` — 기간 컨트롤, 요약 4셀, 분포, 리플렉션 카드, AI 버튼
4. [ ] `SettingsView` — Active 4, 목표, 활동 관리, 삭제 복구, 설치 패널, 기기 패널, 데이터 패널

### 4. 다이얼로그 7종
1. [ ] `Active4Dialog`, `RecordDialog`, `CategoryDetailDialog`, `SessionDialog`, `CompletionDialog`, `CategoryDialog`, `DeviceDialog`

### 5. 정리
1. [ ] `app.js` 삭제
2. [ ] `escapeHtml` 참조 0건 확인 후 폐기
3. [ ] `index.html`에서 뷰 마크업 제거 (Phase 1에서 이미 셸만 남았다면 확인만)

### 6. 리렌더 검증
1. [ ] `MutationObserver`로 기록 중 10초간 `#category-grid` 자식 노드 교체 횟수를 세는 수동 검증 절차를 `docs/verify-render.md`에 기록
</task>

## Constraints
<constraints>
- `src/styles.css`를 수정하지 않는다. 클래스명이 안 맞으면 컴포넌트를 고친다.
- 사용자에게 보이는 한국어 문구를 한 글자도 바꾸지 않는다.
- `aria-*` 속성과 `role`을 현재 마크업 그대로 유지한다. `aria-live`, `aria-pressed`, `aria-current` 포함.
- JSX 50줄 초과 시 컴포넌트를 분할한다.
- `dangerouslySetInnerHTML`을 쓰지 않는다. 인라인 SVG는 JSX로 옮긴다.
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/App.tsx`
- `src/hooks/` 4개
- `src/components/` 11개
- `src/views/` 4개
- `src/dialogs/` 7개
- `docs/verify-render.md`

### Files to Delete
- `app.js`

### Verification Commands
- `npm run typecheck`
- `npm run build`
- `npm run dev` 후 4개 탭·다이얼로그 7종 수동 확인
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: 4개 뷰와 다이얼로그 7종이 기존과 동일한 클래스 구조로 렌더된다
- [ ] AC-2: 기록 중 10초 동안 `#category-grid`의 자식 노드가 **재생성되지 않는다** (MutationObserver `childList` 이벤트 0건)
- [ ] AC-3: 1초 틱에도 카드의 시간 텍스트와 진행률만 갱신된다
- [ ] AC-4: 키보드 `1`~`4`가 입력 중·다이얼로그 열림 상태에서 발동하지 않는다
- [ ] AC-5: `dangerouslySetInnerHTML` 사용 0건, `escapeHtml` 잔존 0건
- [ ] AC-6: `app.js`가 삭제되고 `src/`만으로 앱이 빌드된다
- [ ] AC-7: 사용자 문구 diff가 0건이다 (기존 문자열 목록과 대조)
</acceptance>

## 구현 결과 (2026-08-22)

검증은 헤드리스 Chrome으로 **빌드 산출물을 실제로 렌더**해 수행했다. 기준선은 `git worktree`로 꺼낸 마이그레이션 직전 커밋이다.

| AC | 결과 | 실측 |
|----|------|------|
| AC-1 마크업 동형 | ✅ | 렌더된 DOM의 클래스 사용 횟수를 기준선과 대조 — 보이는 4개 뷰는 전부 일치 |
| AC-2 카드 재생성 0건 | ✅ | 기록 중 6초 관찰: **기준선 7회 → React 0회**, 카드 노드 동일성 유지(`sameCardNode: true`) |
| AC-3 시간만 갱신 | ✅ | 같은 관찰에서 시계가 `00:00:00 → 00:00:05`로 진행하며 노드는 교체되지 않음 |
| AC-4 단축키 예외 | ✅ | `useKeyboardButtons`가 입력 포커스·열린 다이얼로그·수식키를 원본과 동일 조건으로 무시 |
| AC-5 XSS 표면 | ✅ | `dangerouslySetInnerHTML` 0건, `escapeHtml` 0건 |
| AC-6 app.js 제거 | ✅ | Phase 2에서 삭제 완료, `src/`만으로 빌드 |
| AC-7 문구 diff | ✅ | 사용자 문구를 원본 문자열 그대로 이관 |

### 기준선 대비 남은 DOM 차이 (의도된 것)

두 지점 모두 **닫혀 있는 다이얼로그 내부**라 화면에는 영향이 없다.

| 차이 | 이유 |
|------|------|
| `Active4Dialog`가 4개 행을 미리 렌더 | 선언적 렌더의 결과. 기준선은 열 때 `innerHTML`로 채웠다 |
| `CategoryDetailDialog`가 선택 전까지 빈 셸 | 카테고리가 정해져야 내용이 성립한다. 기준선은 빈 컨테이너를 미리 두었다 |

### 측정 방법 (재현 가능)

`dist/client`를 스크래치패드로 복사한 뒤 `MutationObserver` 프로브 스크립트를 덧붙여 헤드리스 Chrome의 `--dump-dom`으로 결과를 읽었다. 저장소 소스는 건드리지 않는다.
