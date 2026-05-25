"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore } from "~/stores";
import { cn } from "~/lib/ui/utils";
import {
  Plus,
  Mail,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Settings,
} from "lucide-react";

interface Account {
  id: string;
  email: string;
  name: string;
  isDefault: boolean;
  syncStatus: "idle" | "syncing" | "error" | "success";
  lastSyncAt: Date | null;
  messageCount: number;
  unreadCount: number;
}

const mockAccounts: Account[] = [
  {
    id: "1",
    email: "user@gmail.com",
    name: "Personal Email",
    isDefault: true,
    syncStatus: "success",
    lastSyncAt: new Date(),
    messageCount: 1234,
    unreadCount: 5,
  },
];

export function AccountManager() {
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
  });

  const { addToast } = useToastStore();

  const handleTestConnection = useCallback(async () => {
    setIsTestingConnection(true);
    setConnectionStatus("idle");

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const success = Math.random() > 0.3;
    setConnectionStatus(success ? "success" : "error");
    setIsTestingConnection(false);

    if (!success) {
      addToast({ type: "error", title: "Connection failed", message: "Check your credentials and try again" });
    } else {
      addToast({ type: "success", title: "Connection successful" });
    }
  }, [addToast]);

  const handleAddAccount = useCallback(() => {
    const newAccount: Account = {
      id: Math.random().toString(36).substring(7),
      email: formData.email,
      name: formData.email.split("@")[0] || "New Account",
      isDefault: accounts.length === 0,
      syncStatus: "idle",
      lastSyncAt: null,
      messageCount: 0,
      unreadCount: 0,
    };
    setAccounts((prev) => [...prev, newAccount]);
    setShowAddForm(false);
    setFormData({ email: "", password: "", imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 587 });
    addToast({ type: "success", title: "Account added successfully" });
  }, [formData, accounts.length, addToast]);

  const handleDeleteAccount = useCallback(
    (accountId: string) => {
      if (confirm("Are you sure you want to delete this account?")) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
        addToast({ type: "success", title: "Account deleted" });
      }
    },
    [addToast]
  );

  const toggleExpanded = useCallback((accountId: string) => {
    setExpandedAccountId((prev) => (prev === accountId ? null : accountId));
  }, []);

  return (
    <div className="flex h-full flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Mail Accounts</h2>
          <p className="mt-1 text-sm text-gray-500">Manage your email accounts</p>
        </div>
        <motion.button
          onClick={() => setShowAddForm(!showAddForm)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </motion.button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/10"
          >
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="App password or OAuth token"
                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">IMAP Host</label>
                  <input
                    type="text"
                    value={formData.imapHost}
                    onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">IMAP Port</label>
                  <input
                    type="number"
                    value={formData.imapPort}
                    onChange={(e) => setFormData({ ...formData, imapPort: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">SMTP Host</label>
                  <input
                    type="text"
                    value={formData.smtpHost}
                    onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">SMTP Port</label>
                  <input
                    type="number"
                    value={formData.smtpPort}
                    onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-white/10 bg-gray-800 px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  {connectionStatus === "success" && (
                    <span className="flex items-center gap-1 text-sm text-green-500">
                      <Check className="h-4 w-4" /> Connected
                    </span>
                  )}
                  {connectionStatus === "error" && (
                    <span className="flex items-center gap-1 text-sm text-red-500">
                      <AlertCircle className="h-4 w-4" /> Failed
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <motion.button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection || !formData.email || !formData.password}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50 transition-colors"
                  >
                    {isTestingConnection ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Settings className="h-4 w-4" />
                    )}
                    Test Connection
                  </motion.button>
                  <motion.button
                    onClick={() => setShowAddForm(false)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    onClick={handleAddAccount}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Account
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account List */}
      <div className="flex-1 overflow-y-auto p-4">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-gray-800 p-4">
              <Mail className="h-12 w-12 text-gray-600" />
            </div>
            <p className="mt-4 text-sm font-medium text-gray-300">No accounts added</p>
            <p className="mt-1 text-xs text-gray-500">Add your first email account to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border border-white/10 bg-white/5"
              >
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer"
                  onClick={() => toggleExpanded(account.id)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20 text-sm font-medium text-blue-400">
                    {(account.email[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-200 truncate">{account.name}</span>
                      {account.isDefault && (
                        <span className="rounded bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400">Default</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{account.email}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs text-gray-500">{account.messageCount} messages</span>
                      {account.unreadCount > 0 && (
                        <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                          {account.unreadCount} unread
                        </span>
                      )}
                    </div>
                    {expandedAccountId === account.id ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedAccountId === account.id && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden border-t border-white/10"
                    >
                      <div className="flex items-center justify-between p-4">
                        <div className="flex gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/5 transition-colors"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Sync Now
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:bg-white/5 transition-colors"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            Settings
                          </motion.button>
                        </div>
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAccount(account.id);
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}