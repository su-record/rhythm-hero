import { useCallback, useEffect, useRef, useState } from "react";

import { formatMinutes } from "../domain/format.ts";
import { categoryById } from "../domain/stats.ts";
import { durationMs } from "../domain/time.ts";
import type { AppState, Session } from "../domain/types.ts";
import type { PromptCopy } from "../components/PostSessionPrompt.tsx";

const PROMPT_TIMEOUT_MS = 9000;

function copyFor(state: AppState, session: Session, pendingCount: number): PromptCopy {
  if (pendingCount > 1) {
    return {
      title: `메모를 기다리는 기록 ${pendingCount}개`,
      meta: "최근 기록부터 한 줄씩 남길 수 있어요.",
      action: "한 줄씩",
    };
  }
  const category = categoryById(state, session.categoryId);
  const running = state.activeSession ? categoryById(state, state.activeSession.categoryId) : null;
  return {
    title: `${category?.name || "기록"} ${formatMinutes(durationMs(session) / 60_000)} 완료`,
    meta: running ? `${running.name} 기록은 계속 진행 중이에요.` : "지금 떠오르는 걸 한 줄로 남겨보세요.",
    action: "메모",
  };
}

interface PromptController {
  copy: PromptCopy | null;
  show: (sessionId: string) => void;
  hide: () => void;
  write: () => void;
}

/** The transient "you just finished" nudge; the completion dialog always wins. */
export function usePostSessionPrompt(
  state: AppState,
  pending: Session[],
  completionOpen: boolean,
  onWrite?: (sessionId: string) => void,
): PromptController {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setSessionId(null);
  }, []);

  const show = useCallback((id: string) => {
    setSessionId(id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSessionId(null), PROMPT_TIMEOUT_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (completionOpen || !pending.length) hide();
  }, [completionOpen, pending.length, hide]);

  const session = pending.find((item) => item.id === sessionId) ?? null;
  const write = useCallback(() => {
    const target = sessionId ?? pending[0]?.id;
    hide();
    if (target) onWrite?.(target);
  }, [sessionId, pending, hide, onWrite]);

  return {
    copy: session && !completionOpen ? copyFor(state, session, pending.length) : null,
    show,
    hide,
    write,
  };
}
