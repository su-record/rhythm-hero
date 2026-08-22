import { STORAGE_KEY, createDefaultState, normalizeState } from "../domain/state.ts";
import type { AppState } from "../domain/types.ts";
import { createStore, type Updater } from "./store.ts";
import { readStoredValue, writeStoredValue } from "./storage.ts";

/** True when the browser already held a state, which decides who wins on restore. */
export let hadPersistedState = false;

function loadState(): AppState {
  try {
    const raw = readStoredValue(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AppState) : null;
    if (parsed?.categories?.length) {
      hadPersistedState = true;
      return normalizeState(parsed);
    }
  } catch {
    /* An unreadable state is replaced by the demo state below. */
  }
  const initial = createDefaultState();
  writeStoredValue(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export const appStore = createStore(loadState());

type RemoteSyncScheduler = () => void;
let scheduleRemoteSync: RemoteSyncScheduler = () => {};

export function setRemoteSyncScheduler(scheduler: RemoteSyncScheduler): void {
  scheduleRemoteSync = scheduler;
}

/** Every mutation stamps updatedAt, persists locally, then queues a remote push. */
export function commit(updater: Updater): AppState {
  const next = appStore.update((state) => {
    const updated = updater(state);
    return updated === state ? state : { ...updated, updatedAt: new Date().toISOString() };
  });
  writeStoredValue(STORAGE_KEY, JSON.stringify(next));
  scheduleRemoteSync();
  return next;
}

/** Used by remote restore, which must not echo the freshly pulled state back. */
export function replaceState(next: AppState): void {
  appStore.update(() => normalizeState(next));
  writeStoredValue(STORAGE_KEY, JSON.stringify(appStore.getState()));
}

/** Commits a transition that also reports an outcome the view must react to. */
export function commitWith<T>(updater: (state: AppState) => { state: AppState; result: T }): T {
  let captured: { value: T } | null = null;
  commit((state) => {
    const outcome = updater(state);
    captured = { value: outcome.result };
    return outcome.state;
  });
  if (!captured) throw new Error("A commit must always produce an outcome");
  return (captured as { value: T }).value;
}
