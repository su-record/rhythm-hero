import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { overlapMsForDay } from "../src/domain/time.ts";
import { applyActiveAssignments, placeCategoryInSlot } from "../src/domain/state.ts";

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
  assert.match(shellText, /<div id="root"><\/div>/, "the React shell must expose its mount point");
  assert.match(shellText, /<link rel="manifest" href="\.\/manifest\.webmanifest" \/>/);
  assert.match(shellText, /<link rel="apple-touch-icon" href="\.\/assets\/icons\/apple-touch-icon-180\.png" \/>/);
  assert.match(shellText, /<script defer src="\.\/app\.js"><\/script>/, "file:// cannot load module scripts, so the entry must stay a deferred classic script");
  assert.doesNotMatch(shellText, /type="module"/, "a module entry would break direct-open from disk");
  assert.doesNotMatch(shellText, /crossorigin/, "crossorigin on a file:// page blocks the bundle");

  const browserBundle = await fetch(`${server.baseUrl}/app.js`);
  assert.equal(browserBundle.status, 200);
  const browserBundleText = await browserBundle.text();
  assert.doesNotMatch(browserBundleText, /^\s*import\s/m, "the direct-open browser bundle must not depend on ES module imports");
  assert.doesNotMatch(browserBundleText, /^\s*export\s/m, "an iife bundle must not emit module exports");

  const privatePaths = [
    "/server.mjs", "/.env.example", "/README.md", "/tests/server.integration.test.mjs",
    "/src/main.tsx", "/src/App.tsx", "/vite.config.ts", "/package.json",
  ];
  for (const privatePath of privatePaths) {
    const privateFile = await fetch(`${server.baseUrl}${privatePath}`);
    assert.equal(privateFile.status, 404, `${privatePath} must not be served as a public asset`);
  }

  const stylesheet = await fetch(`${server.baseUrl}/styles.css`);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get("content-type") || "", /^text\/css/);

  for (const character of ["spike-pink.png", "spike-blue.png"]) {
    const characterAsset = await fetch(`${server.baseUrl}/assets/characters/${character}`);
    assert.equal(characterAsset.status, 200);
    assert.equal(characterAsset.headers.get("content-type"), "image/png");
    const bytes = new Uint8Array(await characterAsset.arrayBuffer());
    assert.deepEqual(Array.from(bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  }

  const manifestResponse = await fetch(`${server.baseUrl}/manifest.webmanifest`);
  assert.equal(manifestResponse.status, 200);
  assert.match(manifestResponse.headers.get("content-type") || "", /^application\/manifest\+json/);
  const manifest = await manifestResponse.json();
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"), "an installable manifest needs a 192px icon");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"), "an installable manifest needs a 512px icon");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"), "Android needs a maskable icon to avoid a letterboxed launcher badge");

  for (const icon of [...manifest.icons.map((entry) => entry.src), "assets/icons/apple-touch-icon-180.png"]) {
    const iconResponse = await fetch(`${server.baseUrl}/${icon}`);
    assert.equal(iconResponse.status, 200, `${icon} must be served`);
    assert.equal(iconResponse.headers.get("content-type"), "image/png");
    const bytes = new Uint8Array(await iconResponse.arrayBuffer());
    assert.deepEqual(Array.from(bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10], `${icon} must be a real PNG`);
  }

  const workerScript = await fetch(`${server.baseUrl}/sw.js`);
  assert.equal(workerScript.status, 200);
  const workerText = await workerScript.text();
  assert.doesNotMatch(workerText, /"\.\/[^"]*\?v=/, "cached asset paths must not carry hand-synced query strings");
  assert.match(workerText, /assets\/icons\/icon-192\.png/, "icons must be precached for offline installs");

  const companionNoKey = await fetch(`${server.baseUrl}/api/companion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facts: { toyName: "뾰족", userName: "수", timeBand: "afternoon", lastActivity: null, quietMinutes: null, suggestion: "독서", suggestMinutes: 15 } }) });
  assert.equal(companionNoKey.status, 503, "without a key the toy falls back to its template lines");
  assert.equal((await companionNoKey.json()).error, "OPENAI_API_KEY is not configured");

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
