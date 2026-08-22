import { useSyncExternalStore } from "react";

import type { AppState } from "../domain/types.ts";
import { appStore } from "./appStore.ts";

/**
 * The whole state. Store writes are user-driven and infrequent, so components
 * derive with useMemo rather than subscribing to slices; the once-per-second
 * clock is a separate ticker and never touches the store.
 */
export function useAppState(): AppState {
  return useSyncExternalStore(appStore.subscribe, appStore.getState, appStore.getState);
}
