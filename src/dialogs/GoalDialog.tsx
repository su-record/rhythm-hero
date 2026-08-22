import { useEffect, useRef, useState } from "react";

import { formatMinutes, safeColor } from "../domain/format.ts";
import { GOAL_TYPE_LABEL } from "../domain/goal.ts";
import { GOAL_PRESETS, MAX_ACTIVITY_NAME, SUGGESTED_ACTIVITIES, normalizeActivityName } from "../domain/onboarding.ts";
import { isDuplicateCategoryName } from "../domain/state.ts";
import { categoryById } from "../domain/stats.ts";
import type { AppState, GoalType } from "../domain/types.ts";
import type { CategoryDraft } from "../store/actions.ts";
import { ActivityIcon } from "../components/ActivityIcon.tsx";

interface GoalDialogProps {
  state: AppState;
  open: boolean;
  /** Set after saving when every button is taken: the user picks which one to replace. */
  pendingCategoryId: string | null;
  onClose: () => void;
  onSave: (draft: CategoryDraft) => void;
  onPlace: (slot: number) => void;
  onKeepInList: () => void;
}

const DEFAULT_GOAL: Record<GoalType, number> = { daily: 30, weekly: 300 };
const PALETTE = ["#FF5D52", "#20D68A", "#5B70FF", "#FFD43B", "#FF8FAB", "#7C5CFF", "#00B8D9", "#F28B2F"];

/* The same two questions as onboarding, on one screen: what, and how much.
   Any number of goals can exist; only four sit on the board at a time. */
export function GoalDialog({ state, open, pendingCategoryId, onClose, onSave, onPlace, onKeepInList }: GoalDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("daily");
  const [goal, setGoal] = useState(DEFAULT_GOAL.daily);
  const [error, setError] = useState("");
  const choosingSlot = pendingCategoryId !== null;
  const pending = pendingCategoryId ? categoryById(state, pendingCategoryId) : undefined;
  const taken = new Set(state.categories.map((category) => category.name.toLocaleLowerCase("ko-KR")));

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => {
    if (!open || choosingSlot) return;
    setName("");
    setGoalType("daily");
    setGoal(DEFAULT_GOAL.daily);
    setError("");
    const frame = requestAnimationFrame(() => nameInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, choosingSlot]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    // The × is a cancel submit: let the native dialog close instead of saving.
    if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "cancel") return;
    event.preventDefault();
    const clean = normalizeActivityName(name);
    if (!clean) return setError("활동 이름을 적어주세요.");
    if (isDuplicateCategoryName(state, clean, null)) return setError("같은 이름의 활동이 이미 있어요.");
    onSave({ name: clean, color: PALETTE[state.categories.length % PALETTE.length] ?? PALETTE[0]!, goal, goalType });
  };

  return (
    <dialog className="goal-dialog" ref={ref} aria-labelledby="goal-dialog-title">
      {choosingSlot && pending ? (
        <div className="onboarding-step">
          <div className="dialog-header">
            <div><p className="eyebrow">버튼이 다 찼어요</p><h2 id="goal-dialog-title">{pending.name}을 어느 버튼에 올릴까요?</h2></div>
            <button className="icon-button" type="button" aria-label="닫기" onClick={onKeepInList}>×</button>
          </div>
          <p className="dialog-copy">보드에는 버튼이 네 개예요. 내려간 활동의 기록은 그대로 남고, 언제든 다시 올릴 수 있어요.</p>
          <div className="slot-picker" role="group" aria-label="교체할 버튼">
            {state.assignments.map((id, index) => {
              const current = categoryById(state, id);
              return (
                <button key={index} type="button" className="slot-option" style={{ ["--category" as string]: safeColor(current?.color) }} onClick={() => onPlace(index)}>
                  <span className="activity-picked-index">{index + 1}</span>
                  <ActivityIcon category={current} size="activity-icon-list" />
                  <span className="slot-option-copy"><strong>{current?.name ?? ""}</strong><span>이 자리에 {pending.name}</span></span>
                </button>
              );
            })}
          </div>
          <button className="button secondary full" type="button" onClick={onKeepInList}>지금은 목록에만 두기</button>
        </div>
      ) : (
        <form className="onboarding-step" method="dialog" onSubmit={submit}>
          <div className="dialog-header">
            <div><p className="eyebrow">새 목표</p><h2 id="goal-dialog-title">무엇에 시간을 낼까요?</h2></div>
            <button className="icon-button" value="cancel" type="submit" formNoValidate aria-label="닫기">×</button>
          </div>

          <div className="activity-chips" role="group" aria-label="활동 고르기">
            {SUGGESTED_ACTIVITIES.filter((item) => !taken.has(item.toLocaleLowerCase("ko-KR"))).map((item) => (
              <button key={item} type="button" className={`activity-chip${name === item ? " selected" : ""}`} aria-pressed={name === item} onClick={() => { setError(""); setName(item); }}>
                {item}
              </button>
            ))}
          </div>
          <label>
            이름
            <input
              ref={nameInput}
              type="text"
              maxLength={MAX_ACTIVITY_NAME}
              placeholder="직접 적기 (예: 피아노)"
              value={name}
              aria-invalid={Boolean(error)}
              aria-describedby="goal-name-error"
              onChange={(event) => { setError(""); setName(event.target.value); }}
            />
          </label>
          <p className="field-error" id="goal-name-error" role="alert" aria-live="polite" hidden={!error}>{error}</p>

          <div className="time-plan-head goal-dialog-unit">
            <strong>얼마나?</strong>
            <span className="segmented" role="group" aria-label="목표 단위">
              {(["daily", "weekly"] as GoalType[]).map((type) => (
                <button key={type} type="button" className={goalType === type ? "selected" : undefined} aria-pressed={goalType === type} onClick={() => { setGoalType(type); setGoal(DEFAULT_GOAL[type]); }}>
                  {GOAL_TYPE_LABEL[type]}
                </button>
              ))}
            </span>
          </div>
          <div className="time-presets" role="group" aria-label="목표 시간" style={{ ["--category" as string]: PALETTE[state.categories.length % PALETTE.length] }}>
            {GOAL_PRESETS[goalType].map((minutes) => (
              <button key={minutes} type="button" className={`time-preset${goal === minutes ? " selected" : ""}`} aria-pressed={goal === minutes} onClick={() => setGoal(minutes)}>
                {formatMinutes(minutes)}
              </button>
            ))}
            <label className="time-custom">
              <input type="number" inputMode="numeric" min={0} max={goalType === "weekly" ? 5040 : 720} value={goal} aria-label="직접 입력(분)" onChange={(event) => setGoal(Number(event.target.value))} />
              <span>분</span>
            </label>
          </div>

          <button className="button full" type="submit" value="default">
            {state.assignments.length < 4 ? `${state.assignments.length + 1}번 버튼에 추가` : "목표 추가"}
          </button>
        </form>
      )}
    </dialog>
  );
}
