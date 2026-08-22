import type { InstallState } from "../pwa/useInstallPrompt.ts";

const COPY: Record<Exclude<InstallState, "hidden">, { status: string; body: string }> = {
  installed: { status: "홈 화면 앱으로 실행 중", body: "이미 설치된 앱으로 열렸어요. 오프라인에서도 기록은 그대로 남습니다." },
  ready: { status: "앱으로 설치할 수 있어요", body: "설치하면 주소창 없이 전체 화면으로 열리고, 오프라인에서도 기록할 수 있어요." },
  dismissed: { status: "언제든 다시 설치할 수 있어요", body: "브라우저 메뉴의 '앱 설치'를 선택하면 홈 화면에 추가됩니다." },
  ios: { status: "홈 화면에 추가할 수 있어요", body: "Safari 공유 버튼을 누른 뒤 '홈 화면에 추가'를 선택하세요." },
};

export function InstallPanel({ state, onInstall }: { state: InstallState; onInstall: () => void }) {
  if (state === "hidden") return null;
  const copy = COPY[state];

  return (
    <section className="settings-section utility-panel install-panel">
      <div>
        <p className="eyebrow">홈 화면</p>
        <strong>{copy.status}</strong>
        <p>{copy.body}</p>
      </div>
      <div className="install-actions">
        <button className={`button secondary${state === "ready" ? "" : " hidden"}`} type="button" onClick={onInstall}>
          홈 화면에 추가
        </button>
      </div>
    </section>
  );
}
