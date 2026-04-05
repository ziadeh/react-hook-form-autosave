import { useEffect } from "react";

/**
 * Shows a browser confirmation dialog when the user tries to close/reload the tab
 * while there are unsaved changes.
 */
export function useBeforeUnload(shouldBlock: boolean): void {
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);
}
