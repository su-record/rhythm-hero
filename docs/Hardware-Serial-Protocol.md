# Rhythm Hero USB Serial Protocol v0.2

이 프로토콜은 해커톤 개발보드와 Habit Toy 웹 앱을 USB Serial로 연결하기 위한 최소 계약이다. 앱은 Chrome에서 `Web Serial`을 사용하며, `http://localhost` 또는 HTTPS에서 실행해야 한다.

## 연결 설정

- Baud rate: `115200`
- Encoding: UTF-8
- Framing: 한 메시지당 한 줄 (`\n`)
- 앱에서 선택하는 포트: 개발보드의 USB CDC/Serial 포트

## 보드 → 앱: 버튼 입력

가장 간단한 형식:

```text
BUTTON:1
```

권장 JSON 형식:

```json
{"type":"button","index":1,"eventId":"device-001","pressedAt":"2026-08-19T12:04:22Z"}
```

- `index`: 1~4의 정수
- 앱은 `BUTTON:1` 또는 JSON `type: button`을 모두 수신한다.
- 앱은 현재 실행 중인 버튼과 같은 번호면 종료, 다른 번호면 기존 기록 종료 후 새 기록 시작으로 처리한다.

## 앱 → 보드: LED 상태

앱은 기록이 시작·종료되거나 목표 진행률이 바뀔 때 다음 형식으로 보낸다.

```json
{
  "type": "led",
  "buttons": [
    { "index": 1, "color": "#F28B73", "progress": 0.58, "running": false },
    { "index": 2, "color": "#7A9BEF", "progress": 0.70, "running": true }
  ]
}
```

- `color`: 6자리 HEX 색상
- `progress`: `0`~`1` 범위의 목표 대비 진행률
- `running`: 현재 활동 중이면 `true`; 이 경우 버튼 LED를 부드럽게 점멸한다.

## 앱 → 보드: 장난감 발화 (v0.2)

기록이 없는 시간이 길어지면 앱의 캐릭터가 말을 걸고, 동시에 보드에 다음을 보낸다.

```json
{"type":"nudge","active":true}
```

- `active: true`: 버튼을 누르기 전까지 **LED 4개가 천천히 함께 숨을 쉰다** (약 2초 주기). 진행률 표시보다 우선한다.
- `active: false`: 숨쉬기를 멈추고 마지막 `led` 상태로 돌아간다.
- 보드에서 버튼이 눌리면 펌웨어는 `nudge`를 스스로 해제해도 된다. 앱도 기록이 시작되면 `active: false`를 보낸다.

NU-40 DK는 단색 LED 4개라 `led.color`는 무시하고 `progress`만 밝기로 쓴다. 부저·진동 없이 LED 숨쉬기 하나로 "나 여기 있어"를 표현한다.

## 펌웨어 처리 의사코드

```text
onButtonPressed(buttonIndex):
  serial.println(JSON.stringify({ type: "button", index: buttonIndex }))

onSerialLine(line):
  if line.type == "led":
    for each button in line.buttons:
      setButtonColor(button.index, hexToRgb(button.color))
      setButtonBrightness(button.index, map(button.progress, 0..1, 18..255))
      setButtonBreathing(button.index, button.running)
  if line.type == "nudge":
    nudging = line.active        # true: 4개 LED 동시 숨쉬기, false: led 상태로 복귀
```

NU-40 DK용 실제 스케치는 [`firmware/nu40-rhythm-hero/nu40-rhythm-hero.ino`](firmware/nu40-rhythm-hero/nu40-rhythm-hero.ino)에 있다. 외부 라이브러리 없이 동작한다.

## 테스트

1. `npm start`로 앱을 연다.
2. 우측 상단 기기 상태 또는 설정의 `USB 연결`을 누른다.
3. 개발보드 포트를 선택한다.
4. Serial Monitor가 아닌 실제 보드에서 `BUTTON:1\n`을 전송한다.
5. 앱의 1번 Category 타이머와 LED 상태 전송을 확인한다.

핀 번호는 NUBoards nRF52 보드 패키지의 `NU40DK nRF52840` 정의를 따른다. 스케치 상단 상수만 보드 실물에 맞춰 바꾸면 된다.
