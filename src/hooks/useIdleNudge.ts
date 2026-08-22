import { useCallback, useEffect, useRef, useState } from "react";

import { checkIdle, nudgeFacts, pickNudgeLine } from "../domain/idle.ts";
import { requestCompanionLine } from "../sync/companionApi.ts";
import type { AppState } from "../domain/types.ts";

const POLL_MS = 30_000;

export interface Nudge {
  line: string;
  at: number;
}

/**
 * Speaks once per quiet stretch. The key is the anchor the idle check used
 * (last session end or the day), so a new record re-arms it and a long
 * silence never turns into repeated nagging.
 */
export function useIdleNudge(state: AppState, onNudge: (line: string) => void): {
  nudge: Nudge | null;
  dismiss: () => void;
  trigger: () => void;
} {
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const spokenFor = useRef<string | null>(null);
  const latest = useRef({ state, onNudge });
  latest.current = { state, onNudge };

  const fire = useCallback((force: boolean) => {
    const { state: current, onNudge: notify } = latest.current;
    const now = new Date();
    if (!current.profile) return;              // nobody to talk to yet
    const check = checkIdle(current, current.companion, now);
    if (!force && !check.idle) return;
    const anchor = `${now.toDateString()}:${current.sessions.filter((session) => session.status === "completed").length}`;
    if (!force && spokenFor.current === anchor) return;
    spokenFor.current = anchor;
    const fallback = pickNudgeLine(current, check, now);
    const facts = nudgeFacts(current, check, now);
    const stamp = now.getTime();
    // Show the template at once; swap in the model's line if it arrives and is sound.
    setNudge({ line: fallback, at: stamp });
    const deliver = (line: string) => {
      setNudge((existing) => (existing && existing.at === stamp ? { line, at: stamp } : existing));
      notify(line);
    };
    if (!facts) return deliver(fallback);
    void requestCompanionLine(facts).then((result) => deliver(result.kind === "created" ? result.line : fallback));
  }, []);

  useEffect(() => {
    fire(false);
    const timer = setInterval(() => fire(false), POLL_MS);
    return () => clearInterval(timer);
  }, [fire]);

  // Any new record ends the quiet stretch and clears the bubble.
  const completedCount = state.sessions.filter((session) => session.status === "completed").length;
  const running = Boolean(state.activeSession);
  useEffect(() => {
    if (running) setNudge(null);
  }, [running, completedCount]);

  return {
    nudge,
    dismiss: useCallback(() => setNudge(null), []),
    trigger: useCallback(() => fire(true), [fire]),
  };
}
