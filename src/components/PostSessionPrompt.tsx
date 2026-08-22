export interface PromptCopy {
  title: string;
  meta: string;
  action: string;
}

interface PostSessionPromptProps {
  copy: PromptCopy | null;
  onWrite: () => void;
  onDismiss: () => void;
}

export function PostSessionPrompt({ copy, onWrite, onDismiss }: PostSessionPromptProps) {
  return (
    <aside
      className={`post-session-prompt${copy ? "" : " hidden"}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby="post-session-title"
    >
      <span className="post-session-check" aria-hidden="true">✓</span>
      <div className="post-session-copy">
        <strong id="post-session-title">{copy?.title ?? "기록 완료"}</strong>
        <span>{copy?.meta ?? "한 줄 메모를 남겨보세요."}</span>
      </div>
      <button className="button small" type="button" onClick={onWrite}>{copy?.action ?? "메모"}</button>
      <button className="icon-button" type="button" aria-label="메모 알림 닫기" onClick={onDismiss}>×</button>
    </aside>
  );
}
