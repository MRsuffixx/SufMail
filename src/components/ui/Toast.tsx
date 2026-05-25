"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/ui/utils";
import type { Toast as ToastType } from "~/types/ui";
import { useToastStore } from "~/stores";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS = {
  success: "border-green-500/30 bg-green-600/10",
  error: "border-red-500/30 bg-red-600/10",
  info: "border-blue-500/30 bg-blue-600/10",
  warning: "border-yellow-500/30 bg-yellow-600/10",
};

const ICON_COLORS = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-blue-500",
  warning: "text-yellow-500",
};

interface ToastProps {
  toast: ToastType;
  onDismiss: () => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = ICONS[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-start gap-3 rounded-lg border backdrop-blur-xl p-4 shadow-xl",
        COLORS[toast.type]
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", ICON_COLORS[toast.type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200">{toast.title}</p>
        {toast.message && (
          <p className="mt-1 text-xs text-gray-400">{toast.message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md hover:bg-white/10 transition-colors"
      >
        <X className="h-4 w-4 text-gray-500" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}