import test from "node:test";
import assert from "node:assert/strict";

import { buildLedPayload, parseHardwareLine } from "../../src/device/protocol.ts";
import type { AppState } from "../../src/domain/types.ts";

test("shorthand button lines are accepted in the forms a board actually sends", () => {
  assert.equal(parseHardwareLine("BUTTON:1"), 1);
  assert.equal(parseHardwareLine("BUTTON:4\r"), 4);
  assert.equal(parseHardwareLine("  button : 2  "), 2);
  assert.equal(parseHardwareLine("Button:3"), 3);
});

test("JSON button events are accepted", () => {
  assert.equal(parseHardwareLine('{"type":"button","index":2}'), 2);
  assert.equal(parseHardwareLine('{"type":"button","index":"3"}'), 3, "a numeric string still identifies a button");
});

test("anything outside the contract is rejected rather than guessed", () => {
  for (const line of ["", "   ", "BUTTON:0", "BUTTON:5", "BUTTON:x", "boot ok", "{", '{"type":"led"}', '{"type":"button","index":9}']) {
    assert.equal(parseHardwareLine(line), null, `${JSON.stringify(line)} must not press a button`);
  }
});

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    companion: { voice: true, idleMinutes: 90 },
    categories: [
      { id: "read", name: "독서", color: "#20D68A", goal: 60, status: "active" },
      { id: "move", name: "운동", color: "not-a-colour", goal: 0, status: "active" },
    ],
    assignments: ["read", "move"],
    sessions: [],
    activeSession: null,
    historyRange: 7,
    reflectionRange: 7,
    aiReflection: null,
    updatedAt: "2026-08-21T00:00:00.000Z",
    ...overrides,
  };
}

test("the LED payload carries one entry per button, numbered from one", () => {
  const payload = buildLedPayload(state());
  assert.equal(payload.type, "led");
  assert.deepEqual(payload.buttons.map((button) => button.index), [1, 2]);
});

test("an invalid colour is replaced so the board never receives garbage", () => {
  const payload = buildLedPayload(state());
  assert.match(payload.buttons[1]?.color ?? "", /^#[0-9A-Fa-f]{6}$/);
});

test("progress is clamped and the running button is flagged", () => {
  const running = state({
    activeSession: { id: "s", categoryId: "read", startedAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(), source: "device", status: "running" },
  });
  const payload = buildLedPayload(running);

  assert.equal(payload.buttons[0]?.running, true);
  assert.equal(payload.buttons[1]?.running, false);
  assert.equal(payload.buttons[0]?.progress, 1, "three hours against a one hour goal still reports a full ring");
});

test("the payload is stable for unchanged state, which is what suppresses duplicate writes", () => {
  const first = JSON.stringify(buildLedPayload(state()));
  const second = JSON.stringify(buildLedPayload(state()));
  assert.equal(first, second);
});
