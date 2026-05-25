export type WindowType =
  | "mail-viewer"
  | "compose"
  | "settings"
  | "search"
  | "account-manager"
  | "thread-view";

export type WindowState = "minimized" | "normal" | "maximized";

export interface WindowPosition {
  x: number;
  y: number;
}

export interface WindowSize {
  width: number;
  height: number;
}

export interface WindowConfig {
  id: string;
  type: WindowType;
  title: string;
  position: WindowPosition;
  size: WindowSize;
  state: WindowState;
  zIndex: number;
  data?: Record<string, unknown>;
  isMinimized?: boolean;
}

export interface WindowManagerState {
  windows: Map<string, WindowConfig>;
  activeWindowId: string | null;
  nextZIndex: number;
}

export interface DragState {
  isDragging: boolean;
  windowId: string | null;
  startPosition: WindowPosition;
  startMousePosition: WindowPosition;
}

export interface ResizeState {
  isResizing: boolean;
  windowId: string | null;
  edge: ResizeEdge | null;
  startSize: WindowSize;
  startPosition: WindowPosition;
  startMousePosition: WindowPosition;
}

export type ResizeEdge =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

export interface MailListState {
  selectedMessageId: string | null;
  selectedThreadId: string | null;
  expandedThreads: Set<string>;
  hoveredMessageId: string | null;
}

export interface UIState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  focusModeEnabled: boolean;
  splitViewEnabled: boolean;
  activePane: "list" | "viewer";
  commandPaletteOpen: boolean;
}

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeConfig {
  mode: ThemeMode;
  primaryColor: string;
  accentColor: string;
  density: "compact" | "comfortable" | "spacious";
  borderRadius: "none" | "sm" | "md" | "lg" | "xl";
  animationsEnabled: boolean;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message?: string;
  duration?: number;
}

export interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  action?: () => void;
  children?: ContextMenuItem[];
}

export interface ContactSearchResult {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface AttachmentUpload {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  url?: string;
}

export interface ComposeState {
  to: EmailRecipient[];
  cc: EmailRecipient[];
  bcc: EmailRecipient[];
  subject: string;
  body: string;
  isRichText: boolean;
  attachments: AttachmentUpload[];
  isScheduled: boolean;
  scheduledAt?: Date;
  draftId?: string;
}

export interface EmailRecipient {
  id: string;
  name?: string;
  email: string;
}

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  category: "mail" | "compose" | "account" | "settings" | "action";
  action: () => void;
}