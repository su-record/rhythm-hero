import test from "node:test";
import assert from "node:assert/strict";

import { fetchRemoteState, putRemoteState } from "../../src/sync/client.ts";
import { requestAiReflection } from "../../src/sync/reflectionApi.ts";
import { getReflectionReport } from "../../src/domain/reflection.ts";
import type { AppState } from "../../src/domain/types.ts";

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(handler(String(input), init))) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const sampleState: AppState = {
  companion: { voice: true, idleMinutes: 90 },
  categories: [{ id: "read", name: "독서", color: "#20D68A", goal: 60, status: "active" }],
  assignments: ["read"],
  sessions: [],
  activeSession: null,
  historyRange: 7,
  reflectionRange: 7,
  aiReflection: null,
  updatedAt: "2026-08-21T00:00:00.000Z",
};

test("a stored state comes back as found", async () => {
  const result = await fetchRemoteState("client-1", stubFetch(() => jsonResponse({ state: sampleState })));
  assert.equal(result.kind, "found");
  assert.equal(result.kind === "found" && result.state.categories[0]?.id, "read");
});

test("404 means never synced, not a failure", async () => {
  const result = await fetchRemoteState("client-1", stubFetch(() => jsonResponse({ error: "No saved state" }, 404)));
  assert.equal(result.kind, "missing", "only this case may push local state up");
});

test("a server error and a network error are both reported as errors", async () => {
  const serverError = await fetchRemoteState("client-1", stubFetch(() => jsonResponse({ error: "boom" }, 500)));
  assert.equal(serverError.kind, "error");

  const offline = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
  assert.equal((await fetchRemoteState("client-1", offline)).kind, "error");
});

test("an empty remote payload is treated as missing, not as a wipe", async () => {
  const result = await fetchRemoteState("client-1", stubFetch(() => jsonResponse({ state: { categories: [] } })));
  assert.equal(result.kind, "missing", "an empty remote state must never overwrite local records");
});

test("pushing state sends a PUT and reports failures without throwing", async () => {
  let seenMethod = "";
  let seenBody = "";
  const ok = await putRemoteState("client-1", sampleState, stubFetch((url, init) => {
    assert.equal(url, "/api/state/client-1");
    seenMethod = String(init?.method);
    seenBody = String(init?.body);
    return jsonResponse({ savedAt: "2026-08-21T00:00:01.000Z" });
  }));

  assert.equal(ok, true);
  assert.equal(seenMethod, "PUT");
  assert.match(seenBody, /"categories"/);

  const rejected = (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
  assert.equal(await putRemoteState("client-1", sampleState, rejected), false);
});

test("an AI headline is accepted only when it maps back to a supplied fact", async () => {
  const report = getReflectionReport(sampleState);
  const created = await requestAiReflection(report, stubFetch(() => jsonResponse({ headline: "조용한 한 주였어요", factIndex: 1 })));

  assert.equal(created.kind, "created");
  assert.equal(created.kind === "created" && created.reflection.factSnapshot.key, report.facts[1]?.key);
  assert.equal(created.kind === "created" && created.reflection.factSnapshot.fingerprint, report.fingerprint);
});

test("an out-of-range factIndex is rejected instead of stored", async () => {
  const report = getReflectionReport(sampleState);
  const result = await requestAiReflection(report, stubFetch(() => jsonResponse({ headline: "무엇이든", factIndex: 99 })));
  assert.equal(result.kind, "failed");
});

test("a missing API key is distinguished from a generic failure", async () => {
  const report = getReflectionReport(sampleState);
  const missing = await requestAiReflection(report, stubFetch(() => jsonResponse({ error: "OPENAI_API_KEY is not configured" }, 503)));
  assert.equal(missing.kind, "missing-key");

  const failed = await requestAiReflection(report, stubFetch(() => jsonResponse({ error: "Reflection API request failed" }, 502)));
  assert.equal(failed.kind, "failed");
});

test("only messages and evidence leave the browser", async () => {
  const report = getReflectionReport(sampleState);
  let sent = "";
  await requestAiReflection(report, stubFetch((_url, init) => {
    sent = String(init?.body);
    return jsonResponse({ headline: "조용한 한 주였어요", factIndex: 0 });
  }));
  const payload = JSON.parse(sent) as { facts: Array<Record<string, unknown>> };

  assert.deepEqual(Object.keys(payload.facts[0] ?? {}).sort(), ["evidence", "message"]);
});
