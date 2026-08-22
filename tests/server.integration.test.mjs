import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { overlapMsForDay } from "../time-utils.mjs";
import { applyActiveAssignments, placeCategoryInSlot } from "../state-utils.mjs";

async function startServer() {
  const dataDirectory = await mkdtemp(join(tmpdir(), "habit-toy-test-"));
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: "0", HABIT_TOY_DATA_DIR: dataDirectory, OPENAI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { errors += chunk; });
  const started = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start. ${errors}`)), 5000);
    const probe = setInterval(() => {
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (!match) return;
      clearTimeout(timer); clearInterval(probe); resolve(Number(match[1]));
    }, 15);
    child.once("exit", (code) => { clearTimeout(timer); clearInterval(probe); reject(new Error(`Server exited early (${code}). ${errors}`)); });
  });
  return {
    baseUrl: `http://localhost:${started}`,
    async stop() {
      if (!child.killed) child.kill();
      await once(child, "exit").catch(() => {});
      await rm(dataDirectory, { recursive: true, force: true });
    },
  };
}

test("Rhythm Hero server preserves beta state and protects API fallbacks", async (t) => {
  const server = await startServer();
  t.after(() => server.stop());

  const shell = await fetch(`${server.baseUrl}/`);
  assert.equal(shell.status, 200);
  const shellText = await shell.text();
  assert.match(shellText, /Rhythm Hero/);
  assert.match(shellText, /<script defer src="app\.js\?v=22"><\/script>/);
  assert.match(shellText, /id="completion-dialog"/);
  assert.match(shellText, /id="post-session-prompt"/);
  assert.match(shellText, /id="memo-inbox"/);

  const browserBundle = await fetch(`${server.baseUrl}/app.js?v=22`);
  assert.equal(browserBundle.status, 200);
  const browserBundleText = await browserBundle.text();
  assert.doesNotMatch(browserBundleText, /^\s*import\s/m, "the direct-open browser bundle must not depend on ES module imports");

  for (const privatePath of ["/server.mjs", "/.env.example", "/README.md", "/tests/server.integration.test.mjs"]) {
    const privateFile = await fetch(`${server.baseUrl}${privatePath}`);
    assert.equal(privateFile.status, 404, `${privatePath} must not be served as a public asset`);
  }

  const moduleAsset = await fetch(`${server.baseUrl}/time-utils.mjs`);
  assert.equal(moduleAsset.status, 200);
  assert.match(moduleAsset.headers.get("content-type") || "", /^text\/javascript/);

  for (const character of ["spike-pink.png", "spike-blue.png"]) {
    const characterAsset = await fetch(`${server.baseUrl}/assets/characters/${character}`);
    assert.equal(characterAsset.status, 200);
    assert.equal(characterAsset.headers.get("content-type"), "image/png");
    const bytes = new Uint8Array(await characterAsset.arrayBuffer());
    assert.deepEqual(Array.from(bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  }

  const clientId = "integrationtestclient01";
  const state = {
    categories: [{ id: "focus", name: "집중", color: "#123456", goal: 30, status: "active" }],
    assignments: ["focus"], sessions: [], activeSession: null, historyRange: 7, aiReflection: null, updatedAt: "2026-08-19T00:00:00.000Z",
  };
  const saved = await fetch(`${server.baseUrl}/api/state/${clientId}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }),
  });
  assert.equal(saved.status, 200);

  const restored = await fetch(`${server.baseUrl}/api/state/${clientId}`);
  assert.equal(restored.status, 200);
  assert.deepEqual((await restored.json()).state, state);

  const missing = await fetch(`${server.baseUrl}/api/state/unknownclient00001`);
  assert.equal(missing.status, 404);

  const invalid = await fetch(`${server.baseUrl}/api/state/${clientId}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: { categories: [] } }),
  });
  assert.equal(invalid.status, 400);

  const noKeyReflection = await fetch(`${server.baseUrl}/api/reflection`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facts: [{ message: "테스트", evidence: "테스트" }] }),
  });
  assert.equal(noKeyReflection.status, 503);
});

test("an overnight session is split at the local day boundary", () => {
  const session = {
    startedAt: new Date(2026, 7, 18, 23, 45).toISOString(),
    endedAt: new Date(2026, 7, 19, 0, 15).toISOString(),
  };
  assert.equal(overlapMsForDay(session, new Date(2026, 7, 18, 12)), 15 * 60_000);
  assert.equal(overlapMsForDay(session, new Date(2026, 7, 19, 12)), 15 * 60_000);
  assert.equal(overlapMsForDay(session, new Date(2026, 7, 20, 12)), 0);
});

test("changing Active 4 preserves every historical Session", () => {
  const original = {
    categories: [
      { id: "move", status: "active" }, { id: "read", status: "active" },
      { id: "music", status: "active" }, { id: "project", status: "active" },
      { id: "english", status: "archived" },
    ],
    assignments: ["move", "read", "music", "project"],
    sessions: [{ id: "session-1", categoryId: "read", startedAt: "2026-08-01T10:00:00.000Z", endedAt: "2026-08-01T11:00:00.000Z", status: "completed" }],
  };
  const nextAssignments = placeCategoryInSlot(original.assignments, 1, "english");
  const updated = applyActiveAssignments(original, nextAssignments);

  assert.deepEqual(updated.assignments, ["move", "english", "music", "project"]);
  assert.deepEqual(updated.sessions, original.sessions);
  assert.equal(updated.categories.find((category) => category.id === "read").status, "active");
  assert.equal(updated.categories.find((category) => category.id === "english").status, "active");
  assert.deepEqual(original.assignments, ["move", "read", "music", "project"]);
});
