"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useUIStore, useMailStore, useMailListStore, useWindowStore } from "~/stores";
import { Sidebar } from "~/components/mail/Sidebar";
import { MailList } from "~/components/mail/MailList";
import { MailViewer } from "~/components/mail/MailViewer";
import { Compose } from "~/components/mail/Compose";
import { Settings } from "~/components/mail/Settings";
import { AccountManager } from "~/components/mail/AccountManager";
import { CommandPalette } from "~/components/mail/CommandPalette";
import { WindowManager } from "~/components/windows/WindowManager";
import { ToastContainer } from "~/components/ui/Toast";
import { ContextMenu } from "~/components/ui/ContextMenu";
import { openComposeWindow, openSettingsWindow, openAccountManagerWindow } from "~/components/windows/useWindow";
import { cn } from "~/lib/ui/utils";
import type { MessageListItem, LabelInfo, FullMessage } from "~/types/mail";
import type { ContextMenuItem } from "~/types/ui";
import { Focus } from "lucide-react";

interface AppLayoutProps {
  labels?: LabelInfo[];
}

export function AppLayout({ labels = [] }: AppLayoutProps) {
  const {
    focusModeEnabled,
    toggleFocusMode,
    activePane,
    setActivePane,
  } = useUIStore();
  const { selectedMessageId, setSelectedMessage } = useMailStore();
  const { messages, setMessages } = useMailListStore();
  const { openWindow } = useWindowStore();

  const [selectedMessage, setSelectedMessageLocal] = useState<FullMessage | null>(null);
  // Track blob URLs for cleanup
  const attachmentUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMessages(mockMessages);
    // Cleanup blob URLs on unmount
    return () => {
      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      attachmentUrlsRef.current.clear();
    };
  }, [setMessages]);

  const handleMessageClick = useCallback(
    (message: MessageListItem) => {
      setSelectedMessage(message.id);
      setActivePane("viewer");
      // Memoize the FullMessage object to prevent unnecessary re-renders
      const fullMessage: FullMessage = {
        id: message.id,
        threadId: message.threadId,
        messageId: message.messageId,
        subject: message.subject ?? null,
        fromEmail: message.fromEmail,
        fromName: message.fromName ?? null,
        snippet: message.snippet ?? null,
        isRead: message.isRead,
        isStarred: message.isStarred,
        isSnoozed: message.isSnoozed,
        snoozeUntil: message.snoozeUntil,
        receivedAt: message.receivedAt,
        sentAt: message.sentAt,
        attachmentCount: message.attachmentCount,
        labels: message.labels,
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        bodyHtml: null,
        bodyText: null,
        attachments: [],
        headers: {},
        size: 0,
        mailAccountId: "",
        rawPath: null,
      };
      setSelectedMessageLocal(fullMessage);
    },
    [setSelectedMessage, setActivePane]
  );

  const handleMessageRightClick = useCallback(
    (message: MessageListItem, e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({
        isOpen: true,
        position: { x: e.clientX, y: e.clientY },
        items: [
          { id: "reply", label: "Reply", shortcut: "R", action: () => handleReply(message) },
          { id: "reply-all", label: "Reply All", shortcut: "Shift+R", action: () => {} },
          { id: "forward", label: "Forward", shortcut: "F", action: () => handleForward(message) },
          { divider: true, id: "divider1", label: "" },
          { id: "archive", label: "Archive", action: () => {} },
          { id: "delete", label: "Delete", danger: true, action: () => {} },
          { divider: true, id: "divider2", label: "" },
          { id: "mark-read", label: message.isRead ? "Mark as unread" : "Mark as read", action: () => {} },
          { id: "star", label: message.isStarred ? "Remove star" : "Add star", action: () => {} },
        ],
      });
    },
    []
  );

  const handleReply = useCallback((message: MessageListItem) => {
    openWindow("compose", "Reply", { replyToMessageId: message.id });
  }, [openWindow]);

  const handleForward = useCallback((message: MessageListItem) => {
    openWindow("compose", "Forward", { forwardMessageId: message.id });
  }, [openWindow]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    items: ContextMenuItem[];
  }>({ isOpen: false, position: { x: 0, y: 0 }, items: [] });

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      {!focusModeEnabled && <Sidebar labels={labels} onCompose={openComposeWindow} onSettings={openSettingsWindow} onAccountManager={openAccountManagerWindow} />}

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-gray-900/80 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-300">
              {focusModeEnabled ? "Focus Mode" : "Inbox"}
            </span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-gray-400">
              {messages.length} messages
            </span>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={toggleFocusMode}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                focusModeEnabled ? "bg-blue-600/20 text-blue-400" : "text-gray-400 hover:bg-white/10"
              )}
            >
              <Focus className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Mail List */}
          <div
            className={cn(
              "border-r border-white/10 transition-all duration-200",
              focusModeEnabled ? "w-0" : activePane === "viewer" ? "w-2/5" : "w-full"
            )}
          >
            <MailList
              messages={messages}
              onMessageClick={handleMessageClick}
              onMessageRightClick={handleMessageRightClick}
              labels={labels}
            />
          </div>

          {/* Mail Viewer */}
          {activePane === "viewer" && selectedMessage && (
            <div className="flex-1">
              <MailViewer
                message={selectedMessage}
                onReply={handleReply}
                onForward={handleForward}
              />
            </div>
          )}
        </div>
      </div>

      {/* Window Manager for floating windows */}
      <WindowManager />

      {/* Command Palette */}
      <CommandPalette />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        items={contextMenu.items}
        onClose={handleCloseContextMenu}
      />
    </div>
  );
}

const mockMessages: MessageListItem[] = [
  {
    id: "1",
    threadId: "t1",
    messageId: "msg1",
    subject: "Welcome to MailForge",
    fromEmail: "team@mailforge.dev",
    fromName: "MailForge Team",
    snippet: "Get started with your new email client...",
    isRead: false,
    isStarred: true,
    isSnoozed: false,
    snoozeUntil: null,
    receivedAt: new Date(),
    sentAt: new Date(),
    attachmentCount: 0,
    labels: [],
  },
  {
    id: "2",
    threadId: "t2",
    messageId: "msg2",
    subject: "Meeting Tomorrow",
    fromEmail: "john@example.com",
    fromName: "John Doe",
    snippet: "Hey, just wanted to confirm our meeting tomorrow at 10am...",
    isRead: true,
    isStarred: false,
    isSnoozed: false,
    snoozeUntil: null,
    receivedAt: new Date(Date.now() - 3600000),
    sentAt: new Date(Date.now() - 3600000),
    attachmentCount: 1,
    labels: [{ id: "l1", name: "Work", color: "#3b82f6", icon: null, type: "custom", isSystem: false }],
  },
  {
    id: "3",
    threadId: "t3",
    messageId: "msg3",
    subject: "Project Update",
    fromEmail: "sarah@company.com",
    fromName: "Sarah Smith",
    snippet: "The latest updates on the project are ready for review...",
    isRead: false,
    isStarred: false,
    isSnoozed: false,
    snoozeUntil: null,
    receivedAt: new Date(Date.now() - 7200000),
    sentAt: new Date(Date.now() - 7200000),
    attachmentCount: 2,
    labels: [],
  },
];