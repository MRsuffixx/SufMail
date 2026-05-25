"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore, useMailListStore } from "~/stores";
import { cn } from "~/lib/ui/utils";
import {
  Inbox,
  Star,
  Send,
  FileText,
  Trash2,
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  Users,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import type { LabelInfo } from "~/types/mail";

const SYSTEM_FOLDERS = [
  { id: "inbox", name: "Inbox", icon: Inbox, color: "text-blue-500" },
  { id: "starred", name: "Starred", icon: Star, color: "text-yellow-500" },
  { id: "sent", name: "Sent", icon: Send, color: "text-green-500" },
  { id: "drafts", name: "Drafts", icon: FileText, color: "text-gray-400" },
  { id: "archive", name: "Archive", icon: Archive, color: "text-purple-500" },
  { id: "spam", name: "Spam", icon: AlertTriangle, color: "text-red-500" },
  { id: "trash", name: "Trash", icon: Trash2, color: "text-orange-500" },
] as const;

interface SidebarProps {
  labels?: LabelInfo[];
  onCompose?: () => void;
  onSettings?: () => void;
  onAccountManager?: () => void;
}

export function Sidebar({ labels = [], onCompose, onSettings, onAccountManager }: SidebarProps) {
  const {
    sidebarCollapsed,
    sidebarWidth,
    toggleSidebar,
    currentFolder,
    setCurrentFolder,
  } = useUIStore();
  const { setCurrentLabel, currentLabel } = useMailListStore();

  const handleFolderClick = useCallback(
    (folderId: string) => {
      setCurrentFolder(folderId);
      setCurrentLabel(null);
    },
    [setCurrentFolder, setCurrentLabel]
  );

  const handleLabelClick = useCallback(
    (labelId: string) => {
      setCurrentLabel(labelId);
      setCurrentFolder(null);
    },
    [setCurrentFolder, setCurrentLabel]
  );

  return (
    <motion.aside
      initial={false}
      animate={{
        width: sidebarCollapsed ? 60 : sidebarWidth,
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col border-r border-white/10 bg-gray-900/50"
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-3">
        {!sidebarCollapsed && (
          <span className="text-sm font-semibold text-gray-200">MailForge</span>
        )}
        <button
          onClick={toggleSidebar}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 transition-colors"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4 text-gray-400" />
          ) : (
            <PanelLeftClose className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Compose Button */}
      <div className="p-2">
        <motion.button
          onClick={onCompose}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors",
            sidebarCollapsed && "justify-center px-2"
          )}
        >
          <Plus className="h-4 w-4" />
          {!sidebarCollapsed && <span>Compose</span>}
        </motion.button>
      </div>

      {/* Folders */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {SYSTEM_FOLDERS.map((folder) => {
            const Icon = folder.icon;
            const isActive = currentFolder === folder.id && !currentLabel;

            return (
              <motion.button
                key={folder.id}
                onClick={() => handleFolderClick(folder.id)}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-gray-400 hover:text-gray-200",
                  sidebarCollapsed && "justify-center px-2"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", folder.color)} />
                {!sidebarCollapsed && <span className="truncate">{folder.name}</span>}
              </motion.button>
            );
          })}
        </div>

        {/* Labels Section */}
        {labels.length > 0 && (
          <div className="mt-6">
            {!sidebarCollapsed && (
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Labels
                </span>
                <button className="text-gray-500 hover:text-gray-300 transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="space-y-1">
              {labels.map((label) => {
                const isActive = currentLabel === label.id;

                return (
                  <motion.button
                    key={label.id}
                    onClick={() => handleLabelClick(label.id)}
                    whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-gray-400 hover:text-gray-200",
                      sidebarCollapsed && "justify-center px-2"
                    )}
                  >
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color ?? "#666" }}
                    />
                    {!sidebarCollapsed && <span className="truncate">{label.name}</span>}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer Actions */}
      <div className="border-t border-white/10 p-2">
        <div className="space-y-1">
          <motion.button
            onClick={onAccountManager}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors",
              sidebarCollapsed && "justify-center px-2"
            )}
          >
            <Users className="h-4 w-4" />
            {!sidebarCollapsed && <span>Accounts</span>}
          </motion.button>
          <motion.button
            onClick={onSettings}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors",
              sidebarCollapsed && "justify-center px-2"
            )}
          >
            <Settings className="h-4 w-4" />
            {!sidebarCollapsed && <span>Settings</span>}
          </motion.button>
        </div>
      </div>
    </motion.aside>
  );
}