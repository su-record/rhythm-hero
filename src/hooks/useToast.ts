import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 2400;

export function useToast(): { message: string; showToast: (message: string) => void } {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((next: string) => {
    setMessage(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { message, showToast };
}
