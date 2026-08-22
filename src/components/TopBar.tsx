import type { SyncStatus } from "../sync/useRemoteSync.ts";

interface TopBarProps {
  syncStatus: SyncStatus;
  deviceConnected: boolean;
  onOpenDevice: () => void;
  onHome: () => void;
}

export function TopBar({ syncStatus, deviceConnected, onOpenDevice, onHome }: TopBarProps) {
  return (
    <header className="topbar">
      <a
        className="brand"
        href="#view-today"
        aria-label="Rhythm Hero 홈"
        onClick={(event) => {
          event.preventDefault();
          onHome();
        }}
      >
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <span>Rhythm Hero</span>
      </a>
      <span className="sync-status" aria-live="polite">{syncStatus}</span>
      <button className="device-chip" type="button" aria-label="기기 연결 상태" onClick={onOpenDevice}>
        <span className="status-dot" />
        <span>{deviceConnected ? "USB 기기 연결됨" : "데모 기기 연결됨"}</span>
      </button>
    </header>
  );
}
