import { useEffect, useRef } from "react";

/* The toast is a non-modal <dialog>, so it keeps its stylesheet position and
   stays out of the modal stack that the completion dialog checks. */
export function Toast({ message }: { message: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (message && !dialog.open) dialog.show();
    if (!message && dialog.open) dialog.close();
  }, [message]);

  return (
    <dialog className="toast" ref={ref} aria-live="polite">
      <p>{message}</p>
    </dialog>
  );
}
