import { useEffect, useState } from "react";

/** Ticks only while something is running, and only where elapsed time is shown. */
export function useTicker(active: boolean, intervalMs = 1000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);

  return tick;
}
