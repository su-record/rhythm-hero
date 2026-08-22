/** Collapses a burst of state changes into one remote write. */
export function createDebouncer(delayMs: number): {
  schedule: (task: () => void) => void;
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    schedule(task) {
      clearTimeout(timer);
      timer = setTimeout(task, delayMs);
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
