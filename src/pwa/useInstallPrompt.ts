import { useCallback, useEffect, useState } from "react";

export type InstallState = "hidden" | "ready" | "ios" | "installed" | "dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || Reflect.get(navigator, "standalone") === true;
}

/* Safari on iOS never fires beforeinstallprompt, so it only gets the manual
   route; navigator.standalone is false there and undefined everywhere else. */
function isIosSafariTab(): boolean {
  return Reflect.get(navigator, "standalone") === false;
}

export function useInstallPrompt(): { state: InstallState; install: () => Promise<"accepted" | "dismissed"> } {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };
    const handleInstalled = () => {
      setDeferred(null);
      setDismissed(false);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return "dismissed" as const;
    setDeferred(null);
    try {
      void deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDismissed(outcome !== "accepted");
      return outcome;
    } catch {
      setDismissed(true);
      return "dismissed" as const;
    }
  }, [deferred]);

  const state: InstallState = installed ? "installed" : deferred ? "ready" : dismissed ? "dismissed" : isIosSafariTab() ? "ios" : "hidden";
  return { state, install };
}
