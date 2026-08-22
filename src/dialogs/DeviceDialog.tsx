import { useDialog } from "../hooks/useDialog.ts";

interface DeviceDialogProps {
  open: boolean;
  connected: boolean;
  onClose: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function DeviceDialog({ open, connected, onClose, onConnect, onDisconnect }: DeviceDialogProps) {
  const ref = useDialog(open, onClose);

  return (
    <dialog ref={ref} aria-labelledby="device-dialog-title">
      <form method="dialog">
        <div className="dialog-header">
          <div><p className="eyebrow">Hardware Bridge</p><h2 id="device-dialog-title">Rhythm Hero 연결</h2></div>
          <button className="icon-button" value="cancel" type="submit" aria-label="닫기">×</button>
        </div>
        <p className="dialog-copy">
          Chrome에서 USB로 연결된 개발보드의 버튼 입력을 바로 받을 수 있습니다. 보드는 한 줄씩 JSON 또는 <code>BUTTON:1</code> 형식으로 이벤트를 보내면 됩니다.
        </p>
        <div className="connection-state">{connected ? "현재: USB Serial 연결됨 · 115200 baud" : "현재: 데모 모드"}</div>
        <button className={`button full${connected ? " hidden" : ""}`} type="button" onClick={onConnect}>USB Serial 연결</button>
        <button className={`button secondary full${connected ? "" : " hidden"}`} type="button" onClick={onDisconnect}>연결 해제</button>
      </form>
    </dialog>
  );
}
