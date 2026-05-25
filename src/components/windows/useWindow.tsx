"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { useWindowStore } from "~/stores";
import type { WindowType } from "~/types/ui";

interface WindowButtonProps {
  type: WindowType;
  title: string;
  icon?: React.ReactNode;
  data?: Record<string, unknown>;
  size?: { width: number; height: number };
}

interface OpenWindowButtonProps extends WindowButtonProps {
  children: React.ReactNode;
  className?: string;
}

export function useWindow() {
  const { openWindow } = useWindowStore();

  const open = useCallback(
    (type: WindowType, title: string, data?: Record<string, unknown>, size?: { width: number; height: number }) => {
      return openWindow(type, title, data, size);
    },
    [openWindow]
  );

  return { open };
}

export function OpenWindowButton({ type, title, data, size, children, className }: OpenWindowButtonProps) {
  const { openWindow } = useWindowStore();

  const handleClick = useCallback(() => {
    openWindow(type, title, data, size);
  }, [type, title, data, size, openWindow]);

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      {children}
    </motion.button>
  );
}

export function openComposeWindow() {
  const { openWindow } = useWindowStore.getState();
  openWindow("compose", "New Message", {}, { width: 700, height: 500 });
}

export function openSettingsWindow() {
  const { openWindow } = useWindowStore.getState();
  openWindow("settings", "Settings", {}, { width: 800, height: 600 });
}

export function openSearchWindow() {
  const { openWindow } = useWindowStore.getState();
  openWindow("search", "Search", {}, { width: 600, height: 400 });
}

export function openAccountManagerWindow() {
  const { openWindow } = useWindowStore.getState();
  openWindow("account-manager", "Account Manager", {}, { width: 700, height: 500 });
}

export function openMailViewerWindow(messageId: string, subject: string) {
  const { openWindow } = useWindowStore.getState();
  openWindow(
    "mail-viewer",
    subject || "Mail",
    { messageId },
    { width: 800, height: 600 }
  );
}