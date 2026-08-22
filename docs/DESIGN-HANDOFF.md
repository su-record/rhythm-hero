# Rhythm Hero 디자인 구현 핸드오프

> 상태: 디자인 승인 후 구현 전 명세  
> 기준일: 2026-08-22  
> 구현 상태: 미착수 — 이 문서는 코드 변경을 포함하지 않는다.

## 1. 목적과 기준 자료

이 문서는 승인된 **White Canvas, Vivid Rituals** 디자인을 현재 Rhythm Hero 기능 구조에 안전하게 적용하기 위한 구현 기준이다.

우선순위는 다음과 같다.

1. 현재 기록·데이터·하드웨어 동작 보존
2. `DESIGN.md`의 토큰과 시각 원칙 준수
3. 승인 시안의 정보 위계와 컴포넌트 형태 재현
4. 반응형·접근성·오프라인 동작 유지

기준 자료:

- 디자인 시스템: [`DESIGN.md`](./DESIGN.md)
- 오늘 화면: [`design/today-approved.png`](./design/today-approved.png)
- 기록 화면: [`design/history-approved.png`](./design/history-approved.png)
- 돌아보기 화면: [`design/reflection-approved.png`](./design/reflection-approved.png)
- 설정 화면: [`design/settings-approved.png`](./design/settings-approved.png)
- 기능 계약: `../README.md`, `Habit-Toy-App-Spec-v1.md`, 현재 `app.js`

승인 시안은 픽셀 복제 대상이 아니라 **정보 순서, 여백, 색 사용량, 아이콘 언어, 시각적 위계**의 기준이다. 실제 데이터 길이와 접근성 요구에 따라 줄바꿈과 높이는 유동적이어야 한다.

## 2. 범위

### 포함

- 전역 색상·타이포·간격·radius 토큰 교체
- 운동·독서·음악·프로젝트용 A안 모노라인 SVG 픽토그램 제작 및 적용
- 오늘, 기록, 돌아보기, 설정 화면 리스킨
- 실행 중, 빈 상태, 오류, 비활성, 선택, hover, pressed, focus 상태
- 다이얼로그, 완료 알림, 토스트, 하단 내비게이션 통일
- 320–720px 반응형과 접근성 상태
- 기존 서비스 워커에 새 정적 SVG 등록

### 제외

- 탭 수, 기록 방식, 데이터 모델의 기능 확장
- 점수, 스트릭, 코인, 랭킹, 벌점 추가
- 새로운 AI 기능 또는 AI 응답 규칙 변경
- Web Serial 메시지 형식 변경
- 네이티브 앱 전환이나 프레임워크 도입
- 자동 재생 영상, 사운드, 진동 추가
- 사용자 정의 Category에 영속적인 아이콘 선택 필드 추가

## 3. 구현 핵심 원칙

### 3.1 기능 DOM 계약 보존

현재 `id`, `data-*`, form, dialog, 버튼 이벤트 연결은 기능 계약으로 취급한다. 특히 다음 속성과 요소는 유지한다.

- `data-tab`, `data-range`, `data-reflection-range`
- `data-button-index`, `data-session-id`, `data-category-detail`
- `data-assignment`, `data-goal`, `data-archive-category`
- `data-restore-session`, `data-active4-slot`
- `#category-grid`, `#now-card`, `#heatmap`, `#session-list`
- `#reflection-summary`, `#reflection-distribution`, `#reflection-list`
- 모든 dialog의 현재 `id`, label 연결, submit 동작

시각 구현을 위해 wrapper나 장식용 span을 추가할 수 있지만, 기존 클릭 대상 안에 또 다른 버튼을 중첩하지 않는다.

### 3.2 CSS를 추가로 누적하지 않기

현재 `styles.css`는 약 3,541줄이며 `.category-card`와 `.bottom-nav` 같은 핵심 셀렉터가 여러 디자인 탐색 단계에서 반복 정의되어 있다. 새 디자인을 파일 마지막에 덧붙이는 방식은 금지한다.

구현 시:

1. 현재 DOM에서 실제 사용 중인 셀렉터를 목록화한다.
2. 기존 시각 스타일을 토큰·기본·컴포넌트·화면·반응형·접근성 순으로 재정리한다.
3. 핵심 컴포넌트는 기본 정의 하나와 상태/미디어 쿼리만 갖게 한다.
4. 사용하지 않는 크림·캐릭터·glass·prism·gradient 탐색 스타일은 제거한다.
5. 기능에 필요한 `hidden`, dialog, 스크롤, safe-area 규칙은 보존한다.

목표는 스타일 줄 수 자체가 아니라, 최종 cascade를 한 위치에서 이해할 수 있게 만드는 것이다.

### 3.3 색상과 아이콘을 데이터와 분리해서 다루기

기본 네 Category의 시각 매핑은 `id` 기준으로 한다.

| Category ID | 기본 이름 | 픽토그램 | 새 기본색 |
|---|---|---|---:|
| `move` | 운동 | 달리는 운동화 | `#FF5D52` |
| `read` | 독서 | 펼친 책 | `#20D68A` |
| `music` | 음악 | 음표 | `#5B70FF` |
| `project` | 프로젝트 | 체크리스트와 연필 | `#FFD43B` |

아이콘은 이름이 아니라 안정적인 Category ID로 결정한다. 사용자가 이름을 바꿔도 아이콘은 유지된다.

사용자 생성 Category는 별도 영속 필드를 추가하지 않고 공통 모노라인 심볼을 사용한다. 채움색은 사용자가 선택한 Category 색을 따른다.

기존 데이터 처리:

- 새 설치의 기본 Category 색은 위 새 팔레트를 사용한다.
- 기존 저장값이 과거 기본값과 정확히 같을 때만 새 기본색으로 변환할 수 있다.
- 사용자가 직접 바꾼 색은 덮어쓰지 않는다.
- 색 마이그레이션을 할 경우 한 번만 실행되고 반복 저장에도 멱등이어야 한다.
- 변환된 색은 통계와 하드웨어 LED에도 동일하게 반영한다.

## 4. 공통 레이아웃

### App shell

- 배경: `#FFFFFF`
- 최대 폭: 현재 720px 유지
- 좌우 여백: 기본 24px, 390px 이하 16px, 359px 이하 12px
- 하단 여백: 고정 내비게이션 높이 + safe area + 최소 24px
- 앱 바깥 데스크톱 배경도 흰색 또는 `#F6F6F3`; 장식용 그라데이션 금지

### Header

- 왼쪽: 검정 2×2 브랜드 마크 + `Rhythm Hero`
- 오른쪽: 동기화 상태 또는 화면별 보조 행동 하나
- 모바일에서 공간이 부족하면 동기화 문구를 숨기고 상태 점과 접근성 레이블은 유지
- 기기 연결 정상 상태는 헤더에서 제거하고 설정에 배치
- 연결 오류 또는 사용자 조치가 필요할 때만 헤더에 상태 노출

### Section rhythm

- 화면 제목 위 여백: 32–48px
- 큰 지표와 다음 섹션 간격: 40–48px
- 섹션 제목과 콘텐츠 간격: 16–20px
- 목록 행: 최소 64px
- 카드 내부 여백: 20–24px
- 8px spacing scale을 기본으로 사용

## 5. 공통 컴포넌트 명세

| 컴포넌트 | 현재 기준 selector | 승인 디자인 | 상태 |
|---|---|---|---|
| 브랜드 헤더 | `.topbar`, `.brand` | 흰 배경, 검정 마크와 텍스트 | 기본, 동기화 중, 오류 |
| 큰 시간 지표 | `.total-block`, `.total-time` | 라벨 + 700 weight 큰 숫자 | 0분, 기록 있음, 실행 중 |
| Category 카드 | `.category-card` | 흰 카드, 얇은 선, 44px 컬러 아이콘 | 기본, hover, pressed, running, focus |
| 실행 상태 바 | `#now-card` | 흰색 또는 약한 틴트의 고정 정보 행 | hidden, running |
| 기간 선택 | `.segmented` | 연회색 트랙, 흰 선택 면, 그림자 없음 | selected, hover, focus |
| 요약 지표 | `.history-metrics`, `.reflection-summary` | 카드 묶음이 아닌 구분선 기반 표 | 데이터, 0값, 긴 값 |
| 활동 지도 | `.heat-cell` | 원형 셀, Category 단색 채움 | empty, filled, today, focus/label |
| 목록 행 | `.session-item`, `.category-library-item` | 아이콘 + 두 줄 정보 + trailing 값 | 기본, hover, pending, archived |
| 리플렉션 본문 | `.reflection-card` | 큰 관찰 문장 + 근거 | local, AI, insufficient data |
| 분포 행 | `.reflection-distribution-row` | 아이콘 + 단색 bar + 시간/비율 | 0%, 일부, 최대 |
| 설정 행 | `.assignment-row`, `.goal-row`, `.category-manager-row` | 구분선 목록, trailing control | 기본, hover, focus, archived |
| 기본 버튼 | `.button` | 검정 면 + 흰 텍스트 | default, hover, pressed, disabled |
| 보조 버튼 | `.button.secondary`, `.text-button` | 연회색 면 또는 텍스트 | default, hover, pressed, disabled |
| 하단 메뉴 | `.bottom-nav`, `.nav-item` | 흰 고정 바, 검정 활성 메뉴 | active, inactive, running label |
| dialog | `dialog` | 흰 시트, 20px radius, 약한 그림자 | open, validation error, loading |
| 완료 알림 | `.post-session-prompt`, `.toast` | 짧은 흰 패널 또는 검정 토스트 | saved, pending memo, dismissed |

### 5.1 Category 카드

구조 순서:

1. 모노라인 활동 아이콘
2. Category명
3. 오늘 누적 시간
4. 얇은 진행 표시
5. 짧은 상태 또는 목표

상태:

- **기본**: `#FFFFFF`, 1px `#E6E6E1`, 그림자 없음.
- **hover**: 테두리만 `#CFCFC9`로 진해짐. 위치 상승 금지.
- **pressed**: 80–120ms `translateY(1px) scale(.99)`.
- **running**: Category색 2px 테두리 또는 Category색 6–8% 틴트. `기록 중` 텍스트와 `aria-pressed="true"` 유지.
- **focus-visible**: 3px 고대비 focus ring. Category색에 의존하지 않음.
- **goal complete**: 체크 형태와 텍스트를 추가하고 색만 바꾸지 않음.

`renderToday()`가 실행 중 매초 `#category-grid.innerHTML`을 다시 생성한다. 따라서 Category 카드 내부에 장기 애니메이션을 넣지 않는다. 아이콘은 정적 SVG로 두고, 반복 pulse는 재생성되지 않는 `#now-card` 또는 별도 정적 wrapper에서만 실행한다.

### 5.2 활동 픽토그램

- 최종 산출물은 raster 이미지나 시스템 이모지가 아닌 inline SVG 또는 로컬 SVG 파일.
- viewBox와 optical size를 네 아이콘에서 동일하게 맞춘다.
- 검정 stroke 1.5–2px, round cap/join.
- 아이콘당 Category색 하나만 채움.
- 얼굴, 그라데이션, 그림자, 3D 금지.
- 기본 크기 44px, 목록 36px, 작은 보조 문맥 24px.
- 장식이면 `aria-hidden="true"`; 단독 의미면 접근 가능한 이름 제공.

### 5.3 버튼

- 주요 버튼은 화면당 하나만 검정 면을 사용.
- 최소 높이 48px, 최소 터치 영역 44×44px.
- 보조 행동은 `#F6F6F3` 또는 텍스트 버튼.
- 삭제는 흰 배경 + `#C83D4A` 텍스트/아이콘. 큰 빨간 면 금지.
- disabled는 opacity만 낮추지 않고 cursor, 텍스트, `disabled` 속성을 함께 사용.

### 5.4 하단 내비게이션

- 전체 폭은 앱 셸과 정렬된 흰색 바.
- 상단 1px 구분선, blur와 floating shadow 없음.
- 네 항목 모두 56px 이상 높이.
- 활성 상태: 검정 아이콘과 600 weight 레이블.
- 비활성 상태: `#6F6F69`.
- Category색은 내비게이션에 사용하지 않음.
- `aria-current="page"`와 기존 `data-tab` 유지.
- 실행 중에는 바 색을 바꾸지 않고 현재 `aria-label`의 실행 상태만 유지.

## 6. 화면별 명세

## 6.1 오늘

### 정보 순서

1. 브랜드 헤더
2. 날짜
3. `오늘 쌓인 시간`과 총 시간
4. `나의 네 가지`
5. Active 4 2×2 grid
6. `직접 기록하기`
7. `오늘의 발견`
8. 하단 내비게이션

### 현재 DOM 대응

- `#today-date` → 날짜
- `#today-total` → 가장 큰 지표
- `#category-grid` → 2×2 Active 4
- `#manual-start` → 낮은 위계의 전체 폭 행
- `#mini-insight` → 단일 인사이트 행
- `#now-card` → 실행 중 Category, 타이머, 종료 버튼

### 실행 중

- 큰 총 시간의 위계를 유지하고, `#now-card`를 총 시간 아래의 간결한 정보 행으로 노출.
- Category 아이콘, Category명, 실시간 타이머, 검정 `종료` 버튼.
- 현재 Category 카드는 Category색 테두리와 `기록 중` 텍스트.
- 다른 Category 카드를 누르면 현재 동작대로 즉시 전환.
- 애니메이션은 상태 점 pulse 하나만 허용.

### 빈 상태

- 총 시간 `0분`.
- 설명은 `아직 기록이 없어요. 네 가지 중 하나를 눌러 시작하세요.`처럼 직접적으로 작성.
- 별도 캐릭터나 큰 일러스트는 추가하지 않음.

## 6.2 기록

### 정보 순서

1. 화면 제목 + 7일/30일
2. 기간
3. 누적·활동일·가장 긴 활동
4. 활동 지도
5. 모든 Category
6. 최근 기록

### 현재 DOM 대응

- `.segmented [data-range]` → 기간 선택
- `.history-metrics` → 구분선 기반 요약
- `#activity-map-scroll`, `#week-labels`, `#heatmap` → 원형 활동 지도
- `#category-library` → 모든 Category 목록
- `#session-list` → 최근 기록 목록

### 활동 지도

- 7일: 화면 폭 안에서 7열 원형 셀.
- 30일: 현재처럼 내부 가로 스크롤 유지. 페이지 전체 가로 스크롤은 금지.
- 기록 없음: 흰 원 + 1px 선.
- 기록 있음: Category 단색 원.
- 오늘: 검정 outer ring 추가.
- 현재 `title`과 `aria-label`의 날짜·분 정보 유지.
- 강도를 opacity로만 표현하지 않는다. 시간이 필요하면 셀 안 점 크기나 보조 텍스트를 사용한다.

### 목록

- 목록 전체를 하나의 연속된 면으로 보고 행 사이에 1px 선 사용.
- pending memo는 `메모 대기` 텍스트를 유지하되 화려한 badge 대신 작은 보조 라벨.
- 긴 Category명과 메모는 한 줄 ellipsis, 상세 dialog에서 전체 확인.
- archived Category는 opacity만 낮추지 않고 `보관 중` 텍스트 유지.

## 6.3 돌아보기

### 정보 순서

1. 화면 제목 + 작은 `AI로 새로 만들기`
2. 최근 7일/30일
3. 네 가지 요약 지표
4. 가장 중요한 관찰 한 문장
5. 근거
6. Category 시간 분포
7. 기록 기반 안내

### 현재 DOM 대응

- `#refresh-ai` → 작은 outlined secondary button
- `#reflection-range-controls` → 기간 선택
- `#reflection-summary` → 2×2 요약, 640px 이상에서도 과도한 카드화 금지
- `#reflection-distribution` → 아이콘 + 단색 bar
- `#reflection-list` → 관찰과 근거

### AI 표현

- AI 생성 여부는 source 텍스트로만 구분 가능.
- sparkle, 마법봉, 보라 그라데이션, glow 금지.
- AI 결과도 로컬 리플렉션과 같은 typography와 표면 사용.
- AI 실패 시 기존 로컬 근거 카드와 모든 기록 기능 유지.
- 생성 중에는 버튼 라벨과 disabled 상태로 진행 상황 표시.

### 데이터 부족

- 빈 큰 카드 대신 짧은 설명과 다음에 나타날 정보 안내.
- 사용자를 평가하거나 기록을 독촉하지 않음.
- `0분`, `0일`, `0개`를 숨기지 않고 사실대로 표시.

## 6.4 설정

### 정보 순서

1. 화면 제목
2. 나의 네 가지
3. 일일 목표
4. 모든 활동
5. 최근 삭제한 기록 — 데이터가 있을 때
6. 기기
7. 내 데이터

### 현재 DOM 대응

- `#assignment-list` → 실제 select를 trailing control로 유지
- `#goal-list` → 실제 number input 유지
- `#category-manager` → 이름 편집, 보관/복구 기능 유지
- `#deleted-session-list` → 복구 목록
- `#connect-device`, `#test-hardware` → 기기 기능
- `#export-data`, `#reset-demo` → 데이터 기능

승인 시안의 chevron은 정보 위계를 보여주기 위한 표현이다. 실제 구현에서는 기능을 숨긴 별도 상세 화면을 새로 만들지 않고 현재 select/input/button을 접근 가능한 형태로 유지한다.

### 설정 행

- 섹션을 큰 카드로 감싸지 않고 제목 + 연속 목록 사용.
- select/input은 최소 44px이고 명확한 label과 focus ring을 가짐.
- Category 아이콘에만 색을 사용.
- USB 패널은 `#F6F6F3`, black outline device icon, 현재 상태 텍스트.
- `데모 초기화`는 빨간 텍스트와 아이콘, 확인 dialog 유지.

## 7. Dialog·알림 명세

### Dialog

- 데스크톱: 가운데 최대 430–500px.
- 모바일: 하단 시트 또는 가운데 panel 중 현재 동작과 keyboard 안전성을 확인해 선택.
- 배경 흰색, radius 20px, modal에서만 약한 그림자.
- backdrop는 검정 30–35%, blur 필수 아님.
- 제목, 설명, 입력, 행동 순서.
- primary 행동 하나; cancel은 secondary 또는 text.
- validation error는 입력 바로 아래 빨간 텍스트와 `aria-live`.

### 기록 완료

- `#completion-dialog`의 메모 작성 기능과 세 행동을 보존.
- `#post-session-prompt`는 하단 메뉴 위에 표시하고 내용을 가리지 않음.
- 캐릭터, confetti, 트로피를 사용하지 않음.
- 저장 성공 문구는 실제 저장 상태를 반영.

### Toast

- 짧은 검정 면 + 흰 텍스트 또는 흰 panel + 검정 선 중 하나로 통일.
- 1–2줄 이내, 정보 전달 후 자동 종료.
- `aria-live` 유지.
- 반복되는 1초 타이머 업데이트는 알림하지 않음.

## 8. 인터랙션과 모션

| 동작 | 시간 | 표현 |
|---|---:|---|
| 버튼 press | 80–120ms | 1px 이동 + `.99` 축소 |
| hover/focus 전환 | 140–160ms | 색과 선 변화 |
| 탭 화면 전환 | 180ms | opacity + 4px 이동 |
| 진행 bar 갱신 | 200–250ms | width 변화 |
| dialog 진입 | 200–220ms | opacity + 작은 이동 |
| 실행 상태 pulse | 1.6s | 상태 점 opacity만 반복 |

원칙:

- `transform`과 `opacity` 중심.
- 지속 애니메이션은 실행 중 상태 점 하나만.
- hover가 없는 터치 환경에서 hover 이동 제거.
- `prefers-reduced-motion: reduce`에서는 반복과 이동을 제거하고 즉시 상태 변경.
- 모션 때문에 `renderToday()`의 1초 갱신이 다시 시작되어서는 안 됨.

## 9. 반응형

| 폭 | 규칙 |
|---:|---|
| 320–359px | 12px gutter, Active 4 2열 compact, 동기화 텍스트 숨김 |
| 360–519px | 16–20px gutter, 승인 모바일 시안 구조 |
| 520–639px | 24px gutter, 2열 Active 4 유지, 목록 여백 확대 |
| 640–720px | 24px gutter, 2열 Active 4 유지, 요약 지표는 필요 시 4열 |

추가 규칙:

- 2×2 Active 4는 앱의 위젯 정체성이므로 최대 폭에서도 기본 유지.
- 설정은 한 열 우선. 기능 밀도가 높아도 섹션을 억지로 두 열로 나누지 않음.
- 30일 활동 지도 내부만 가로 스크롤 허용.
- 하단 내비게이션은 모든 폭에서 동일한 네 항목 유지.
- 키보드가 열렸을 때 dialog 입력과 submit 버튼이 가려지지 않아야 함.

## 10. 접근성

- 일반 텍스트 WCAG AA 4.5:1 이상.
- 큰 텍스트도 가능한 한 4.5:1 유지.
- Category색 위의 선과 텍스트는 `#111111` 사용.
- 음악색은 검정과의 대비를 위해 `#5B70FF` 사용.
- 색 + 아이콘 + 텍스트의 복수 신호.
- 주요 터치 영역 44×44px 이상.
- `focus-visible`은 배경과 Category색 모두에서 보이는 3px 링.
- `forced-colors`에서 border와 선택 상태 유지.
- `prefers-reduced-motion`, `prefers-reduced-transparency` 지원.
- dialog focus trap, escape/cancel, 제목 focus 동작 유지.
- 날짜 활동 셀의 현재 `role="img"`와 `aria-label` 유지.
- 장식 SVG는 스크린리더에서 숨기고 텍스트 label을 중복 읽지 않게 함.

## 11. 구현 단계

### Phase 0 — 기준선

- 현재 네 화면, 실행 중, 빈 상태, 주요 dialog 스크린샷 저장.
- `npm run check`, `npm test` 결과 기록.
- 현재 DOM ID/data 계약 목록 확정.

### Phase 1 — 스타일 정리와 토큰

- 중복된 과거 디자인 override 제거.
- `DESIGN.md` 토큰을 CSS custom properties로 반영.
- 배경, typography, spacing, focus, button, nav 기본 정의.
- 기능 결과가 바뀌지 않는지 확인.

### Phase 2 — SVG와 기본 Category

- 네 개의 모노라인 SVG 제작.
- Category ID → icon 매핑.
- 사용자 Category fallback icon.
- 새 기본색과 제한적인 legacy default-color migration.
- PWA cache에 SVG 등록.

### Phase 3 — 오늘

- 큰 누적 시간과 Active 4 구현.
- idle/running/switch/end 상태.
- 직접 기록, 인사이트, 완료 메모 흐름.
- 1초 render에서 레이아웃과 애니메이션 안정성 확인.

### Phase 4 — 기록

- 요약 지표와 원형 활동 지도.
- 7일/30일, 내부 스크롤, 오늘 ring.
- Category library, 최근 기록, 상세 dialog.

### Phase 5 — 돌아보기와 설정

- 요약/분포/근거 위계.
- AI 버튼과 성공·실패 상태.
- assignment, goal, category, 삭제 복구, USB, export.

### Phase 6 — Dialog·상태·PWA

- 모든 dialog, toast, 완료 prompt 통일.
- 새 SVG precache와 service worker 버전 갱신.
- 오프라인 재방문 확인.

### Phase 7 — QA

- 자동 테스트.
- 접근성, 모바일 폭, 터치, 키보드.
- 승인 시안 대비 시각 검토.

## 12. 검증 매트릭스

### 기능

- 같은 Active 4 버튼: 시작 → 종료.
- 다른 Active 4 버튼: 이전 종료 → 새 기록 시작.
- 화면 카드, 키보드 1–4, `window.habitToy`, Web Serial 입력.
- 수동 기록, 메모 저장/건너뛰기/나중에.
- 기록 수정, 삭제, 30일 복구.
- Category 추가, 이름 변경, 보관, Active 4 교체.
- 7일/30일 통계와 Category 상세.
- 로컬 리플렉션, AI 성공, AI 실패, API 키 없음.
- USB 지원 안 됨, 권한 거절, 연결, 해제, 테스트.
- JSON 내보내기, 데모 초기화.
- 새로고침, 오프라인 재방문, 서버 재동기화.

### 데이터 경계

- 기록 없음.
- 실행 중 기록.
- 1분 미만 기록.
- 자정을 넘는 기록.
- 매우 긴 Category명.
- 사용자 정의색.
- 보관된 Category 기록.
- 최근 기록 0개/1개/8개 이상.
- 30일 활동 지도의 많은 Category.

### 화면

- 320×568
- 375×812
- 390×844
- 430×932
- 720px 셸
- 터치 포인터와 마우스
- reduced motion
- forced colors

## 13. 완료 수용 기준

### 시각

- 페이지 배경이 순백색이고 장식용 그라데이션·글로우·glass 효과가 없다.
- 고채도 색은 Category 아이콘, 진행 표시, 활동 지도에만 사용된다.
- 모든 기본 Activity 아이콘은 같은 stroke와 optical size를 갖는다.
- 그림자는 dialog와 일시적 overlay 외에는 사용하지 않는다.
- 카드가 아닌 여백과 구분선이 화면 구조의 주된 수단이다.
- 오늘·기록·돌아보기·설정이 같은 제품으로 보인다.

### 기능

- 기존 저장 데이터를 손실 없이 불러온다.
- 기존 시작·종료·전환·편집·복구 동작이 동일하다.
- 사용자 지정 Category 색을 임의로 덮어쓰지 않는다.
- 키보드, Web Serial, PWA 오프라인이 유지된다.
- AI 실패가 기록과 로컬 리플렉션을 막지 않는다.

### 품질

- `npm run check`와 `npm test` 통과.
- 320px에서 페이지 가로 스크롤 없음.
- 모든 주요 컨트롤 44×44px 이상.
- 일반 텍스트 WCAG AA 통과.
- reduced-motion에서 반복 모션 없음.
- 1초 타이머 갱신에서 아이콘·레이아웃이 깜빡이지 않음.
- 서비스 워커 업데이트 후 이전 캐시와 충돌하지 않음.

## 14. 구현 시작 전 최종 결정

별도 변경 요청이 없다면 구현은 다음을 기본값으로 한다.

1. 승인된 네 화면의 정보 순서와 A안 아이콘 언어를 사용한다.
2. 기본 Category는 새 고채도 팔레트로 전환한다.
3. 사용자 지정 색은 보존한다.
4. 플랫폼 이모지는 사용하지 않고 로컬 SVG를 제작한다.
5. Active 4는 320–720px에서 2열을 유지한다.
6. 기기 정상 상태는 설정에 두고, 오류만 헤더에 노출한다.
7. AI는 보조 기능으로 표시하고 별도 시각 효과를 사용하지 않는다.
8. 기존 CSS 끝에 override를 추가하지 않고 cascade를 정리한다.
9. 기능 로직 변경과 시각 변경은 검토 가능한 단위로 나눈다.
10. 이 문서 승인 전에는 구현을 시작하지 않는다.
