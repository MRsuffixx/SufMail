"use client";

import { useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useWindowStore, useUIStore } from "~/stores";
import { Window } from "./Window";

export function WindowManager() {
  const { windows, activeWindowId, setActiveWindow } = useWindowStore();
  const { focusModeEnabled } = useUIStore();

  const handleWindowClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-window]")) return;
      setActiveWindow(null);
    },
    [setActiveWindow]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeWindowId) {
        setActiveWindow(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeWindowId, setActiveWindow]);

  const visibleWindows = Array.from(windows.values()).filter((w) => !w.isMinimized);
  const sortedWindows = [...visibleWindows].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      onClick={handleWindowClick}
    >
      <AnimatePresence>
        {sortedWindows.map((windowConfig) => (
          <div key={windowConfig.id} data-window data-window-id={windowConfig.id}>
            <Window config={windowConfig} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}