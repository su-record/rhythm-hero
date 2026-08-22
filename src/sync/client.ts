import type { AppState } from "../domain/types.ts";

export type FetchStateResult =
  | { kind: "found"; state: AppState }
  | { kind: "missing" }
  | { kind: "error" };

/** Distinguishes "never synced" from "sync failed": only the former pushes local state up. */
export async function fetchRemoteState(clientId: string, fetchImpl: typeof fetch = fetch): Promise<FetchStateResult> {
  try {
    const response = await fetchImpl(`/api/state/${clientId}`);
    if (response.status === 404) return { kind: "missing" };
    if (!response.ok) return { kind: "error" };
    const payload = (await response.json()) as { state?: AppState };
    return payload.state?.categories?.length ? { kind: "found", state: payload.state } : { kind: "missing" };
  } catch {
    return { kind: "error" };
  }
}

export async function putRemoteState(clientId: string, state: AppState, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl(`/api/state/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
