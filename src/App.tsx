import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getReflectionReport } from "./domain/reflection.ts";
import { applyActiveAssignments, placeCategoryInSlot } from "./domain/state.ts";
import { categoryById, pendingMemoSessions } from "./domain/stats.ts";
import { localDateInput } from "./domain/time.ts";
import type { Category, PeriodRange, Session } from "./domain/types.ts";
import * as actions from "./store/actions.ts";
import { commit, commitWith } from "./store/appStore.ts";
import { useAppState } from "./store/useAppState.ts";
import { installHabitToyBridge } from "./bridge/habitToy.ts";
import { useRemoteSync } from "./sync/useRemoteSync.ts";
import { requestAiReflection } from "./sync/reflectionApi.ts";
import { useSerialDevice } from "./device/useSerialDevice.ts";
import { useInstallPrompt } from "./pwa/useInstallPrompt.ts";
import { useDialogState } from "./hooks/useDialogState.ts";
import { useKeyboardButtons } from "./hooks/useKeyboardButtons.ts";
import { useTicker } from "./hooks/useTicker.ts";
import { useToast } from "./hooks/useToast.ts";
import { useIdleNudge } from "./hooks/useIdleNudge.ts";
import { primeSpeech, speak, stopSpeaking } from "./companion/speech.ts";
import { usePostSessionPrompt } from "./hooks/usePostSessionPrompt.ts";
import { BottomNav } from "./components/BottomNav.tsx";
import { NowCard } from "./components/NowCard.tsx";
import { PostSessionPrompt } from "./components/PostSessionPrompt.tsx";
import { Toast } from "./components/Toast.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { Active4Dialog } from "./dialogs/Active4Dialog.tsx";
import { CategoryDetailDialog } from "./dialogs/CategoryDetailDialog.tsx";
import { CategoryDialog } from "./dialogs/CategoryDialog.tsx";
import { CompletionDialog } from "./dialogs/CompletionDialog.tsx";
import { DeviceDialog } from "./dialogs/DeviceDialog.tsx";
import { ProfileDialog } from "./dialogs/ProfileDialog.tsx";
import { RecordDialog } from "./dialogs/RecordDialog.tsx";
import { SessionDialog } from "./dialogs/SessionDialog.tsx";
import { HistoryView } from "./views/HistoryView.tsx";
import { ReflectionView } from "./views/ReflectionView.tsx";
import { SettingsView } from "./views/SettingsView.tsx";
import { TodayView } from "./views/TodayView.tsx";
import type { TabId } from "./types.ts";

export function App() {
  const state = useAppState();
  const [tab, setTab] = useState<TabId>("today");
  const [aiPending, setAiPending] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const profileOpen = state.profile === null || profileEditing;
  const nowCard = useRef<HTMLElement>(null);
  const { message, showToast } = useToast();
  const syncStatus = useRemoteSync();
  const install = useInstallPrompt();
  const dialogs = useDialogState();
  const tick = useTicker(Boolean(state.activeSession));

  const pending = useMemo(() => pendingMemoSessions(state), [state]);
  const activeCategory = state.activeSession ? categoryById(state, state.activeSession.categoryId) : undefined;

  const openCompletion = useCallback((session: Session) => dialogs.openCompletion(session.id), [dialogs]);
  const prompt = usePostSessionPrompt(state, pending, dialogs.completionId !== null, dialogs.openCompletion);

  const switchTab = useCallback((next: TabId) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const revealActiveSession = useCallback((category: Category) => {
    dialogs.closeAll();
    switchTab("today");
    requestAnimationFrame(() => {
      nowCard.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      nowCard.current?.focus({ preventScroll: true });
    });
    showToast(`${category.name} 기록이 이미 진행 중이에요.`);
  }, [dialogs, switchTab, showToast]);

  const pressButton = useCallback((index: number) => {
    const outcome = commitWith((current) => {
      const result = actions.pressButton(current, index);
      return { state: result.state, result: result.outcome };
    });
    if (outcome.kind === "unassigned") return showToast("아직 연결되지 않은 버튼이에요.");
    if (outcome.kind === "started") return showToast(`${outcome.category.name} 기록을 시작했어요.`);
    if (outcome.kind === "stopped") return openCompletion(outcome.session);
    prompt.show(outcome.session.id);
  }, [showToast, openCompletion, prompt]);

  useKeyboardButtons(pressButton);
  const serial = useSerialDevice(pressButton);

  // The toy speaks, the phone voices it, the board breathes its LEDs.
  const serialNudge = serial.nudge;
  const voiceOn = state.companion.voice;
  const companion = useIdleNudge(state, useCallback((line: string) => {
    if (voiceOn) speak(line);
    serialNudge(true);
  }, [voiceOn, serialNudge]));
  const companionActive = companion.nudge !== null;
  useEffect(() => {
    if (!companionActive) {
      stopSpeaking();
      serialNudge(false);
    }
  }, [companionActive, serialNudge]);
  useEffect(() => {
    const prime = () => primeSpeech();
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);

  useEffect(() => installHabitToyBridge(pressButton), [pressButton]);

  const stopSession = useCallback(() => {
    const completed = commitWith((current) => {
      const result = actions.stopSession(current);
      return { state: result.state, result: result.completedSession };
    });
    if (completed) openCompletion(completed);
  }, [openCompletion]);

  const settleMemo = useCallback((memo: string, captureState: "saved" | "skipped") => {
    const sessionId = dialogs.completionId;
    if (!sessionId) return;
    commit((current) => actions.settleMemo(current, sessionId, memo, captureState));
    dialogs.closeCompletion();
    showToast(captureState === "saved" ? "한 줄 메모까지 저장했어요." : "시간 기록을 저장했어요.");
  }, [dialogs, showToast]);

  const startFromApp = useCallback((categoryId: string) => {
    dialogs.closeRecord();
    const outcome = commitWith((current) => {
      const result = actions.startSession(current, categoryId, "app");
      return { state: result.state, result };
    });
    if (outcome.started) showToast(`${outcome.started.name} 기록을 시작했어요.`);
    else if (outcome.alreadyRunning) revealActiveSession(outcome.alreadyRunning);
  }, [dialogs, showToast, revealActiveSession]);

  const saveAssignments = useCallback((assignments: string[]) => {
    if (state.activeSession) return showToast("진행 중인 기록을 먼저 종료해주세요.");
    commit((current) => applyActiveAssignments(current, assignments));
    dialogs.closeActive4();
    showToast("나의 네 가지를 변경했어요. 이전 기록은 그대로 유지됩니다.");
  }, [state.activeSession, dialogs, showToast]);

  const assignSlot = useCallback((slot: number, categoryId: string) => {
    if (state.activeSession) return showToast("진행 중인 기록을 종료한 뒤 나의 네 가지를 변경해주세요.");
    commit((current) => applyActiveAssignments(current, placeCategoryInSlot(current.assignments, slot, categoryId)));
    showToast("버튼 배치를 저장했어요.");
  }, [state.activeSession, showToast]);

  const addDetailToActive4 = useCallback((slot: number) => {
    const category = dialogs.detailCategoryId ? categoryById(state, dialogs.detailCategoryId) : undefined;
    if (!category || state.assignments.includes(category.id)) return;
    if (state.activeSession) return showToast("진행 중인 기록을 종료한 뒤 나의 네 가지를 변경해주세요.");
    const previous = categoryById(state, state.assignments[slot] ?? "");
    commit((current) => applyActiveAssignments(current, placeCategoryInSlot(current.assignments, slot, category.id)));
    dialogs.closeDetail();
    showToast(`${category.name}을 ${slot + 1}번 버튼에 연결했어요. ${previous?.name ?? ""} 기록은 유지됩니다.`);
  }, [state, dialogs, showToast]);

  const saveCategory = useCallback((draft: actions.CategoryDraft, editingId: string | null) => {
    commit((current) => actions.upsertCategory(current, draft, editingId).state);
    dialogs.closeCategoryEditor();
    showToast(editingId ? `${draft.name} 활동을 수정했어요.` : `${draft.name} 활동을 추가했어요.`);
  }, [dialogs, showToast]);

  const archiveCategory = useCallback((id: string) => {
    const category = categoryById(state, id);
    if (!category) return;
    if (category.status !== "archived" && state.assignments.includes(id)) {
      return showToast("나의 네 가지에서 먼저 다른 활동으로 바꿔주세요.");
    }
    commit((current) => actions.toggleArchiveCategory(current, id));
    showToast(`${category.name}을 ${category.status === "archived" ? "복원" : "보관"}했어요.`);
  }, [state, showToast]);

  const exportData = useCallback(() => {
    const payload = { exportedAt: new Date().toISOString(), product: "Rhythm Hero", data: state };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `rhythm-hero-${localDateInput(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("데이터를 내보냈어요.");
  }, [state, showToast]);

  const createAiReflection = useCallback(async () => {
    const report = getReflectionReport(state);
    if (!report.current.sessionCount) return showToast("완료된 기록이 생기면 AI 돌아보기를 만들 수 있어요.");
    setAiPending(true);
    const result = await requestAiReflection(report);
    setAiPending(false);
    if (result.kind === "created") {
      commit((current) => actions.setAiReflection(current, result.reflection));
      showToast("AI 돌아보기를 만들었어요.");
      return;
    }
    showToast(result.kind === "missing-key"
      ? "API 키를 설정하면 AI 돌아보기를 만들 수 있어요."
      : "AI 돌아보기를 만들지 못했어요. 기록 기반 내용은 계속 볼 수 있어요.");
  }, [state, showToast]);

  const connectSerial = useCallback(async () => {
    const result = await serial.connect();
    if (result === "unsupported") return showToast("이 브라우저는 USB Serial을 지원하지 않아요. Chrome에서 열어주세요.");
    if (result === "failed") return showToast("USB 기기 연결에 실패했어요.");
    if (result === "connected") showToast("Rhythm Hero USB 보드를 연결했어요.");
  }, [serial, showToast]);

  const openNextPendingMemo = useCallback(() => {
    const next = pending[0];
    if (next) openCompletion(next);
  }, [pending, openCompletion]);

  const sessionUnderEdit = state.sessions.find((session) => session.id === dialogs.sessionId) ?? null;
  const completionSession = state.sessions.find((session) => session.id === dialogs.completionId) ?? null;

  return (
    <>
      <main className="app-shell">
        <TopBar
          syncStatus={syncStatus}
          deviceConnected={serial.connected}
          onOpenDevice={dialogs.openDevice}
          onHome={() => switchTab("today")}
        />
        <NowCard ref={nowCard} session={state.activeSession} category={activeCategory} onStop={stopSession} />

        <TodayView
          state={state}
          active={tab === "today"}
          tick={tick}
          pendingMemos={pending}
          companionLine={companion.nudge?.line ?? null}
          onDismissCompanion={companion.dismiss}
          onPokeCompanion={companion.trigger}
          onPressButton={pressButton}
          onManualStart={() => (activeCategory ? revealActiveSession(activeCategory) : dialogs.openRecord())}
          onWriteMemo={openNextPendingMemo}
          onEditGoals={() => switchTab("settings")}
          onEditActive4={() => (state.activeSession
            ? showToast("진행 중인 기록을 종료한 뒤 나의 네 가지를 편집해주세요.")
            : dialogs.openActive4())}
        />
        <HistoryView
          state={state}
          active={tab === "history"}
          pendingMemoCount={pending.length}
          onSelectRange={(range: PeriodRange) => commit((current) => actions.setHistoryRange(current, range))}
          onOpenSession={dialogs.openSession}
          onOpenCategory={dialogs.openDetail}
          onReviewMemos={openNextPendingMemo}
        />
        <ReflectionView
          state={state}
          active={tab === "reflections"}
          aiPending={aiPending}
          onSelectRange={(range: PeriodRange) => commit((current) => actions.setReflectionRange(current, range))}
          onRequestAi={() => void createAiReflection()}
        />
        <SettingsView
          state={state}
          active={tab === "settings"}
          deviceConnected={serial.connected}
          installState={install.state}
          onInstall={() => void install.install().then((outcome) => {
            if (outcome !== "accepted") showToast("설치를 취소했어요. 설정에서 다시 추가할 수 있어요.");
          })}
          onVoiceChange={(voice) => commit((current) => actions.setCompanion(current, { voice }))}
          onIdleMinutesChange={(idleMinutes) => commit((current) => actions.setCompanion(current, { idleMinutes }))}
          onTestCompanion={() => {
            switchTab("today");
            companion.trigger();
          }}
          onEditProfile={() => setProfileEditing(true)}
          onAssign={assignSlot}
          onGoalChange={(id, goal) => {
            commit((current) => actions.setCategoryGoal(current, id, goal));
            showToast(`${categoryById(state, id)?.name ?? ""} 목표를 저장했어요.`);
          }}
          onWeeklyGoalChange={(id, goal) => {
            commit((current) => actions.setCategoryWeeklyGoal(current, id, goal));
            showToast(`${categoryById(state, id)?.name ?? ""} 주간 목표를 저장했어요.`);
          }}
          onEditCategory={dialogs.openCategoryEditor}
          onArchiveCategory={archiveCategory}
          onAddCategory={() => dialogs.openCategoryEditor(null)}
          onRestoreSession={(id) => {
            commit((current) => actions.restoreSession(current, id));
            showToast("기록을 복구했어요.");
          }}
          onOpenDevice={dialogs.openDevice}
          onTestHardware={() => {
            switchTab("today");
            setTimeout(() => pressButton(1), 250);
          }}
          onExport={exportData}
          onResetDemo={() => {
            commit((current) => actions.resetDemo(current));
            showToast("데모 데이터를 다시 불러왔어요.");
          }}
        />
      </main>

      <BottomNav tab={tab} runningCategoryName={activeCategory?.name ?? null} profile={state.profile} onSelect={switchTab} />

      <PostSessionPrompt copy={prompt.copy} onWrite={prompt.write} onDismiss={prompt.hide} />

      <ProfileDialog
        open={profileOpen}
        current={state.profile}
        onClose={() => setProfileEditing(false)}
        onSave={(profile) => {
          const firstRun = state.profile === null;
          commit((current) => actions.setProfile(current, profile));
          setProfileEditing(false);
          showToast(firstRun ? `${profile.name}, 반가워요. ${profile.toyName}가 기다리고 있어요.` : "바꿨어요.");
        }}
      />
      <Active4Dialog state={state} open={dialogs.active4Open} onClose={dialogs.closeActive4} onSave={saveAssignments} />
      <RecordDialog state={state} open={dialogs.recordOpen} onClose={dialogs.closeRecord} onStart={startFromApp} />
      <CategoryDetailDialog
        state={state}
        category={dialogs.detailCategoryId ? categoryById(state, dialogs.detailCategoryId) ?? null : null}
        onClose={dialogs.closeDetail}
        onEdit={(id) => {
          dialogs.closeDetail();
          dialogs.openCategoryEditor(id);
        }}
        onAddToActive4={addDetailToActive4}
      />
      <SessionDialog
        state={state}
        session={sessionUnderEdit}
        onClose={dialogs.closeSession}
        onSave={(id, edit) => {
          commit((current) => actions.editSession(current, id, edit));
          dialogs.closeSession();
          showToast("기록을 수정했어요.");
        }}
        onDelete={(id) => {
          commit((current) => actions.deleteSession(current, id));
          dialogs.closeSession();
          showToast("기록을 삭제했어요. 30일 안에 복구할 수 있어요.");
        }}
        onInvalid={() => showToast("날짜와 시간을 다시 확인해주세요.")}
      />
      <CompletionDialog
        state={state}
        session={completionSession}
        onClose={dialogs.closeCompletion}
        onSettle={settleMemo}
        onLater={() => {
          dialogs.closeCompletion();
          showToast("시간은 저장했어요. 메모는 나중에 남길 수 있어요.");
        }}
      />
      <CategoryDialog
        state={state}
        open={dialogs.categoryEditorOpen}
        editing={dialogs.editingCategoryId ? categoryById(state, dialogs.editingCategoryId) ?? null : null}
        onClose={dialogs.closeCategoryEditor}
        onSave={saveCategory}
      />
      <DeviceDialog
        open={dialogs.deviceOpen}
        connected={serial.connected}
        onClose={dialogs.closeDevice}
        onConnect={() => void connectSerial()}
        onDisconnect={() => void serial.disconnect().then(() => showToast("USB 기기 연결을 해제했어요."))}
      />
      <Toast message={message} />
    </>
  );
}
