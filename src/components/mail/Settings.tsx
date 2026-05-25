"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useThemeStore, useUIStore } from "~/stores";
import { cn } from "~/lib/ui/utils";
import type { ThemeMode } from "~/types/ui";
import {
  Palette,
  Layout,
  Bell,
  Shield,
  Database,
  Globe,
  Check,
} from "lucide-react";

type SettingsTab = "appearance" | "layout" | "notifications" | "security" | "data";

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" /> },
  { id: "layout", label: "Layout", icon: <Layout className="h-4 w-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { id: "security", label: "Security", icon: <Shield className="h-4 w-4" /> },
  { id: "data", label: "Data", icon: <Database className="h-4 w-4" /> },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const { mode, setThemeMode, primaryColor, setPrimaryColor, density, setDensity, borderRadius, setBorderRadius, animationsEnabled, toggleAnimations } = useThemeStore();
  const { sidebarWidth, setSidebarWidth, focusModeEnabled, toggleFocusMode, splitViewEnabled, toggleSplitView } = useUIStore();

  return (
    <div className="flex h-full flex-col bg-gray-900">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-200">Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Customize your MailForge experience</p>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-48 border-r border-white/10 p-2">
          <div className="space-y-1">
            {TABS.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  activeTab === tab.id
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                {tab.icon}
                {tab.label}
              </motion.button>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-200 mb-4">Theme</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(["light", "dark", "system"] as ThemeMode[]).map((themeMode) => (
                    <motion.button
                      key={themeMode}
                      onClick={() => setThemeMode(themeMode)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
                        mode === themeMode
                          ? "border-blue-500 bg-blue-600/10"
                          : "border-white/10 hover:border-white/20"
                      )}
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-lg",
                        themeMode === "light" ? "bg-white" : "",
                        themeMode === "dark" ? "bg-gray-800" : "",
                        themeMode === "system" ? "bg-gradient-to-r from-white to-gray-800" : ""
                      )} />
                      <span className="text-sm text-gray-300 capitalize">{themeMode}</span>
                      {mode === themeMode && (
                        <Check className="h-4 w-4 text-blue-500" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-200 mb-2 block">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-20 rounded-lg border border-white/10 cursor-pointer"
                  />
                  <span className="text-sm text-gray-400">{primaryColor}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-200 mb-2 block">Density</label>
                <div className="flex gap-2">
                  {(["compact", "comfortable", "spacious"] as const).map((d) => (
                    <motion.button
                      key={d}
                      onClick={() => setDensity(d)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "rounded-lg border px-4 py-2 text-sm transition-colors",
                        density === d
                          ? "border-blue-500 bg-blue-600/10 text-blue-400"
                          : "border-white/10 text-gray-400 hover:border-white/20"
                      )}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-200 mb-2 block">Border Radius</label>
                <div className="flex gap-2">
                  {(["none", "sm", "md", "lg", "xl"] as const).map((r) => (
                    <motion.button
                      key={r}
                      onClick={() => setBorderRadius(r)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "rounded-lg border px-4 py-2 text-sm transition-colors",
                        borderRadius === r
                          ? "border-blue-500 bg-blue-600/10 text-blue-400"
                          : "border-white/10 text-gray-400 hover:border-white/20"
                      )}
                    >
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-200">Animations</span>
                  <p className="text-xs text-gray-500 mt-0.5">Enable smooth transitions</p>
                </div>
                <button
                  onClick={toggleAnimations}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    animationsEnabled ? "bg-blue-600" : "bg-gray-700"
                  )}
                >
                  <motion.div
                    animate={{ x: animationsEnabled ? 20 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 h-4 w-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>
            </div>
          )}

          {activeTab === "layout" && (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium text-gray-200 mb-2 block">Sidebar Width</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="200"
                    max="400"
                    value={sidebarWidth}
                    onChange={(e) => setSidebarWidth(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 w-16">{sidebarWidth}px</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-200">Focus Mode</span>
                  <p className="text-xs text-gray-500 mt-0.5">Hide sidebar and show only active mail</p>
                </div>
                <button
                  onClick={toggleFocusMode}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    focusModeEnabled ? "bg-blue-600" : "bg-gray-700"
                  )}
                >
                  <motion.div
                    animate={{ x: focusModeEnabled ? 20 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 h-4 w-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-200">Split View</span>
                  <p className="text-xs text-gray-500 mt-0.5">Open multiple mail windows side by side</p>
                </div>
                <button
                  onClick={toggleSplitView}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    splitViewEnabled ? "bg-blue-600" : "bg-gray-700"
                  )}
                >
                  <motion.div
                    animate={{ x: splitViewEnabled ? 20 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute top-1 h-4 w-4 rounded-full bg-white shadow"
                  />
                </button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <p className="text-sm text-gray-400">Notification settings coming soon...</p>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <p className="text-sm text-gray-400">Security settings coming soon...</p>
            </div>
          )}

          {activeTab === "data" && (
            <div className="space-y-6">
              <p className="text-sm text-gray-400">Data management settings coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}