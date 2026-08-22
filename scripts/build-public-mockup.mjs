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
  ["/assets/icons/icon-192.png", "assets/icons/icon-192.png", "image/png"],
  ["/assets/icons/icon-512.png", "assets/icons/icon-512.png", "image/png"],
  ["/assets/icons/icon-maskable-512.png", "assets/icons/icon-maskable-512.png", "image/png"],
  ["/assets/icons/apple-touch-icon-180.png", "assets/icons/apple-touch-icon-180.png", "image/png"],
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
        "cache-control": asset.type === "image/png" ? "public, max-age=86400" : "no-cache",
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
