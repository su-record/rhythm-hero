import { useEffect, useRef, useState } from "react";

import { appStore, hadPersistedState, replaceState, setRemoteSyncScheduler } from "../store/appStore.ts";
import { getClientId } from "../store/storage.ts";
import { fetchRemoteState, putRemoteState } from "./client.ts";
import { createDebouncer } from "./debounce.ts";

export const SYNC_STATUS = {
  local: "로컬에 저장됨",
  syncing: "동기화 중…",
  synced: "안전하게 동기화됨",
  offline: "오프라인 · 로컬 기록",
  checking: "기록 확인 중…",
} as const;

export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

const SYNC_DEBOUNCE_MS = 650;

export function useRemoteSync(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(SYNC_STATUS.local);
  const remoteReady = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const clientId = getClientId();

    const push = async () => {
      if (!navigator.onLine || inFlight.current) {
        setStatus(SYNC_STATUS.local);
        return;
      }
      inFlight.current = true;
      setStatus(SYNC_STATUS.syncing);
      const saved = await putRemoteState(clientId, appStore.getState());
      inFlight.current = false;
      setStatus(saved ? SYNC_STATUS.synced : SYNC_STATUS.local);
    };

    const debouncer = createDebouncer(SYNC_DEBOUNCE_MS);
    const schedule = () => {
      if (!remoteReady.current) return;
      debouncer.schedule(() => void push());
    };
    setRemoteSyncScheduler(schedule);

    const restore = async () => {
      if (!navigator.onLine) {
        setStatus(SYNC_STATUS.offline);
        return;
      }
      setStatus(SYNC_STATUS.checking);
      const result = await fetchRemoteState(clientId);
      if (result.kind === "error") {
        setStatus(SYNC_STATUS.local);
        return;
      }
      if (result.kind === "missing") {
        remoteReady.current = true;
        await push();
        return;
      }
      const localUpdatedAt = new Date(appStore.getState().updatedAt || 0).getTime();
      const remoteUpdatedAt = new Date(result.state.updatedAt || 0).getTime();
      if (!hadPersistedState || remoteUpdatedAt > localUpdatedAt) replaceState(result.state);
      remoteReady.current = true;
      setStatus(SYNC_STATUS.synced);
      if (hadPersistedState && new Date(appStore.getState().updatedAt || 0).getTime() >= remoteUpdatedAt) schedule();
    };

    const handleOnline = () => {
      if (remoteReady.current) void push();
      else void restore();
    };
    const handleOffline = () => setStatus(SYNC_STATUS.offline);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void restore();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      debouncer.cancel();
      setRemoteSyncScheduler(() => {});
    };
  }, []);

  return status;
}
