import test from "node:test";
import assert from "node:assert/strict";

import { REFLECTION_RULES, createReflectionFingerprint, getReflectionReport } from "../../src/domain/reflection.ts";
import type { AppState, Session } from "../../src/domain/types.ts";

function daysAgoAt(days: number, hour: number, minute: number, durationMinutes: number): { startedAt: string; endedAt: string } {
  const start = new Date();
  start.setHours(hour, minute, 0, 0);
  start.setDate(start.getDate() - days);
  return { startedAt: start.toISOString(), endedAt: new Date(start.getTime() + durationMinutes * 60_000).toISOString() };
}

function session(id: string, categoryId: string, days: number, hour: number, minutes: number): Session {
  return { id, categoryId, ...daysAgoAt(days, hour, 0, minutes), source: "device", status: "completed" };
}

function stateWith(sessions: Session[]): AppState {
  return {
    profile: null,
    companion: { voice: true, idleMinutes: 90 },
    categories: [
      { id: "read", name: "독서", color: "#20D68A", goal: 60, status: "active" },
      { id: "move", name: "운동", color: "#FF5D52", goal: 60, status: "active" },
    ],
    assignments: ["read", "move"],
    sessions,
    activeSession: null,
    historyRange: 7,
    reflectionRange: 7,
    aiReflection: null,
    updatedAt: new Date().toISOString(),
  };
}

test("every rule produces exactly one card, in a stable order", () => {
  const report = getReflectionReport(stateWith([]));
  assert.equal(report.facts.length, REFLECTION_RULES.length);
  assert.deepEqual(report.facts.map((fact) => fact.key), ["comparison", "top-share", "rhythm"]);
});

test("an empty period marks every card insufficient instead of inventing numbers", () => {
  const report = getReflectionReport(stateWith([]));
  assert.ok(report.facts.every((fact) => fact.insufficient === true));
  assert.match(report.facts[0]?.message ?? "", /완료된 기록이 없어/);
  assert.equal(report.current.totalMinutes, 0);
});

test("the top-share card reports the leading activity and its percentage", () => {
  const report = getReflectionReport(stateWith([
    session("a", "read", 1, 9, 90),
    session("b", "move", 2, 9, 30),
  ]));
  const share = report.facts.find((fact) => fact.key === "top-share");

  assert.equal(share?.insufficient, undefined);
  assert.match(share?.message ?? "", /독서/);
  assert.match(share?.message ?? "", /75%/);
  assert.deepEqual(share?.evidenceItems.map((item) => item.label), ["활동", "시간", "비율"]);
});

test("the rhythm card waits for three completed records", () => {
  const two = getReflectionReport(stateWith([session("a", "read", 1, 9, 30), session("b", "read", 2, 9, 30)]));
  const rhythmOfTwo = two.facts.find((fact) => fact.key === "rhythm");
  assert.equal(rhythmOfTwo?.insufficient, true);
  assert.match(rhythmOfTwo?.message ?? "", /1개 더 필요해요/);

  const three = getReflectionReport(stateWith([
    session("a", "read", 1, 9, 30),
    session("b", "read", 2, 9, 30),
    session("c", "read", 3, 9, 30),
  ]));
  const rhythmOfThree = three.facts.find((fact) => fact.key === "rhythm");
  assert.equal(rhythmOfThree?.insufficient, undefined);
  assert.match(rhythmOfThree?.message ?? "", /오전/);
  assert.equal(rhythmOfThree?.evidenceItems.length, 4, "all four time bands stay visible as evidence");
});

test("a tie across time bands is reported as an even spread, not a false winner", () => {
  const report = getReflectionReport(stateWith([
    session("a", "read", 1, 3, 30),
    session("b", "read", 2, 9, 30),
    session("c", "read", 3, 14, 30),
  ]));
  assert.match(report.facts.find((fact) => fact.key === "rhythm")?.message ?? "", /고르게 나타났어요/);
});

test("the fingerprint is stable for equal facts and changes when they differ", () => {
  const first = getReflectionReport(stateWith([session("a", "read", 1, 9, 30)]));
  const same = createReflectionFingerprint(first.facts);
  const different = getReflectionReport(stateWith([session("a", "read", 1, 9, 30), session("b", "move", 2, 9, 90)]));

  assert.equal(first.fingerprint, same);
  assert.notEqual(first.fingerprint, different.fingerprint);
  assert.match(first.fingerprint, /^reflection-v1-/);
});

test("a 30 day range widens the window and keeps the two periods adjacent", () => {
  const report = getReflectionReport({ ...stateWith([]), reflectionRange: 30 });
  assert.equal(report.range, 30);
  assert.equal(report.current.bounds.start.getTime(), report.previous.bounds.end.getTime());
  assert.match(report.periodLabel, /30일$/);
});
