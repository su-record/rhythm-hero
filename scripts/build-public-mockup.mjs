import { readdir, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { posix, resolve } from "node:path";

import { mimeTypeFor } from "./mime.mjs";

const root = resolve(import.meta.dirname, "..");
const clientRoot = resolve(root, "dist", "client");
const output = resolve(root, "dist");

/* Walking the build output means a newly added asset ships without anyone
   remembering to extend a hand-written list. */
async function collect(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const child = resolve(directory, entry.name);
    if (entry.isDirectory()) return collect(child, posix.join(prefix, entry.name));
    return [[posix.join("/", prefix, entry.name), child]];
  }));
  return files.flat();
}

const collected = await collect(clientRoot);
if (!collected.length) throw new Error(`No build output in ${clientRoot}. Run "npm run build" first.`);

const assets = await Promise.all(collected.map(async ([pathname, filePath]) => [
  pathname,
  { body: (await readFile(filePath)).toString("base64"), type: mimeTypeFor(filePath) },
]));
const shell = assets.find(([pathname]) => pathname === "/index.html");
if (!shell) throw new Error("The build output has no index.html to serve as the shell.");
assets.push(["/", shell[1]]);

const worker = `const assets = new Map(${JSON.stringify(assets)});
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Public mockup mode: shared server features are disabled." }, 503);
    }
    // Any in-scope route falls back to the shell so the installed app can deep link.
    const asset = assets.get(url.pathname) || (request.mode === "navigate" ? assets.get("/") : null);
    if (!asset) return new Response("Not found", { status: 404 });
    const body = Uint8Array.from(atob(asset.body), (character) => character.charCodeAt(0));
    return new Response(body, {
      headers: {
        "content-type": asset.type,
        "cache-control": asset.type === "image/png" ? "public, max-age=86400" : "no-cache",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
`;

await mkdir(resolve(output, "server"), { recursive: true });
await rm(resolve(output, "server", "index.js"), { force: true });
await writeFile(resolve(output, "server", "index.js"), worker);
console.log(`Built public Rhythm Hero mockup from ${collected.length} build assets.`);
