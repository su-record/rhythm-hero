import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, normalize, relative, resolve } from "node:path";

import { mimeTypeFor } from "./scripts/mime.mjs";
import { openDatabase } from "./server/db.mjs";

// A .env beside the server is enough; shell variables still win over it.
try { process.loadEnvFile(); } catch { /* no .env: keys come from the shell or stay unset */ }

const root = process.cwd();
const dataRoot = process.env.HABIT_TOY_DATA_DIR ? resolve(process.env.HABIT_TOY_DATA_DIR) : join(root, ".habit-toy-data");
// Serving the build output keeps sources, configs and tests unreachable by construction.
const clientRoot = process.env.HABIT_TOY_CLIENT_DIR ? resolve(process.env.HABIT_TOY_CLIENT_DIR) : join(root, "dist", "client");
const port = Number(process.env.PORT || 4173);
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

/* The REST payload has no output_text convenience field; the text sits in
   output[].content[]. Models also like to wrap JSON in a code fence. */
function responseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  return (payload?.output ?? [])
    .flatMap((item) => item?.content ?? [])
    .filter((part) => part?.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

function parseJsonReply(payload) {
  const text = responseText(payload).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(text);
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
const database = openDatabase(dataRoot);
const imported = database.importLegacyFiles();
if (imported) console.log(`Imported ${imported} legacy JSON state file(s) into SQLite.`);

async function handleState(request, response, clientId) {
  if (!validClientId(clientId)) return sendJson(response, 400, { error: "Invalid client id" });
  if (request.method === "GET") {
    try {
      const state = database.loadState(clientId);
      if (!state) sendJson(response, 404, { error: "No saved state" });
      else sendJson(response, 200, { state });
    } catch (error) {
      console.error("State read error", error.message);
      sendJson(response, 500, { error: "Unable to read saved state" });
    }
    return;
  }
  if (request.method !== "PUT") {
    response.writeHead(405, { Allow: "GET, PUT" }); response.end(); return;
  }
  try {
    const { state } = await readJson(request);
    if (!validState(state)) return sendJson(response, 400, { error: "Invalid Rhythm Hero state" });
    database.saveState(clientId, state);
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
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
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
    try { parsed = parseJsonReply(payload); } catch { return sendJson(response, 502, { error: "Reflection API returned invalid output" }); }
    if (!Number.isInteger(parsed.factIndex) || parsed.factIndex < 0 || parsed.factIndex >= facts.length || typeof parsed.headline !== "string" || parsed.headline.length < 1 || parsed.headline.length > 90 || /\d/.test(parsed.headline)) {
      return sendJson(response, 502, { error: "Reflection API returned unsafe output" });
    }
    sendJson(response, 200, { headline: parsed.headline.trim(), factIndex: parsed.factIndex, requestId: result.headers.get("x-request-id") || null });
  } catch (error) {
    console.error("Reflection endpoint error", error.message);
    sendJson(response, 500, { error: "Unable to create reflection" });
  }
}

const BANNED_TONE = /왜|실패|게을|안 했|해야|반성|잔소리|실망/;

function validCompanionFacts(value) {
  if (!value || typeof value !== "object") return false;
  const text = (field, max) => typeof value[field] === "string" && value[field].length <= max;
  return text("toyName", 24) && text("userName", 24) && text("timeBand", 12) && text("suggestion", 40)
    && (value.lastActivity === null || text("lastActivity", 40))
    && (value.quietMinutes === null || (Number.isFinite(value.quietMinutes) && value.quietMinutes >= 0 && value.quietMinutes <= 1440))
    && (typeof value.suggestMinutes === "number" && value.suggestMinutes >= 1 && value.suggestMinutes <= 180);
}

/* The toy's line comes from the model, but only the facts leave the server and
   the reply is rejected unless it still sounds like a bored toy, not a coach. */
async function createCompanionLine(request, response) {
  if (!process.env.OPENAI_API_KEY) return sendJson(response, 503, { error: "OPENAI_API_KEY is not configured" });
  try {
    const { facts } = await readJson(request);
    if (!validCompanionFacts(facts)) return sendJson(response, 400, { error: "Invalid companion facts" });
    const result = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
        store: false,
        instructions: [
          `You are ${facts.toyName}, a small spiky toy that lives on ${facts.userName}'s desk and records their time with four buttons.`,
          "The user has been quiet for a while. Say ONE short, playful Korean sentence (max 40 characters) in a bored, affectionate toy voice (반말).",
          `Gently suggest the activity "${facts.suggestion}" for about ${facts.suggestMinutes} minutes.`,
          "Never scold, never mention failure, laziness, guilt, or what they should have done. No numbers other than the minutes. No emoji.",
          'Return JSON only: {"line": string}.',
        ].join(" "),
        input: JSON.stringify({ timeBand: facts.timeBand, lastActivity: facts.lastActivity, quietMinutes: facts.quietMinutes }),
      }),
    });
    const payload = await result.json();
    if (!result.ok) {
      console.error("OpenAI companion error", result.status, payload?.error?.message || "unknown");
      return sendJson(response, 502, { error: "Companion API request failed" });
    }
    let parsed;
    try { parsed = parseJsonReply(payload); } catch (error) {
      console.error("Companion parse error", error.message, JSON.stringify(payload).slice(0, 600));
      return sendJson(response, 502, { error: "Companion API returned invalid output" });
    }
    const line = typeof parsed.line === "string" ? parsed.line.trim() : "";
    if (!line || line.length > 60 || BANNED_TONE.test(line)) return sendJson(response, 502, { error: "Companion API returned an unsafe line" });
    sendJson(response, 200, { line });
  } catch (error) {
    console.error("Companion endpoint error", error.message);
    sendJson(response, 500, { error: "Unable to create companion line" });
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
  if (request.method === "POST" && request.url === "/api/companion") {
    createCompanionLine(request, response);
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
  const filePath = normalize(join(clientRoot, relativePath));
  if (relative(clientRoot, filePath).startsWith("..") || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": mimeTypeFor(filePath), "Cache-Control": "no-cache" });
  if (request.method === "HEAD") { response.end(); return; }
  createReadStream(filePath).pipe(response);
});

if (!existsSync(join(clientRoot, "index.html"))) {
  console.error(`Rhythm Hero has no build output at ${clientRoot}. Run "npm run build" first.`);
  process.exit(1);
}

server.listen(port, () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : port;
  console.log(`Rhythm Hero is running at http://localhost:${activePort} (SQLite: ${join(dataRoot, "rhythm-hero.db")}, ${database.clientCount()} client(s))`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    database.close();
    process.exit(0);
  });
}
