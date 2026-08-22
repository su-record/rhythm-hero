import { useCallback, useMemo, useState } from "react";

/** One owner for every dialog, so two can never claim the modal stack at once. */
export function useDialogState() {
  const [active4Open, setActive4Open] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completionId, setCompletionId] = useState<string | null>(null);

  const closeAll = useCallback(() => {
    setActive4Open(false);
    setRecordOpen(false);
    setDeviceOpen(false);
    setCategoryEditorOpen(false);
    setDetailCategoryId(null);
    setSessionId(null);
  }, []);

  const openCategoryEditor = useCallback((id: string | null) => {
    setEditingCategoryId(id);
    setCategoryEditorOpen(true);
  }, []);

  return useMemo(() => ({
    active4Open, recordOpen, deviceOpen, categoryEditorOpen,
    editingCategoryId, detailCategoryId, sessionId, completionId,
    openActive4: () => setActive4Open(true),
    closeActive4: () => setActive4Open(false),
    openRecord: () => setRecordOpen(true),
    closeRecord: () => setRecordOpen(false),
    openDevice: () => setDeviceOpen(true),
    closeDevice: () => setDeviceOpen(false),
    openDetail: (id: string) => setDetailCategoryId(id),
    closeDetail: () => setDetailCategoryId(null),
    openSession: (id: string) => setSessionId(id),
    closeSession: () => setSessionId(null),
    openCompletion: (id: string) => setCompletionId(id),
    closeCompletion: () => setCompletionId(null),
    openCategoryEditor,
    closeCategoryEditor: () => {
      setCategoryEditorOpen(false);
      setEditingCategoryId(null);
    },
    closeAll,
  }), [active4Open, recordOpen, deviceOpen, categoryEditorOpen, editingCategoryId, detailCategoryId, sessionId, completionId, openCategoryEditor, closeAll]);
}

export type DialogState = ReturnType<typeof useDialogState>;
