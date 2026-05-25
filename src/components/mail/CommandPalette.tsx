"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore, useThemeStore, useMailListStore } from "~/stores";
import { cn } from "~/lib/ui/utils";
import type { CommandItem } from "~/types/ui";
import {
  Search,
  Inbox,
  Send,
  FileText,
  Plus,
  Users,
  Settings,
  Sun,
  Moon,
  Monitor,
  X,
} from "lucide-react";
import { openComposeWindow, openSettingsWindow, openAccountManagerWindow } from "~/components/windows/useWindow";

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { setThemeMode } = useThemeStore();
  const { setCurrentFolder } = useMailListStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    {
      id: "compose",
      label: "Compose new email",
      description: "Open a new compose window",
      icon: "Plus",
      shortcut: "C",
      category: "compose",
      action: () => {
        openComposeWindow();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: "inbox",
      label: "Go to Inbox",
      description: "View your inbox",
      icon: "Inbox",
      shortcut: "I",
      category: "mail",
      action: () => {
        setCurrentFolder("inbox");
        setCommandPaletteOpen(false);
      },
    },
    {
      id: "sent",
      label: "Go to Sent",
      description: "View sent messages",
      icon: "Send",
      category: "mail",
      action: () => {
        setCurrentFolder("sent");
        setCommandPaletteOpen(false);
      },
    },
    {
      id: "drafts",
      label: "Go to Drafts",
      description: "View draft messages",
      icon: "FileText",
      category: "mail",
      action: () => {
        setCurrentFolder("drafts");
        setCommandPaletteOpen(false);
      },
    },
    {
      id: "settings",
      label: "Open Settings",
      description: "Configure MailForge",
      icon: "Settings",
      shortcut: ",",
      category: "settings",
      action: () => {
        openSettingsWindow();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: "accounts",
      label: "Manage Accounts",
      description: "Add or remove mail accounts",
      icon: "Users",
      category: "account",
      action: () => {
        openAccountManagerWindow();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: "theme-light",
      label: "Light theme",
      description: "Switch to light mode",
      icon: "Sun",
      category: "settings",
      action: () => {
        setThemeMode("light");
        setCommandPaletteOpen(false);
      },
    },
    {
      id: "theme-dark",
      label: "Dark theme",
      description: "Switch to dark mode",
      icon: "Moon",
      category: "settings",
      action: () => {
        setThemeMode("dark");
        setCommandPaletteOpen(false);
      },
    },
    {
      id: "theme-system",
      label: "System theme",
      description: "Follow system settings",
      icon: "Monitor",
      category: "settings",
      action: () => {
        setThemeMode("system");
        setCommandPaletteOpen(false);
      },
    },
  ];

  const filteredCommands = query
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filteredCommands[selectedIndex]?.action();
      } else if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    },
    [filteredCommands, selectedIndex, setCommandPaletteOpen]
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const iconMap: Record<string, React.ReactNode> = {
    Plus: <Plus className="h-4 w-4" />,
    Inbox: <Inbox className="h-4 w-4" />,
    Send: <Send className="h-4 w-4" />,
    FileText: <FileText className="h-4 w-4" />,
    Users: <Users className="h-4 w-4" />,
    Settings: <Settings className="h-4 w-4" />,
    Sun: <Sun className="h-4 w-4" />,
    Moon: <Moon className="h-4 w-4" />,
    Monitor: <Monitor className="h-4 w-4" />,
  };

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCommandPaletteOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-lg rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Search className="h-5 w-5 text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search commands, emails, contacts..."
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
              />
              <div className="flex items-center gap-1">
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-gray-500">Esc</kbd>
                <button
                  onClick={() => setCommandPaletteOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No commands found
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCommands.map((command, index) => (
                    <motion.button
                      key={command.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => command.action()}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                        selectedIndex === index
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                      )}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                        {iconMap[command.icon ?? ""] ?? <Search className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{command.label}</div>
                        {command.description && (
                          <div className="text-xs text-gray-500">{command.description}</div>
                        )}
                      </div>
                      {command.shortcut && (
                        <kbd className="rounded bg-white/10 px-2 py-0.5 text-xs text-gray-500">
                          {command.shortcut}
                        </kbd>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5">↑</kbd>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 ml-1">↓</kbd>
                  to navigate
                </span>
                <span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5">Enter</kbd>
                  to select
                </span>
              </div>
              <span>MailForge Commands</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}