import test from "node:test";
import assert from "node:assert/strict";

import { requestCompanionLine } from "../../src/sync/companionApi.ts";
import { DEFAULT_COMPANION, checkIdle, nudgeFacts } from "../../src/domain/idle.ts";
import type { AppState } from "../../src/domain/types.ts";

function stubFetch(handler: (url: string, init?: RequestInit) => Response): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(input), init))) as typeof fetch;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const state: AppState = {
  profile: { name: "수", toy: "spike", toyName: "뾰족", createdAt: "2026-08-22T00:00:00.000Z" },
  companion: { ...DEFAULT_COMPANION },
  categories: [
    { id: "read", name: "독서", color: "#20D68A", goal: 60, status: "active" },
    { id: "move", name: "운동", color: "#FF5D52", goal: 20, status: "active" },
  ],
  assignments: ["read", "move"],
  sessions: [],
  activeSession: null,
  historyRange: 7, reflectionRange: 7, aiReflection: null, updatedAt: "2026-08-22T00:00:00.000Z",
};
const facts = nudgeFacts(state, checkIdle(state, DEFAULT_COMPANION, new Date(2026, 7, 22, 15)), new Date(2026, 7, 22, 15))!;

test("the facts carry names, time band and a concrete small ask, nothing else", () => {
  assert.deepEqual(facts, {
    toyName: "뾰족", userName: "수", timeBand: "afternoon", lastActivity: null, quietMinutes: null, suggestion: "독서", suggestMinutes: 15,
  });
});

test("a sound model line is used", async () => {
  let sent = "";
  const result = await requestCompanionLine(facts, stubFetch((_url, init) => { sent = String(init?.body); return json({ line: "수야, 나 심심해. 독서 15분만 같이 하자." }); }));
  assert.deepEqual(result, { kind: "created", line: "수야, 나 심심해. 독서 15분만 같이 하자." });
  assert.deepEqual(Object.keys(JSON.parse(sent).facts).sort(), Object.keys(facts).sort(), "only the facts leave the browser");
});

test("a scolding, empty or overlong line is refused so the template speaks instead", async () => {
  for (const line of ["왜 아무것도 안 해?", "", "가".repeat(61), "실패했네"]) {
    const result = await requestCompanionLine(facts, stubFetch(() => json({ line })));
    assert.equal(result.kind, "unavailable", `"${line.slice(0, 12)}" must not reach the user`);
  }
});

test("no key, server error or network failure all degrade quietly", async () => {
  assert.equal((await requestCompanionLine(facts, stubFetch(() => json({ error: "OPENAI_API_KEY is not configured" }, 503)))).kind, "unavailable");
  assert.equal((await requestCompanionLine(facts, stubFetch(() => json({ error: "boom" }, 500)))).kind, "unavailable");
  const offline = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
  assert.equal((await requestCompanionLine(facts, offline)).kind, "unavailable");
});
