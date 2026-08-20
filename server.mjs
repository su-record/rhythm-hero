import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";

const root = process.cwd();
const dataRoot = process.env.HABIT_TOY_DATA_DIR ? resolve(process.env.HABIT_TOY_DATA_DIR) : join(root, ".habit-toy-data");
const port = Number(process.env.PORT || 4173);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
const publicFiles = new Set([
  "app.js",
  "index.html",
  "manifest.webmanifest",
  "state-utils.mjs",
  "styles.css",
  "sw.js",
  "time-utils.mjs",
]);

function isPublicFile(relativePath) {
  const portablePath = relativePath.replaceAll("\\", "/");
  return publicFiles.has(portablePath) || portablePath.startsWith("assets/");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64_000) reject(new Error("Request body is too large"));
    });
    request.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON")); }
    });
    request.on("error", reject);
  });
}

function validFacts(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 5) return false;
  return value.every((fact) => typeof fact?.message === "string" && fact.message.length <= 240 && typeof fact?.evidence === "string" && fact.evidence.length <= 180);
}

function validClientId(value) { return /^[a-zA-Z0-9_-]{16,80}$/.test(value); }
function validState(value) {
  return value && typeof value === "object" && Array.isArray(value.categories) && Array.isArray(value.sessions)
    && value.categories.length <= 100 && value.sessions.length <= 10_000;
}
function stateFile(clientId) { return join(dataRoot, `${clientId}.json`); }

async function handleState(request, response, clientId) {
  if (!validClientId(clientId)) return sendJson(response, 400, { error: "Invalid client id" });
  const file = stateFile(clientId);
  if (request.method === "GET") {
    try {
      const state = JSON.parse(await readFile(file, "utf8"));
      sendJson(response, 200, { state });
    } catch (error) {
      if (error.code === "ENOENT") sendJson(response, 404, { error: "No saved state" });
      else sendJson(response, 500, { error: "Unable to read saved state" });
    }
    return;
  }
  if (request.method !== "PUT") {
    response.writeHead(405, { Allow: "GET, PUT" }); response.end(); return;
  }
  try {
    const { state } = await readJson(request);
    if (!validState(state)) return sendJson(response, 400, { error: "Invalid Rhythm Hero state" });
    await mkdir(dataRoot, { recursive: true });
    const temporary = `${file}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify(state), "utf8");
    await rename(temporary, file);
    sendJson(response, 200, { savedAt: new Date().toISOString() });
  } catch (error) {
    console.error("State persistence error", error.message);
    sendJson(response, 500, { error: "Unable to save state" });
  }
}

async function createReflection(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, { error: "OPENAI_API_KEY is not configured" });
    return;
  }
  try {
    const { facts } = await readJson(request);
    if (!validFacts(facts)) return sendJson(response, 400, { error: "Invalid reflection facts" });
    const result = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6",
        store: false,
        instructions: "You write a single, gentle Korean headline for a personal time-tracking reflection. Use only the supplied facts. Do not invent numbers, causes, diagnoses, advice, or judgments. Return JSON only: {\"factIndex\": number, \"headline\": string}. The headline must be under 45 Korean characters and must not contain a number.",
        input: JSON.stringify({ facts }),
      }),
    });
    const payload = await result.json();
    if (!result.ok) {
      console.error("OpenAI response error", result.status, payload?.error?.message || "unknown");
      return sendJson(response, 502, { error: "Reflection API request failed" });
    }
    let parsed;
    try { parsed = JSON.parse(payload.output_text); } catch { return sendJson(response, 502, { error: "Reflection API returned invalid output" }); }
    if (!Number.isInteger(parsed.factIndex) || parsed.factIndex < 0 || parsed.factIndex >= facts.length || typeof parsed.headline !== "string" || parsed.headline.length < 1 || parsed.headline.length > 90 || /\d/.test(parsed.headline)) {
      return sendJson(response, 502, { error: "Reflection API returned unsafe output" });
    }
    sendJson(response, 200, { headline: parsed.headline.trim(), factIndex: parsed.factIndex, requestId: result.headers.get("x-request-id") || null });
  } catch (error) {
    console.error("Reflection endpoint error", error.message);
    sendJson(response, 500, { error: "Unable to create reflection" });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const stateMatch = url.pathname.match(/^\/api\/state\/([a-zA-Z0-9_-]+)$/);
  if (stateMatch) {
    await handleState(request, response, stateMatch[1]);
    return;
  }
  if (request.method === "POST" && request.url === "/api/reflection") {
    createReflection(request, response);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD, POST" });
    response.end();
    return;
  }
  const pathname = url.pathname;
  let relativePath;
  try {
    relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^[/\\]+/, "");
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }
  const filePath = normalize(join(root, relativePath));
  const publicPath = relative(root, filePath);
  if (publicPath.startsWith("..") || !isPublicFile(publicPath) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache" });
  if (request.method === "HEAD") { response.end(); return; }
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : port;
  console.log(`Rhythm Hero is running at http://localhost:${activePort}`);
});
