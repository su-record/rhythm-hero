import type { NudgeFacts } from "../domain/idle.ts";

export type CompanionLineResult = { kind: "created"; line: string } | { kind: "unavailable" };

const BANNED_TONE = /왜|실패|게을|안 했|해야|반성|잔소리|실망/;

/** Asks the server for a model-written line; anything doubtful falls back to the template. */
export async function requestCompanionLine(facts: NudgeFacts, fetchImpl: typeof fetch = fetch): Promise<CompanionLineResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetchImpl("/api/companion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return { kind: "unavailable" };
    const payload = (await response.json()) as { line?: string };
    const line = payload.line?.trim() ?? "";
    if (!line || line.length > 60 || BANNED_TONE.test(line)) return { kind: "unavailable" };
    return { kind: "created", line };
  } catch {
    return { kind: "unavailable" };
  }
}
