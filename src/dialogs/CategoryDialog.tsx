import { useEffect, useRef, useState } from "react";

import { safeColor } from "../domain/format.ts";
import { isDuplicateCategoryName } from "../domain/state.ts";
import { GOAL_TYPE_LABEL } from "../domain/goal.ts";
import type { AppState, Category, GoalType } from "../domain/types.ts";
import type { CategoryDraft } from "../store/actions.ts";
import { useDialog } from "../hooks/useDialog.ts";

interface CategoryDialogProps {
  state: AppState;
  open: boolean;
  editing: Category | null;
  onClose: () => void;
  onSave: (draft: CategoryDraft, editingId: string | null) => void;
}

const MAX_NAME_LENGTH = 20;
const DEFAULT_COLOR = "#F1A75B";
const DEFAULT_GOAL: Record<GoalType, string> = { daily: "30", weekly: "150" };

function validate(state: AppState, name: string, editingId: string | null): string {
  if (!name) return "활동 이름을 입력해주세요.";
  if (name.length > MAX_NAME_LENGTH) return `활동 이름은 ${MAX_NAME_LENGTH}자 이하로 입력해주세요.`;
  if (isDuplicateCategoryName(state, name, editingId)) return "같은 이름의 활동이 이미 있어요.";
  return "";
}

export function CategoryDialog({ state, open, editing, onClose, onSave }: CategoryDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [goalType, setGoalType] = useState<GoalType>("daily");
  const [goal, setGoal] = useState(DEFAULT_GOAL.daily);
  const [error, setError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const ref = useDialog(open, onClose);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setColor(editing ? safeColor(editing.color) : DEFAULT_COLOR);
    const type: GoalType = editing?.goalType === "weekly" ? "weekly" : "daily";
    setGoalType(type);
    setGoal(editing ? String(Math.max(0, Number(editing.goal) || 0)) : DEFAULT_GOAL[type]);
    setError("");
    const frame = requestAnimationFrame(() => {
      nameInput.current?.focus();
      nameInput.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, editing]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !== "default") return;
    event.preventDefault();
    const trimmed = name.trim();
    const message = validate(state, trimmed, editing?.id ?? null);
    setError(message);
    if (message) {
      nameInput.current?.focus();
      return;
    }
    onSave({ name: trimmed, color, goal: Number(goal), goalType }, editing?.id ?? null);
  };

  return (
    <dialog ref={ref} aria-labelledby="category-dialog-title">
      <form method="dialog" onSubmit={submit}>
        <div className="dialog-header">
          <div>
            <p className="eyebrow">{editing ? "활동 편집" : "새 활동"}</p>
            <h2 id="category-dialog-title">{editing ? `${editing.name}을 다듬으세요` : "남기고 싶은 시간을 추가하세요"}</h2>
          </div>
          <button className="icon-button" value="cancel" type="submit" formNoValidate aria-label="닫기">×</button>
        </div>
        <label>
          이름
          <input
            ref={nameInput}
            type="text"
            maxLength={MAX_NAME_LENGTH}
            aria-describedby="category-name-error"
            aria-invalid={Boolean(error)}
            placeholder="예: 영어"
            value={name}
            onChange={(event) => {
              setError("");
              setName(event.target.value);
            }}
          />
        </label>
        <p className="field-error" id="category-name-error" role="alert" aria-live="polite" hidden={!error}>{error}</p>
        <label>색상<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
        <fieldset className="goal-type">
          <legend>목표 단위</legend>
          <div className="segmented" role="group" aria-label="목표 단위">
            {(["daily", "weekly"] as GoalType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={goalType === type ? "selected" : undefined}
                aria-pressed={goalType === type}
                onClick={() => {
                  setGoalType(type);
                  if (!editing || editing.goalType !== type) setGoal(DEFAULT_GOAL[type]);
                }}
              >
                {GOAL_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          {goalType === "weekly" ? "한 주 목표(분)" : "하루 목표(분)"} <span>0이면 없음</span>
          <input type="number" min={0} max={goalType === "weekly" ? 5040 : 720} step={goalType === "weekly" ? 10 : 5} value={goal} onChange={(event) => setGoal(event.target.value)} />
        </label>
        <button className="button full" value="default" type="submit">{editing ? "변경사항 저장" : "활동 추가"}</button>
      </form>
    </dialog>
  );
}
