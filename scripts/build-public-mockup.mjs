import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const assets = [
  ["/", "index.html", "text/html; charset=utf-8"],
  ["/index.html", "index.html", "text/html; charset=utf-8"],
  ["/app.js", "app.js", "text/javascript; charset=utf-8"],
  ["/styles.css", "styles.css", "text/css; charset=utf-8"],
  ["/sw.js", "sw.js", "text/javascript; charset=utf-8"],
  ["/manifest.webmanifest", "manifest.webmanifest", "application/manifest+json; charset=utf-8"],
  ["/time-utils.mjs", "time-utils.mjs", "text/javascript; charset=utf-8"],
  ["/state-utils.mjs", "state-utils.mjs", "text/javascript; charset=utf-8"],
];

const encoded = await Promise.all(assets.map(async ([pathname, source, type]) => [
  pathname,
  { body: (await readFile(resolve(root, source))).toString("base64"), type },
]));

const worker = `const assets = new Map(${JSON.stringify(encoded)});
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
    const asset = assets.get(url.pathname) || (url.pathname === "/" ? assets.get("/") : null);
    if (!asset) return new Response("Not found", { status: 404 });
    const body = Uint8Array.from(atob(asset.body), (character) => character.charCodeAt(0));
    return new Response(body, {
      headers: {
        "content-type": asset.type,
        "cache-control": url.pathname === "/" || url.pathname === "/index.html" ? "no-store" : "public, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  },
};
`;

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "server"), { recursive: true });
await writeFile(resolve(output, "server", "index.js"), worker);
console.log(`Built public Rhythm Hero mockup with ${assets.length} static assets.`);
