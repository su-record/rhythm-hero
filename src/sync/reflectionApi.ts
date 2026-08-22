import type { AiReflection, ReflectionReport } from "../domain/types.ts";

export type ReflectionResult =
  | { kind: "created"; reflection: AiReflection }
  | { kind: "missing-key" }
  | { kind: "failed" };

interface ReflectionResponse {
  headline?: string;
  factIndex?: number;
  error?: string;
}

const MISSING_KEY_ERROR = "OPENAI_API_KEY is not configured";

/** Sends only the computed facts; the headline is rejected unless it maps back to one. */
export async function requestAiReflection(report: ReflectionReport, fetchImpl: typeof fetch = fetch): Promise<ReflectionResult> {
  const facts = report.facts.map(({ message, evidence }) => ({ message, evidence }));
  try {
    const response = await fetchImpl("/api/reflection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts }),
    });
    const result = (await response.json()) as ReflectionResponse;
    if (!response.ok) return result.error === MISSING_KEY_ERROR ? { kind: "missing-key" } : { kind: "failed" };

    const factIndex = result.factIndex ?? -1;
    const selectedFact = report.facts[factIndex];
    if (!selectedFact || !result.headline) return { kind: "failed" };

    return {
      kind: "created",
      reflection: {
        headline: result.headline,
        factIndex,
        factSnapshot: { ...selectedFact, range: report.range, periodLabel: report.periodLabel, fingerprint: report.fingerprint },
        createdAt: new Date().toISOString(),
      },
    };
  } catch {
    return { kind: "failed" };
  }
}
