import { useEffect, useRef } from "react";

import { speak } from "../companion/speech.ts";
import { countdown } from "../domain/goal.ts";
import type { AppState, Category } from "../domain/types.ts";

const OVERTIME_EVERY_MS = 5 * 60_000;

/* Playful, never scolding: the toy is curious why the session is still going. */
const OVERTIME_LINES = [
  "다 채웠는데 왜 안 끝났어? 더 할 거야?",
  "목표는 넘었어. 끝 버튼 기억하지?",
  "아직도 하는 거야? 나는 좋아, 근데 쉬어도 돼.",
];

interface GoalVoiceOptions {
  state: AppState;
  category: Category | undefined;
  tick: number;
  voiceOn: boolean;
  onReached: (category: Category) => void;
}

/**
 * Speaks once when the goal drains to zero during a session, then again every
 * five minutes of overtime until the session ends. Both are keyed to the
 * session id, so a new session starts the count over.
 */
export function useGoalVoice({ state, category, tick, voiceOn, onReached }: GoalVoiceOptions): void {
  const sessionId = state.activeSession?.id ?? null;
  const reachedFor = useRef<string | null>(null);
  const overtimeSpoken = useRef(0);

  useEffect(() => {
    if (!sessionId || !category) {
      reachedFor.current = null;
      overtimeSpoken.current = 0;
      return;
    }
    const clock = countdown(state, category);
    if (!clock.hasGoal || clock.remainingMs > 0) return;

    if (reachedFor.current !== sessionId) {
      reachedFor.current = sessionId;
      overtimeSpoken.current = 0;
      if (voiceOn) speak("다 채웠어! 멋지다.", { pitch: 1.3 });
      onReached(category);
      return;
    }
    const due = Math.floor(clock.overMs / OVERTIME_EVERY_MS);
    if (due > overtimeSpoken.current) {
      overtimeSpoken.current = due;
      const line = OVERTIME_LINES[(due - 1) % OVERTIME_LINES.length] ?? OVERTIME_LINES[0]!;
      if (voiceOn) speak(line, { pitch: 1.25 });
    }
  }, [state, category, tick, voiceOn, sessionId, onReached]);
}
