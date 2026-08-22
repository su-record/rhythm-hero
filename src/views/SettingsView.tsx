import { formatMinutes, safeColor } from "../domain/format.ts";
import { allCompleted, categoryById, restorableSessions, selectableCategories } from "../domain/stats.ts";
import { durationMs, localDateInput } from "../domain/time.ts";
import type { AppState } from "../domain/types.ts";
import { ActivityIcon } from "../components/ActivityIcon.tsx";
import { InstallPanel } from "../components/InstallPanel.tsx";
import type { InstallState } from "../pwa/useInstallPrompt.ts";

interface SettingsViewProps {
  state: AppState;
  active: boolean;
  deviceConnected: boolean;
  installState: InstallState;
  onInstall: () => void;
  onVoiceChange: (voice: boolean) => void;
  onIdleMinutesChange: (minutes: number) => void;
  onTestCompanion: () => void;
  onAssign: (slot: number, categoryId: string) => void;
  onGoalChange: (categoryId: string, goal: number) => void;
  onEditCategory: (id: string) => void;
  onArchiveCategory: (id: string) => void;
  onAddCategory: () => void;
  onRestoreSession: (id: string) => void;
  onOpenDevice: () => void;
  onTestHardware: () => void;
  onExport: () => void;
  onResetDemo: () => void;
}

function AssignmentRows({ state, onAssign }: Pick<SettingsViewProps, "state" | "onAssign">) {
  const options = selectableCategories(state);
  return (
    <div className="assignment-list">
      {state.assignments.map((id, index) => {
        const category = categoryById(state, id);
        return (
          <div className="assignment-row" key={`${index}-${id}`} style={{ ["--category" as string]: safeColor(category?.color) }}>
            <span className="assignment-leading">
              <b>{index + 1}</b>
              <ActivityIcon category={category} size="activity-icon-list" />
              <span>{category?.name ?? ""}</span>
            </span>
            <select value={id} aria-label={`${index + 1}번 버튼 활동`} onChange={(event) => onAssign(index, event.target.value)}>
              {options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}

const MAX_GOAL_MINUTES = 720;

export function SettingsView({ state, active, deviceConnected, installState, ...handlers }: SettingsViewProps) {
  const deleted = restorableSessions(state);

  return (
    <section className={`view${active ? " active" : ""}`} id="view-settings" aria-labelledby="settings-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">나에게 맞추기</p>
          <h1 id="settings-title">설정</h1>
        </div>
      </div>

      <section className="settings-section">
        <div className="section-heading compact">
          <div><h2>나의 네 가지</h2><p>각 버튼으로 바로 시작할 활동을 정하세요.</p></div>
        </div>
        <AssignmentRows state={state} onAssign={handlers.onAssign} />
      </section>

      <section className="settings-section">
        <div className="section-heading compact"><div><h2>일일 목표</h2><p>목표는 선택 사항이며, 미달은 실패가 아닙니다.</p></div></div>
        <div className="goal-list">
          {state.categories.map((category) => (
            <div className="goal-row" key={category.id} style={{ ["--category" as string]: safeColor(category.color) }}>
              <label htmlFor={`goal-${category.id}`}>
                <ActivityIcon category={category} size="activity-icon-list" />
                <span>{category.name}</span>
              </label>
              <span className="goal-control">
                <input
                  id={`goal-${category.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_GOAL_MINUTES}
                  defaultValue={category.goal || 0}
                  onChange={(event) => handlers.onGoalChange(category.id, Number(event.target.value))}
                />
                <span>분</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-heading compact">
          <div><h2>모든 활동</h2><p>나의 네 가지에서 빼도 과거 기록은 남아 있어요.</p></div>
          <button className="button secondary" type="button" onClick={handlers.onAddCategory}>+ 추가</button>
        </div>
        <div className="category-manager">
          {state.categories.map((category) => {
            const recordCount = allCompleted(state).filter((session) => session.categoryId === category.id).length;
            const assigned = state.assignments.includes(category.id);
            const archived = category.status === "archived";
            return (
              <div
                className={`category-manager-row${archived ? " archived" : ""}`}
                key={category.id}
                style={{ ["--category" as string]: safeColor(category.color) }}
              >
                <ActivityIcon category={category} size="activity-icon-list" />
                <button
                  className="category-manager-edit"
                  type="button"
                  aria-label={`${category.name} 활동 이름 편집`}
                  onClick={() => handlers.onEditCategory(category.id)}
                >
                  <span className="category-manager-info">
                    <strong>{category.name}</strong>
                    <span>{archived ? "보관됨" : assigned ? "나의 네 가지에 연결됨" : `기록 ${recordCount}개`}</span>
                  </span>
                  <span className="category-manager-edit-icon" aria-hidden="true">›</span>
                </button>
                <button className="button secondary" type="button" onClick={() => handlers.onArchiveCategory(category.id)}>
                  {archived ? "복원" : "보관"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="settings-section" hidden={deleted.length === 0}>
        <div className="section-heading compact"><div><h2>최근 삭제한 기록</h2><p>삭제 후 30일 안에는 복구할 수 있어요.</p></div></div>
        <div className="category-manager">
          {deleted.map((session) => {
            const category = categoryById(state, session.categoryId);
            return (
              <div className="category-manager-row" key={session.id} style={{ ["--category" as string]: safeColor(category?.color) }}>
                <ActivityIcon category={category} size="activity-icon-list" />
                <div className="category-manager-info">
                  <strong>{`${category?.name ?? ""} · ${formatMinutes(durationMs(session) / 60_000)}`}</strong>
                  <span>{`${localDateInput(session.startedAt)}에 삭제됨`}</span>
                </div>
                <button className="button secondary" type="button" onClick={() => handlers.onRestoreSession(session.id)}>복구</button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="settings-section utility-panel companion-panel">
        <div>
          <p className="eyebrow">장난감</p>
          <strong>조용하면 먼저 말을 걸어요</strong>
          <p>기록이 없는 시간이 길어지면 캐릭터가 한마디 하고, 보드 LED가 숨을 쉽니다. 밤 11시부터 아침 8시까지는 조용히 있어요.</p>
        </div>
        <div className="companion-controls">
          <label className="companion-toggle">
            <input type="checkbox" checked={state.companion.voice} onChange={(event) => handlers.onVoiceChange(event.target.checked)} />
            <span>목소리로 말하기</span>
          </label>
          <label className="companion-threshold">
            <span>조용한 지</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={720}
              value={state.companion.idleMinutes}
              onChange={(event) => handlers.onIdleMinutesChange(Number(event.target.value))}
            />
            <span>분 지나면</span>
          </label>
          <button className="button secondary" type="button" onClick={handlers.onTestCompanion}>지금 말 걸어보기</button>
        </div>
      </section>

      <InstallPanel state={installState} onInstall={handlers.onInstall} />

      <section className="settings-section utility-panel device-panel">
        <div>
          <p className="eyebrow">Rhythm Hero A1B2</p>
          <strong>{deviceConnected ? "USB Serial 연결됨" : "데모 모드"}</strong>
          <p>{deviceConnected ? "보드 버튼 이벤트와 LED 상태를 동기화하고 있어요." : "키보드 1–4 또는 화면 버튼으로 테스트할 수 있어요."}</p>
        </div>
        <div className="device-actions">
          <button className="button secondary" type="button" onClick={handlers.onOpenDevice}>USB 연결</button>
          <button className="button secondary" type="button" onClick={handlers.onTestHardware}>테스트</button>
        </div>
      </section>

      <section className="settings-section utility-panel data-panel">
        <div>
          <p className="eyebrow">내 데이터</p>
          <strong>기록은 내보낼 수 있어요.</strong>
          <p>JSON 형식으로 현재 데이터를 다운로드합니다.</p>
        </div>
        <div className="data-actions">
          <button className="button secondary" type="button" onClick={handlers.onExport}>내보내기</button>
          <button className="button quiet danger" type="button" onClick={handlers.onResetDemo}>데모 초기화</button>
        </div>
      </section>
    </section>
  );
}
