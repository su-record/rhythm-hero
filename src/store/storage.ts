import { CLIENT_ID_KEY, randomId } from "../domain/state.ts";

/* Private browsing and sandboxed frames throw on localStorage access. Falling
   back to memory keeps a session recordable even when nothing can persist. */
const memoryStorage = new Map<string, string>();

export function readStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryStorage.get(key) ?? null;
  }
}

export function writeStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryStorage.set(key, value);
  }
}

export function getClientId(): string {
  const existing = readStoredValue(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = randomId().replaceAll("-", "");
  writeStoredValue(CLIENT_ID_KEY, next);
  return next;
}
