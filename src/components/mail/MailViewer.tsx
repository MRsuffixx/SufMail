"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatRelativeTime, cn } from "~/lib/ui/utils";
import {
  Star,
  Reply,
  Forward,
  Paperclip,
  Download,
  ExternalLink,
  Trash2,
  Archive,
  Mail,
} from "lucide-react";
import type { FullMessage, AttachmentInfo, EmailAddress } from "~/types/mail";
import { useToastStore } from "~/stores";

interface MailViewerProps {
  message: FullMessage;
  onReply?: (message: FullMessage) => void;
  onForward?: (message: FullMessage) => void;
  onToggleRead?: (messageId: string, isRead: boolean) => void;
  onToggleStar?: (messageId: string, isStarred: boolean) => void;
}

export function MailViewer({ message, onReply, onForward, onToggleRead, onToggleStar }: MailViewerProps) {
  const [showHeaders, setShowHeaders] = useState(false);
  const { addToast } = useToastStore();

  const handleToggleRead = useCallback(() => {
    onToggleRead?.(message.id, !message.isRead);
    addToast({ type: "success", title: message.isRead ? "Marked as unread" : "Marked as read" });
  }, [message.id, message.isRead, onToggleRead, addToast]);

  const handleToggleStar = useCallback(() => {
    onToggleStar?.(message.id, !message.isStarred);
    addToast({ type: "success", title: message.isStarred ? "Star removed" : "Star added" });
  }, [message.id, message.isStarred, onToggleStar, addToast]);

  const handleReply = useCallback(() => {
    onReply?.(message);
  }, [message, onReply]);

  const handleForward = useCallback(() => {
    onForward?.(message);
  }, [message, onForward]);

  const handleDownloadAttachment = useCallback((attachment: AttachmentInfo) => {
    if (attachment.url) {
      window.open(attachment.url, "_blank");
    } else {
      addToast({ type: "error", title: "Attachment URL not available" });
    }
  }, [addToast]);

  const formatAddress = (addr: EmailAddress) => {
    return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
  };

  return (
    <div className="flex h-full flex-col bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleToggleStar}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
              message.isStarred
                ? "text-yellow-500"
                : "text-gray-400 hover:bg-white/10"
            )}
          >
            <Star className={cn("h-4 w-4", message.isStarred && "fill-yellow-500")} />
          </motion.button>
          <motion.button
            onClick={handleToggleRead}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 transition-colors"
          >
            <Mail className="h-4 w-4" />
          </motion.button>
          <div className="mx-2 h-4 w-px bg-white/10" />
          <motion.button
            onClick={handleReply}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 transition-colors"
          >
            <Reply className="h-4 w-4" />
          </motion.button>
          <motion.button
            onClick={handleForward}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 transition-colors"
          >
            <Forward className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 transition-colors"
          >
            <Archive className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </motion.button>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setShowHeaders(!showHeaders)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition-colors",
              showHeaders ? "bg-white/10 text-gray-300" : "text-gray-400 hover:bg-white/10"
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Headers
          </motion.button>
        </div>
      </div>

      {/* Email Headers */}
      <div className="border-b border-white/10 px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-200">{message.subject || "(No subject)"}</h1>
        <div className="mt-3 flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            {message.fromName?.[0]?.toUpperCase() ?? message.fromEmail[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-200">{message.fromName || message.fromEmail}</span>
              <span className="text-xs text-gray-500">&lt;{message.fromEmail}&gt;</span>
            </div>
            <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
              <span>
                To: {message.toAddresses.map((a) => formatAddress(a)).join(", ")}
              </span>
              <span>{formatRelativeTime(message.receivedAt ?? message.sentAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Original Headers (collapsible) */}
      <AnimatePresence>
        {showHeaders && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/10"
          >
            <div className="bg-gray-950 px-6 py-3 font-mono text-xs text-gray-400">
              {Object.entries(message.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2 py-0.5">
                  <span className="text-blue-400">{key}:</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {message.bodyHtml ? (
          <div
            className="prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm text-gray-300">{message.bodyText || "No content"}</pre>
        )}
      </div>

      {/* Attachments */}
      {message.attachments.length > 0 && (
        <div className="border-t border-white/10 px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">
              {message.attachments.length} Attachment{message.attachments.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <motion.button
                key={attachment.id}
                onClick={() => handleDownloadAttachment(attachment)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="truncate max-w-[150px]">{attachment.filename}</span>
                <span className="text-xs text-gray-500">
                  ({(attachment.size / 1024).toFixed(1)} KB)
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Reply Area */}
      <div className="border-t border-white/10 px-6 py-4">
        <motion.button
          onClick={handleReply}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
        >
          <Reply className="h-4 w-4" />
          Reply
        </motion.button>
      </div>
    </div>
  );
}