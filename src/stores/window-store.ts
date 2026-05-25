import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WindowConfig, WindowType, WindowPosition, WindowSize, WindowState } from "~/types/ui";
import { generateId } from "~/lib/ui/utils";

interface WindowStore {
  windows: Map<string, WindowConfig>;
  activeWindowId: string | null;
  nextZIndex: number;

  openWindow: (
    type: WindowType,
    title: string,
    data?: Record<string, unknown>,
    size?: Partial<WindowSize>,
    position?: Partial<WindowPosition>
  ) => string;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: WindowPosition) => void;
  updateWindowSize: (id: string, size: WindowSize) => void;
  updateWindowState: (id: string, state: WindowState) => void;
  getWindow: (id: string) => WindowConfig | undefined;
  getWindowsByType: (type: WindowType) => WindowConfig[];
  setActiveWindow: (id: string | null) => void;
  bringToFront: (id: string) => void;
  closeAllWindows: () => void;
  getPersistentState: () => WindowConfig[];
  restoreState: (windows: WindowConfig[]) => void;
}

const DEFAULT_WINDOW_SIZE: WindowSize = { width: 800, height: 600 };
const MIN_WINDOW_SIZE: WindowSize = { width: 400, height: 300 };

export const useWindowStore = create<WindowStore>()(
  persist(
    (set, get) => ({
      windows: new Map(),
      activeWindowId: null,
      nextZIndex: 100,

      openWindow: (type, title, data = {}, size = {}, position = {}) => {
        const id = generateId();
        const currentWindows = get().windows;

        const existingWindow = Array.from(currentWindows.values()).find(
          (w) => w.type === type && !w.isMinimized
        );
        if (existingWindow) {
          get().focusWindow(existingWindow.id);
          return existingWindow.id;
        }

        const windowSize: WindowSize = {
          width: size.width ?? DEFAULT_WINDOW_SIZE.width,
          height: size.height ?? DEFAULT_WINDOW_SIZE.height,
        };

        const offset = currentWindows.size * 30;
        const defaultPosition: WindowPosition = {
          x: 100 + offset,
          y: 100 + offset,
        };

        const windowConfig: WindowConfig = {
          id,
          type,
          title,
          position: {
            x: position.x ?? defaultPosition.x,
            y: position.y ?? defaultPosition.y,
          },
          size: windowSize,
          state: "normal",
          zIndex: get().nextZIndex,
          data,
        };

        set((state) => {
          const newWindows = new Map(state.windows);
          newWindows.set(id, windowConfig);
          return {
            windows: newWindows,
            activeWindowId: id,
            nextZIndex: state.nextZIndex + 1,
          };
        });

        return id;
      },

      closeWindow: (id) => {
        set((state) => {
          const newWindows = new Map(state.windows);
          newWindows.delete(id);

          let newActiveId = state.activeWindowId;
          if (state.activeWindowId === id) {
            const windowArray = Array.from(newWindows.values());
            const lastWindow = windowArray[windowArray.length - 1];
            newActiveId = lastWindow ? lastWindow.id : null;
          }

          return {
            windows: newWindows,
            activeWindowId: newActiveId,
          };
        });
      },

      minimizeWindow: (id) => {
        set((state) => {
          const window = state.windows.get(id);
          if (!window) return state;

          const newWindows = new Map(state.windows);
          newWindows.set(id, { ...window, isMinimized: true });

          let newActiveId = state.activeWindowId;
          if (state.activeWindowId === id) {
            const otherWindows = Array.from(newWindows.values()).filter(
              (w) => !w.isMinimized
            );
            const lastWindow = otherWindows[otherWindows.length - 1];
            newActiveId = lastWindow ? lastWindow.id : null;
          }

          return { windows: newWindows, activeWindowId: newActiveId };
        });
      },

      maximizeWindow: (id) => {
        set((state) => {
          const window = state.windows.get(id);
          if (!window) return state;

          const newWindows = new Map(state.windows);
          newWindows.set(id, { ...window, state: "maximized" });

          return { windows: newWindows };
        });
      },

      restoreWindow: (id) => {
        set((state) => {
          const window = state.windows.get(id);
          if (!window) return state;

          const newWindows = new Map(state.windows);
          newWindows.set(id, { ...window, state: "normal", isMinimized: false });

          return { windows: newWindows, activeWindowId: id };
        });
      },

      focusWindow: (id) => {
        const window = get().windows.get(id);
        if (!window || window.isMinimized) return;

        set((state) => {
          const newZIndex = state.nextZIndex + 1;
          const updatedWindows = new Map<string, WindowConfig>();
          for (const [wid, w] of state.windows) {
            updatedWindows.set(wid, wid === id ? { ...w, zIndex: newZIndex } : w);
          }
          return {
            activeWindowId: id,
            nextZIndex: newZIndex,
            windows: updatedWindows,
          };
        });
      },

      bringToFront: (id) => {
        const window = get().windows.get(id);
        if (!window) return;

        set((state) => {
          const newWindows = new Map(state.windows);
          newWindows.set(id, { ...window, zIndex: state.nextZIndex });

          return {
            windows: newWindows,
            nextZIndex: state.nextZIndex + 1,
          };
        });
      },

      updateWindowPosition: (id, position) => {
        set((state) => {
          const window = state.windows.get(id);
          if (!window) return state;

          const newWindows = new Map(state.windows);
          newWindows.set(id, { ...window, position });
          return { windows: newWindows };
        });
      },

      updateWindowSize: (id, size) => {
        set((state) => {
          const window = state.windows.get(id);
          if (!window) return state;

          const constrainedSize: WindowSize = {
            width: Math.max(size.width, MIN_WINDOW_SIZE.width),
            height: Math.max(size.height, MIN_WINDOW_SIZE.height),
          };

          const newWindows = new Map(state.windows);
          newWindows.set(id, { ...window, size: constrainedSize });
          return { windows: newWindows };
        });
      },

      updateWindowState: (id, newState) => {
        set((state) => {
          const window = state.windows.get(id);
          if (!window) return state;

          const newWindows = new Map(state.windows);
          newWindows.set(id, { ...window, state: newState });
          return { windows: newWindows };
        });
      },

      getWindow: (id) => get().windows.get(id),

      getWindowsByType: (type) =>
        Array.from(get().windows.values()).filter((w) => w.type === type),

      setActiveWindow: (id) => set({ activeWindowId: id }),

      closeAllWindows: () => set({ windows: new Map(), activeWindowId: null }),

      getPersistentState: () => Array.from(get().windows.values()),

      restoreState: (windows) => {
        const windowsMap = new Map<string, WindowConfig>();
        let maxZIndex = 100;

        for (const window of windows) {
          windowsMap.set(window.id, window);
          if (window.zIndex > maxZIndex) maxZIndex = window.zIndex;
        }

        set({ windows: windowsMap, nextZIndex: maxZIndex + 1 });
      },
    }),
    {
      name: "mailforge-windows",
      partialize: (state) => ({
        windows: Array.from(state.windows.values()),
        nextZIndex: state.nextZIndex,
      }),
      merge: (persistedState: unknown, currentState) => {
        const stored = persistedState as { windows?: WindowConfig[]; nextZIndex?: number } | undefined;
        return {
          ...currentState,
          windows: new Map((stored?.windows ?? []).map(w => [w.id, w])),
          nextZIndex: stored?.nextZIndex ?? 100,
        };
      },
    }
  )
);