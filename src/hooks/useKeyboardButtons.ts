import { useEffect } from "react";

/* Keys 1–4 simulate the hardware buttons, but must stay inert while the user is
   typing, while a dialog is open, or when they are part of a browser shortcut. */
export function useKeyboardButtons(pressButton: (index: number) => void): void {
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLElement && (target.matches("input, select, textarea") || target.isContentEditable);
      if (editing || document.querySelector("dialog[open]") || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key >= "1" && event.key <= "4") pressButton(Number(event.key));
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [pressButton]);
}
