import type { AppState } from "../domain/types.ts";

export type Listener = () => void;
export type Updater = (state: AppState) => AppState;

export interface Store {
  getState(): AppState;
  subscribe(listener: Listener): () => void;
  /** Replaces the state through a pure updater. Identical results notify nobody. */
  update(updater: Updater): AppState;
}

export function createStore(initial: AppState): Store {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(updater) {
      const next = updater(state);
      if (next === state) return state;
      state = next;
      listeners.forEach((listener) => listener());
      return state;
    },
  };
}
