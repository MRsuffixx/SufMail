import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  focusModeEnabled: boolean;
  splitViewEnabled: boolean;
  activePane: "list" | "viewer";
  commandPaletteOpen: boolean;
  currentFolder: string | null;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setFocusModeEnabled: (enabled: boolean) => void;
  toggleFocusMode: () => void;
  setSplitViewEnabled: (enabled: boolean) => void;
  toggleSplitView: () => void;
  setActivePane: (pane: "list" | "viewer") => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  resetLayout: () => void;
  setCurrentFolder: (folder: string | null) => void;
}

interface ThemeStore {
  mode: "light" | "dark" | "system";
  primaryColor: string;
  accentColor: string;
  density: "compact" | "comfortable" | "spacious";
  borderRadius: "none" | "sm" | "md" | "lg" | "xl";
  animationsEnabled: boolean;
  setThemeMode: (mode: "light" | "dark" | "system") => void;
  setPrimaryColor: (color: string) => void;
  setAccentColor: (color: string) => void;
  setDensity: (density: "compact" | "comfortable" | "spacious") => void;
  setBorderRadius: (radius: "none" | "sm" | "md" | "lg" | "xl") => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  toggleAnimations: () => void;
}

const DEFAULT_UI_STATE = {
  sidebarCollapsed: false,
  sidebarWidth: 260,
  focusModeEnabled: false,
  splitViewEnabled: false,
  activePane: "list" as const,
  commandPaletteOpen: false,
  currentFolder: null,
};

const DEFAULT_THEME = {
  mode: "system" as const,
  primaryColor: "hsl(221, 83%, 53%)",
  accentColor: "hsl(262, 83%, 58%)",
  density: "comfortable" as const,
  borderRadius: "md" as const,
  animationsEnabled: true,
};

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      ...DEFAULT_UI_STATE,

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(400, width)) }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setFocusModeEnabled: (enabled) => set({ focusModeEnabled: enabled }),
      toggleFocusMode: () => set((state) => ({ focusModeEnabled: !state.focusModeEnabled })),
      setSplitViewEnabled: (enabled) => set({ splitViewEnabled: enabled }),
      toggleSplitView: () => set((state) => ({ splitViewEnabled: !state.splitViewEnabled })),
      setActivePane: (pane) => set({ activePane: pane }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      resetLayout: () => set(DEFAULT_UI_STATE),
      setCurrentFolder: (folder) => set({ currentFolder: folder }),
    }),
    { name: "mailforge-ui" }
  )
);

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      ...DEFAULT_THEME,

      setThemeMode: (mode) => set({ mode }),
      setPrimaryColor: (color) => set({ primaryColor: color }),
      setAccentColor: (color) => set({ accentColor: color }),
      setDensity: (density) => set({ density }),
      setBorderRadius: (radius) => set({ borderRadius: radius }),
      setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),
      toggleAnimations: () => set((state) => ({ animationsEnabled: !state.animationsEnabled })),
    }),
    { name: "mailforge-theme" }
  )
);