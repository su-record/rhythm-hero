import type { AppState } from "../domain/types.ts";
import { appStore } from "../store/appStore.ts";

export interface HabitToyBridge {
  pressButton: (index: number) => void;
  getState: () => AppState;
}

declare global {
  interface Window {
    habitToy?: HabitToyBridge;
  }
}

/* Firmware bridge: an embedded client calls window.habitToy.pressButton(1..4).
   It lives outside the React tree, which is why the store is not a Context. */
export function installHabitToyBridge(pressButton: (index: number) => void): () => void {
  window.habitToy = { pressButton, getState: () => structuredClone(appStore.getState()) };
  return () => {
    delete window.habitToy;
  };
}
