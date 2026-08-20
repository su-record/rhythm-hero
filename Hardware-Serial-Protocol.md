# Habit Toy USB Serial Protocol v0.1

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
```

## 테스트

1. `npm start`로 앱을 연다.
2. 우측 상단 기기 상태 또는 설정의 `USB 연결`을 누른다.
3. 개발보드 포트를 선택한다.
4. Serial Monitor가 아닌 실제 보드에서 `BUTTON:1\n`을 전송한다.
5. 앱의 1번 Category 타이머와 LED 상태 전송을 확인한다.

보드별 핀 배치, LED 드라이버, 버튼 디바운싱은 NUCODE 보드의 실제 SDK와 배선이 결정된 뒤 이 프로토콜에 맞춰 구현한다.
