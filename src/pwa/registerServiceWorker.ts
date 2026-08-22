/* One reload per controller change: a second would loop when the worker
   activates again during the reload itself. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  void navigator.serviceWorker
    .register("sw.js", { updateViaCache: "none" })
    .then((registration) => registration.update())
    .catch(() => {});
}
