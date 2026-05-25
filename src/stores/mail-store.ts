import { create } from "zustand";
import type { MailListState, MessageListItem, ThreadSummary, LabelInfo } from "~/types/mail";

interface MailStore extends MailListState {
  setSelectedMessage: (id: string | null) => void;
  setSelectedThread: (id: string | null) => void;
  toggleThreadExpanded: (id: string) => void;
  setHoveredMessage: (id: string | null) => void;
  clearSelection: () => void;
}

interface MailListStore {
  messages: MessageListItem[];
  threads: ThreadSummary[];
  labels: LabelInfo[];
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  currentLabel: string | null;
  currentFolder: string | null;
  sortBy: "date" | "sender" | "subject";
  sortOrder: "asc" | "desc";
  filter: {
    unread: boolean;
    starred: boolean;
    hasAttachment: boolean;
  };

  setMessages: (messages: MessageListItem[]) => void;
  appendMessages: (messages: MessageListItem[]) => void;
  updateMessage: (id: string, updates: Partial<MessageListItem>) => void;
  removeMessage: (id: string) => void;
  setThreads: (threads: ThreadSummary[]) => void;
  setLabels: (labels: LabelInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setFetchingMore: (fetching: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setCurrentLabel: (label: string | null) => void;
  setCurrentFolder: (folder: string | null) => void;
  setSortBy: (sortBy: "date" | "sender" | "subject") => void;
  setSortOrder: (order: "asc" | "desc") => void;
  setFilter: (filter: Partial<MailListStore["filter"]>) => void;
  clearMessages: () => void;
}

export const useMailStore = create<MailStore>((set) => ({
  selectedMessageId: null,
  selectedThreadId: null,
  expandedThreads: new Set(),
  hoveredMessageId: null,

  setSelectedMessage: (id) => set({ selectedMessageId: id }),
  setSelectedThread: (id) => set({ selectedThreadId: id }),
  toggleThreadExpanded: (id) =>
    set((state) => {
      const newExpanded = new Set(state.expandedThreads);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return { expandedThreads: newExpanded };
    }),
  setHoveredMessage: (id) => set({ hoveredMessageId: id }),
  clearSelection: () =>
    set({ selectedMessageId: null, selectedThreadId: null, hoveredMessageId: null }),
}));

export const useMailListStore = create<MailListStore>((set) => ({
  messages: [],
  threads: [],
  labels: [],
  isLoading: false,
  isFetchingMore: false,
  hasMore: true,
  currentLabel: null,
  currentFolder: null,
  sortBy: "date",
  sortOrder: "desc",
  filter: {
    unread: false,
    starred: false,
    hasAttachment: false,
  },

  setMessages: (messages) => set({ messages }),
  appendMessages: (newMessages) =>
    set((state) => ({ messages: [...state.messages, ...newMessages] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  removeMessage: (id) =>
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),
  setThreads: (threads) => set({ threads }),
  setLabels: (labels) => set({ labels }),
  setLoading: (isLoading) => set({ isLoading }),
  setFetchingMore: (isFetchingMore) => set({ isFetchingMore }),
  setHasMore: (hasMore) => set({ hasMore }),
  setCurrentLabel: (currentLabel) => set({ currentLabel }),
  setCurrentFolder: (currentFolder) => set({ currentFolder }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setFilter: (filter) =>
    set((state) => ({ filter: { ...state.filter, ...filter } })),
  clearMessages: () => set({ messages: [], threads: [], hasMore: false }),
}));