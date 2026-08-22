---
version: alpha
name: "White Canvas, Vivid Rituals"
description: "Rhythm Hero를 위한 흰 캔버스, 검정 정보 구조, 고채도 활동 픽토그램 기반의 미니멀 웰니스 디자인 시스템"
colors:
  primary: "#111111"
  on-primary: "#FFFFFF"
  canvas: "#FFFFFF"
  surface: "#FFFFFF"
  surface-subtle: "#F6F6F3"
  text-primary: "#111111"
  text-secondary: "#6F6F69"
  line: "#E6E6E1"
  exercise: "#FF5D52"
  reading: "#20D68A"
  music: "#5B70FF"
  project: "#FFD43B"
  danger: "#C83D4A"
typography:
  display-time:
    fontFamily: "Pretendard, SUIT, system-ui, sans-serif"
    fontSize: 72px
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: -0.06em
  headline-lg:
    fontFamily: "Pretendard, SUIT, system-ui, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -0.04em
  headline-md:
    fontFamily: "Pretendard, SUIT, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.025em
  body-md:
    fontFamily: "Pretendard, SUIT, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Pretendard, SUIT, system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: "Pretendard, SUIT, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.01em
  metric-md:
    fontFamily: "Pretendard, SUIT, system-ui, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.035em
rounded:
  none: 0px
  sm: 10px
  md: 14px
  lg: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  page-gutter: 24px
components:
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    padding: "{spacing.page-gutter}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-subtle:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 48px
  button-secondary:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 48px
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.danger}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 48px
  category-exercise:
    backgroundColor: "{colors.exercise}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    size: 44px
  category-reading:
    backgroundColor: "{colors.reading}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    size: 44px
  category-music:
    backgroundColor: "{colors.music}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    size: 44px
  category-project:
    backgroundColor: "{colors.project}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    size: 44px
  label-muted:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-sm}"
  divider:
    backgroundColor: "{colors.line}"
    height: 1px
  navigation-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    height: 40px
---

# Rhythm Hero Design System

## Overview

Rhythm Hero는 시간을 평가하거나 성취를 압박하는 앱이 아니라, 사용자가 중요하게 여기는 네 가지 활동의 리듬을 가볍게 기록하고 돌아보게 하는 미니멀 웰니스 도구다.

디자인 콘셉트는 **White Canvas, Vivid Rituals**다. 화면 대부분은 흰색, 검정, 회색으로 조용하게 유지하고, 운동·독서·음악·프로젝트를 나타내는 작은 픽토그램만 선명한 색으로 표현한다. 결과는 차갑거나 임상적으로 보이지 않아야 하며, 명료하고 침착한 구조 안에 약간의 손맛과 생동감이 있어야 한다.

이 문서는 현재 시각 디자인의 단일 기준이다. `DESIGN-RENEWAL-PLAN.md`에 기록된 크림 배경, 라임 패널, 대형 캐릭터 중심 방향은 과거 탐색안으로 보존하되 현재 디자인 결정에는 적용하지 않는다. 기능 동작과 데이터 보존 원칙은 기존 제품 문서와 현재 구현을 계속 따른다.

핵심 인상:

- quiet, clear, vivid, tactile
- 웰니스 앱의 안정감과 기록 도구의 정확성
- 한눈에 알아보는 네 가지 활동
- 생성형 AI 서비스보다 작은 생활 도구에 가까운 인상

## Colors

페이지 배경은 항상 순백색 `canvas`다. `surface-subtle`은 입력 영역, 선택되지 않은 컨트롤, 아주 약한 섹션 구분에만 사용한다. 카드마다 다른 연한 배경을 붙여 화면을 파스텔 모자이크로 만들지 않는다.

색상 역할:

- **Primary / Text (`#111111`)**: 제목, 본문, 외곽선, 주요 버튼, 아이콘 선.
- **Secondary text (`#6F6F69`)**: 설명, 날짜, 메타데이터. 작은 본문에서도 흰 배경과 충분한 대비를 유지한다.
- **Line (`#E6E6E1`)**: 목록과 카드의 조용한 구분선.
- **Exercise (`#FF5D52`)**: 운동화 또는 움직임 픽토그램.
- **Reading (`#20D68A`)**: 펼친 책 픽토그램.
- **Music (`#5B70FF`)**: 음표 또는 헤드폰 픽토그램.
- **Project (`#FFD43B`)**: 체크리스트, 도구 또는 네 칸 그리드 픽토그램.
- **Danger (`#C83D4A`)**: 삭제와 복구 불가능한 위험 동작에만 사용.

카테고리 색은 넓은 페이지 배경이나 일반 버튼에 사용하지 않는다. 아이콘의 채움, 진행 표시, 선택 상태, 달력의 활동 표시에 집중한다. 각 컴포넌트는 동시에 하나의 카테고리 색만 강조한다.

사용자 정의 Category가 추가될 수 있으므로 네 기본색 외 색상도 허용한다. 추가 색상은 흰 배경에서 명확히 보이고 검정 아이콘 선과 구분되어야 하며, 기본 네 색과 비슷한 채도와 밝기 범위에 맞춘다.

## Typography

한글 가독성과 오프라인 안정성을 위해 Pretendard, SUIT, 시스템 산세리프 순서의 단일 폰트 스택을 사용한다. 별도 장식 폰트나 손글씨 폰트를 섞지 않는다. 개성은 폰트 종류가 아니라 숫자의 크기, 여백, 픽토그램에서 만든다.

- 오늘 누적 시간과 실행 타이머는 `display-time`을 사용하며 화면에서 가장 강한 정보다.
- 화면 제목은 `headline-lg`, 카드와 섹션 제목은 `headline-md`를 사용한다.
- 본문은 `body-md`, 보조 설명은 `body-sm`, 짧은 상태와 메타데이터는 `label-sm`을 사용한다.
- 시간과 통계 숫자는 tabular numerals를 사용해 값이 변해도 폭이 흔들리지 않게 한다.
- 한 화면에서 400과 700을 주된 굵기로 사용하며, 작은 라벨에만 600을 허용한다.
- 영문과 한국어를 장식적으로 혼용하지 않는다. 고유 기능명이 아니면 직접적인 한국어를 우선한다.

## Layout

모바일 우선 단일 열 구조를 사용하고 앱 셸의 최대 폭은 720px를 유지한다. 기본 좌우 여백은 24px이며, 359px 이하에서는 16px까지 줄일 수 있다.

간격은 8px 리듬을 기본으로 하고 4px은 아이콘 내부나 미세 조정에만 사용한다. 관련 정보는 가까이, 다른 섹션은 충분히 떨어뜨린다. 카드 테두리를 추가하기 전에 여백만으로 그룹을 구분할 수 있는지 먼저 판단한다.

화면별 기본 구조:

- **오늘**: 최소 헤더 → 큰 누적 시간 → Active 4의 2×2 위젯 → 직접 기록 → 한 줄 인사이트.
- **기록**: 기간 선택 → 핵심 숫자 → 날짜 원형 지도 → 최근 기록 목록.
- **돌아보기**: 기간과 한 문장 인사이트 → 근거 지표 → Category 분포.
- **설정**: 카드 모음이 아닌 제목과 구분선 중심의 기능 목록.

Active 4는 360px 이상에서 2열을 유지한다. 카드 안에서는 픽토그램, 카테고리명, 누적 시간, 진행 정보 순으로 읽혀야 한다. 픽토그램을 크게 만들기 위해 텍스트가 잘리거나 터치 영역이 줄어들어서는 안 된다.

모든 터치 컨트롤은 최소 44×44px이다. 하단 내비게이션과 다이얼로그는 기기의 safe area를 존중한다.

## Elevation & Depth

기본 화면에는 그림자를 사용하지 않는다. 깊이는 흰색과 `surface-subtle`의 미세한 톤 차이, 1px 구분선, 여백, 픽토그램의 검정 외곽선으로 표현한다.

다이얼로그와 화면 위에 떠야 하는 완료 알림에만 낮은 투명도의 부드러운 그림자를 허용한다. 카드 hover에서 큰 상승이나 빛 번짐을 만들지 않는다. 눌림 피드백은 1~2px 이동과 짧은 축소만 사용한다.

유리 효과, 배경 흐림을 강조한 글래스모피즘, 네온 글로우, 그라데이션은 사용하지 않는다.

## Shapes

형태는 부드럽지만 지나치게 말랑하거나 장난감처럼 보이지 않아야 한다.

- 핵심 위젯과 다이얼로그: 20px radius.
- 버튼과 입력: 14px radius.
- 작은 아이콘 타일: 10~14px radius.
- 상태 점, 날짜 원, 진행 점: 완전한 원형.
- 동일한 화면에서 세 종류보다 많은 radius를 사용하지 않는다.

픽토그램은 A안의 **friendly monoline sticker** 방향을 따른다.

- 검정 1.5~2px 외곽선.
- 아이콘당 하나의 고채도 채움색.
- 32~44px에서도 즉시 구별되는 실루엣.
- 약간의 손그림 감각은 허용하지만 선 굵기와 시각적 크기는 통일.
- 표정과 캐릭터화는 기본 활동 아이콘에 사용하지 않음.
- 운동의 짧은 속도선처럼 의미를 돕는 장식은 최대 두세 개만 허용.
- 플랫폼 기본 이모지는 탐색용 임시 시안에만 사용하고 제품 아이콘으로 사용하지 않음.

## Components

### Active 4 category card

카드는 흰색 표면을 유지한다. 상단 또는 좌측에 44px 내외의 컬러 픽토그램을 배치하고, 이름과 시간은 검정으로 표시한다. 색을 카드 전체에 채우지 않는다.

- 기본: 흰 배경, 옅은 구분선, 컬러 픽토그램.
- hover: 구분선이 조금 진해짐.
- pressed: 80~120ms 동안 1~2px 아래로 이동하고 약간 축소.
- running: 해당 Category색의 얇은 외곽선 또는 6~8% 틴트와 `기록 중` 텍스트를 함께 사용.
- completed/goal: 색만 바꾸지 않고 체크 형태 또는 명시적 텍스트를 추가.

### Buttons

한 화면의 가장 중요한 행동 하나만 검정 배경의 primary 버튼을 사용한다. 보조 행동은 연한 회색 면 또는 텍스트 버튼을 사용한다. Category색 버튼을 일반 CTA로 사용하지 않는다.

위험 동작은 빨간 텍스트와 명시적인 동사로 구분한다. 브랜드 코랄과 danger 빨강의 의미가 섞이지 않도록 운동색으로 삭제를 표현하지 않는다.

### Calendar and history

날짜는 검정 외곽선의 작은 원으로 표현한다. 기록이 있는 날짜는 Category색을 채우고, 여러 활동이 있으면 내부의 작은 점이나 분할 표시를 사용한다. 기록 여부를 색 하나에만 의존하지 않는다.

최근 기록은 카드 여러 개보다 구분선이 있는 단일 목록을 우선한다. 각 행에는 활동 픽토그램, Category명, 날짜/메모, 시간이 들어간다.

### Reflection

리플렉션은 여러 AI 카드보다 한 개의 명확한 관찰 문장과 근거 숫자를 우선한다. `AI 리플렉션 만들기`는 작은 보조 동작으로 유지하고, 마법봉·반짝이·그라데이션으로 강조하지 않는다.

카피는 평가하거나 지시하지 않는다. “실패”, “밀림”, “더 해야 함”보다 실제로 기록된 패턴을 중립적으로 설명한다.

### Navigation

하단 내비게이션은 동일한 선 굵기의 네 픽토그램과 한국어 레이블을 함께 사용한다. 비활성 상태는 회색 또는 검정 외곽선, 활성 상태는 검정 채움이나 작은 Category와 무관한 단일 표시를 사용한다. 메뉴마다 서로 다른 장식색을 부여하지 않는다.

### Dialogs and feedback

다이얼로그는 흰 배경, 명확한 제목, 최소한의 설명, 하나의 primary 행동을 갖는다. 기록 완료 피드백은 짧고 사실적으로 표현한다. 반복되는 캐릭터, 색종이, 트로피, 점수 보상은 사용하지 않는다.

모션은 120~220ms 범위의 opacity와 transform 중심으로 사용한다. 기록 중 표시 외에는 계속 반복되는 애니메이션을 사용하지 않으며 `prefers-reduced-motion`에서는 상태 이해를 유지한 채 움직임을 제거한다.

## Do's and Don'ts

### Do

- 순백색 배경과 검정 정보 구조를 디자인의 기본값으로 사용한다.
- 고채도 색은 활동의 정체성과 현재 상태를 설명할 때만 사용한다.
- 아이콘과 텍스트를 함께 제공해 색을 구분하지 못해도 기능을 이해할 수 있게 한다.
- 여백, 타이포 크기, 정렬로 먼저 위계를 만든다.
- 한 화면에서 가장 중요한 숫자나 행동을 하나만 강하게 강조한다.
- 실제 데이터와 기능을 시각적 장식보다 우선한다.
- 모든 일반 텍스트 조합은 WCAG AA 대비를 만족시킨다.
- 320px, 390px, 720px 폭에서 정보가 잘리지 않는지 확인한다.

### Don't

- 파스텔 컬러를 여러 카드의 장식 배경으로 반복하지 않는다.
- 그라데이션, 네온 글로우, 유리 효과, 큰 장식용 블러를 사용하지 않는다.
- 모든 섹션을 둥근 카드로 감싸지 않는다.
- 활동 아이콘에 얼굴을 붙이거나 아동용 캐릭터처럼 표현하지 않는다.
- 플랫폼마다 모양이 달라지는 기본 이모지를 최종 에셋으로 사용하지 않는다.
- 반짝이 아이콘이나 `AI` 배지로 리플렉션을 과장하지 않는다.
- 색상만으로 기록 중, 완료, 오류, 선택 상태를 전달하지 않는다.
- 기존 기능, 저장 데이터, Category 의미를 시각적 편의를 위해 변경하지 않는다.
