import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { posix, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const run = promisify(execFile);
const root = process.cwd();
const clientRoot = resolve(root, "dist", "client");

async function buildAssetPaths(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const child = resolve(directory, entry.name);
    if (entry.isDirectory()) return buildAssetPaths(child, posix.join(prefix, entry.name));
    return [posix.join("/", prefix, entry.name)];
  }));
  return nested.flat();
}

test("the public mockup Worker ships every build asset without a hand-written list", async () => {
  await run(process.execPath, ["scripts/build-public-mockup.mjs"], { cwd: root });
  const worker = await readFile(resolve(root, "dist", "server", "index.js"), "utf8");
  const expected = await buildAssetPaths(clientRoot);

  assert.ok(expected.length >= 10, "the build output should contain the shell, bundle, styles and icons");
  for (const pathname of expected) {
    assert.ok(worker.includes(`"${pathname}"`), `${pathname} must be embedded in the Worker`);
  }
  assert.ok(worker.includes('"/assets/icons/icon-192.png"'), "installability depends on the icons being deployed");
  assert.ok(worker.includes('"/manifest.webmanifest"'));
  assert.ok(worker.includes('"/sw.js"'), "offline support depends on the service worker being deployed");
});

test("the mockup Worker refuses API calls instead of pretending to store data", async () => {
  const worker = await readFile(resolve(root, "dist", "server", "index.js"), "utf8");
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /503/);
});
