// Rhythm Hero firmware for the NUCODE NU-40 DK (nRF52840, 4 buttons, 4 LEDs).
// Protocol: docs/Hardware-Serial-Protocol.md. No external libraries.
//
// Board → app:  BUTTON:n            (n = 1..4, on press)
// App → board:  {"type":"led",...}  brightness per button from "progress"
//               {"type":"nudge","active":true|false}  all LEDs breathe together
//
// Pin numbers: check Tools > Board > NUBoards nRF52 > NU40DK and the board
// guide PDF. Adjust the two arrays below if your board maps them differently.

const uint8_t BUTTON_PINS[4] = {2, 3, 4, 5};
const uint8_t LED_PINS[4] = {13, 14, 15, 16};
const bool BUTTON_ACTIVE_LOW = true;       // INPUT_PULLUP buttons read LOW when pressed
const unsigned long DEBOUNCE_MS = 40;

uint8_t brightness[4] = {0, 0, 0, 0};      // from "led" progress, 0..255
bool running[4] = {false, false, false, false};
bool nudging = false;
bool lastPressed[4] = {false, false, false, false};
unsigned long lastChange[4] = {0, 0, 0, 0};
String line;

void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < 4; i++) {
    pinMode(BUTTON_PINS[i], BUTTON_ACTIVE_LOW ? INPUT_PULLUP : INPUT);
    pinMode(LED_PINS[i], OUTPUT);
    analogWrite(LED_PINS[i], 0);
  }
}

// --- buttons -------------------------------------------------------------

void readButtons() {
  unsigned long now = millis();
  for (uint8_t i = 0; i < 4; i++) {
    bool pressed = digitalRead(BUTTON_PINS[i]) == (BUTTON_ACTIVE_LOW ? LOW : HIGH);
    if (pressed == lastPressed[i] || now - lastChange[i] < DEBOUNCE_MS) continue;
    lastChange[i] = now;
    lastPressed[i] = pressed;
    if (!pressed) continue;
    Serial.print("BUTTON:");
    Serial.println(i + 1);
    nudging = false;                       // a press answers the toy; stop breathing right away
  }
}

// --- serial input --------------------------------------------------------

// Minimal field lookup: enough for the flat JSON the app sends, no library needed.
int findInt(const String &source, const String &key, int fallback) {
  int at = source.indexOf("\"" + key + "\"");
  if (at < 0) return fallback;
  at = source.indexOf(':', at);
  return at < 0 ? fallback : source.substring(at + 1).toInt();
}

float findFloat(const String &source, const String &key, float fallback) {
  int at = source.indexOf("\"" + key + "\"");
  if (at < 0) return fallback;
  at = source.indexOf(':', at);
  return at < 0 ? fallback : source.substring(at + 1).toFloat();
}

bool findBool(const String &source, const String &key, bool fallback) {
  int at = source.indexOf("\"" + key + "\"");
  if (at < 0) return fallback;
  at = source.indexOf(':', at);
  return at < 0 ? fallback : source.substring(at + 1, at + 6).indexOf("true") >= 0;
}

void applyLed(const String &message) {
  // Walk each {"index":n,...} object inside "buttons".
  int cursor = message.indexOf("\"buttons\"");
  while (cursor >= 0) {
    int open = message.indexOf('{', cursor + 1);
    if (open < 0) break;
    int close = message.indexOf('}', open);
    if (close < 0) break;
    String item = message.substring(open, close + 1);
    int index = findInt(item, "index", 0);
    if (index >= 1 && index <= 4) {
      float progress = constrain(findFloat(item, "progress", 0), 0.0f, 1.0f);
      brightness[index - 1] = (uint8_t)(18 + progress * 237);
      running[index - 1] = findBool(item, "running", false);
    }
    cursor = close;
  }
}

void handleLine(const String &message) {
  if (message.startsWith("{\"type\":\"nudge\"")) {
    nudging = findBool(message, "active", false);
  } else if (message.startsWith("{\"type\":\"led\"")) {
    applyLed(message);
  }
}

void readSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      line.trim();
      if (line.length()) handleLine(line);
      line = "";
    } else if (c != '\r' && line.length() < 600) {
      line += c;
    }
  }
}

// --- LEDs ----------------------------------------------------------------

// 0..255 triangle wave with the given period; shared by breathing states.
uint8_t breathe(unsigned long periodMs) {
  unsigned long t = millis() % periodMs;
  float phase = (float)t / periodMs;
  float wave = phase < 0.5f ? phase * 2 : (1 - phase) * 2;
  return (uint8_t)(10 + wave * 200);
}

void renderLeds() {
  if (nudging) {
    uint8_t level = breathe(2000);         // all four together: "I'm here, come play"
    for (uint8_t i = 0; i < 4; i++) analogWrite(LED_PINS[i], level);
    return;
  }
  for (uint8_t i = 0; i < 4; i++) {
    uint8_t level = running[i] ? breathe(1200) : brightness[i];
    analogWrite(LED_PINS[i], level);
  }
}

void loop() {
  readButtons();
  readSerial();
  renderLeds();
  delay(8);
}
