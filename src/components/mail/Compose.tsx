"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn, formatEmailAddress } from "~/lib/ui/utils";
import {
  X,
  Send,
  Paperclip,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Image,
} from "lucide-react";
import type { EmailRecipient, AttachmentUpload } from "~/types/ui";
import { api } from "~/trpc/react";
import { useToastStore, useWindowStore } from "~/stores";
import { generateId } from "~/lib/ui/utils";

interface ComposeProps {
  draftId?: string;
  replyTo?: {
    to: EmailRecipient[];
    cc?: EmailRecipient[];
    subject: string;
    body?: string;
  };
  forwardFrom?: {
    subject: string;
    body?: string;
    attachments?: AttachmentUpload[];
  };
  onClose?: () => void;
}

export function Compose({ draftId, replyTo, forwardFrom, onClose }: ComposeProps) {
  const [to, setTo] = useState<EmailRecipient[]>(replyTo?.to ?? []);
  const [cc, setCc] = useState<EmailRecipient[]>(replyTo?.cc ?? []);
  const [bcc, setBcc] = useState<EmailRecipient[]>([]);
  const [subject, setSubject] = useState(
    replyTo?.subject
      ? replyTo.subject.startsWith("Re:")
        ? replyTo.subject
        : `Re: ${replyTo.subject}`
      : forwardFrom?.subject
      ? forwardFrom.subject.startsWith("Fwd:")
        ? forwardFrom.subject
        : `Fwd: ${forwardFrom.subject}`
      : ""
  );
  const [showCc, setShowCc] = useState(!!replyTo?.cc?.length);
  const [showBcc, setShowBcc] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSendOptions, setShowSendOptions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToastStore();
  const { closeWindow } = useWindowStore();

  const sendMessageMutation = api.mail.sendMessage.useMutation({
    onSuccess: () => {
      addToast({ type: "success", title: "Message sent successfully" });
      setIsSending(false);
      onClose?.();
    },
    onError: (error) => {
      addToast({ type: "error", title: "Failed to send message", message: error.message });
      setIsSending(false);
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write your message...",
      }),
    ],
    content: forwardFrom?.body ?? replyTo?.body ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px] py-3",
      },
    },
  });

  const handleAddRecipient = useCallback(
    (type: "to" | "cc" | "bcc", email: string, name?: string) => {
      const recipient: EmailRecipient = { id: generateId(), email, name };
      if (type === "to") setTo((prev) => [...prev, recipient]);
      if (type === "cc") setCc((prev) => [...prev, recipient]);
      if (type === "bcc") setBcc((prev) => [...prev, recipient]);
    },
    []
  );

  const handleRemoveRecipient = useCallback(
    (type: "to" | "cc" | "bcc", id: string) => {
      if (type === "to") setTo((prev) => prev.filter((r) => r.id !== id));
      if (type === "cc") setCc((prev) => prev.filter((r) => r.id !== id));
      if (type === "bcc") setBcc((prev) => prev.filter((r) => r.id !== id));
    },
    []
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: AttachmentUpload[] = Array.from(files).map((file) => ({
      id: generateId(),
      filename: file.name,
      size: file.size,
      mimeType: file.type,
      progress: 0,
      status: "pending" as const,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    newAttachments.forEach((attachment, index) => {
      const fileToUpload = files[index];
      if (!fileToUpload) return;

      setTimeout(() => {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachment.id ? { ...a, progress: 100, status: "complete" as const, url: URL.createObjectURL(fileToUpload) } : a
          )
        );
      }, 1000);
    });
  }, []);

  const handleSend = useCallback(() => {
    if (to.length === 0) {
      addToast({ type: "error", title: "Please add at least one recipient" });
      return;
    }

    if (!subject.trim()) {
      addToast({ type: "error", title: "Please add a subject" });
      return;
    }

    setIsSending(true);

    sendMessageMutation.mutate({
      mailAccountId: "placeholder",
      to: to.map((r) => ({ email: r.email, name: r.name })),
      cc: cc.length > 0 ? cc.map((r) => ({ email: r.email, name: r.name })) : undefined,
      bcc: bcc.length > 0 ? bcc.map((r) => ({ email: r.email, name: r.name })) : undefined,
      subject,
      bodyHtml: editor?.getHTML() ?? "",
      scheduledAt: isScheduled && scheduledDate ? scheduledDate : undefined,
    });
  }, [to, cc, bcc, subject, editor, isScheduled, scheduledDate, sendMessageMutation, addToast]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const formatRecipient = (recipient: EmailRecipient) =>
    recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email;

  return (
    <div className="flex h-full flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-medium text-gray-200">New Message</span>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setShowSendOptions(!showSendOptions)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.button>
          <motion.button
            onClick={handleClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* Send Options */}
      {showSendOptions && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-b border-white/10 px-4 py-2"
        >
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
              />
              <Clock className="h-4 w-4" />
              Schedule send
            </label>
            {isScheduled && (
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="rounded-md border border-white/10 bg-gray-800 px-3 py-1.5 text-sm text-gray-300"
              />
            )}
          </div>
        </motion.div>
      )}

      {/* Recipients */}
      <div className="border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-12 text-sm text-gray-500">To:</span>
          <div className="flex flex-wrap items-center gap-1 flex-1">
            {to.map((recipient) => (
              <motion.span
                key={recipient.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1 rounded-full bg-blue-600/20 px-2 py-1 text-xs text-blue-400"
              >
                {recipient.name || recipient.email}
                <button
                  onClick={() => handleRemoveRecipient("to", recipient.id)}
                  className="ml-1 hover:text-blue-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
            <input
              type="email"
              placeholder="Add recipient..."
              className="flex-1 min-w-[150px] bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) {
                    handleAddRecipient("to", value);
                    (e.target as HTMLInputElement).value = "";
                  }
                }
              }}
            />
          </div>
        </div>

        {showCc && (
          <div className="flex items-center gap-2 mb-2">
            <span className="w-12 text-sm text-gray-500">Cc:</span>
            <div className="flex flex-wrap items-center gap-1 flex-1">
              {cc.map((recipient) => (
                <motion.span
                  key={recipient.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1 rounded-full bg-gray-600/20 px-2 py-1 text-xs text-gray-400"
                >
                  {recipient.name || recipient.email}
                  <button
                    onClick={() => handleRemoveRecipient("cc", recipient.id)}
                    className="ml-1 hover:text-gray-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              ))}
              <input
                type="email"
                placeholder="Add CC..."
                className="flex-1 min-w-[150px] bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      handleAddRecipient("cc", value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
            </div>
          </div>
        )}

        {showBcc && (
          <div className="flex items-center gap-2 mb-2">
            <span className="w-12 text-sm text-gray-500">Bcc:</span>
            <div className="flex flex-wrap items-center gap-1 flex-1">
              {bcc.map((recipient) => (
                <motion.span
                  key={recipient.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-1 rounded-full bg-gray-600/20 px-2 py-1 text-xs text-gray-400"
                >
                  {recipient.name || recipient.email}
                  <button
                    onClick={() => handleRemoveRecipient("bcc", recipient.id)}
                    className="ml-1 hover:text-gray-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.span>
              ))}
              <input
                type="email"
                placeholder="Add BCC..."
                className="flex-1 min-w-[150px] bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const value = (e.target as HTMLInputElement).value.trim();
                    if (value) {
                      handleAddRecipient("bcc", value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Cc
            </button>
          )}
          {!showBcc && (
            <button
              onClick={() => setShowBcc(true)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Bcc
            </button>
          )}
        </div>
      </div>

      {/* Subject */}
      <div className="border-b border-white/10 px-4 py-2">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-white/10 px-4 py-2">
        <button
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            editor?.isActive("bold") ? "bg-white/10 text-gray-200" : "text-gray-400 hover:bg-white/10"
          )}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            editor?.isActive("italic") ? "bg-white/10 text-gray-200" : "text-gray-400 hover:bg-white/10"
          )}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            editor?.isActive("bulletList") ? "bg-white/10 text-gray-200" : "text-gray-400 hover:bg-white/10"
          )}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            editor?.isActive("orderedList") ? "bg-white/10 text-gray-200" : "text-gray-400 hover:bg-white/10"
          )}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
        <div className="mx-2 h-4 w-px bg-white/10" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-white/10 transition-colors"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-4">
        <EditorContent editor={editor} className="h-full" />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-2">
          {attachments.map((attachment) => (
            <motion.div
              key={attachment.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-gray-400"
            >
              <Paperclip className="h-3 w-3" />
              <span>{attachment.filename}</span>
              {attachment.status === "uploading" && (
                <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              )}
              {attachment.status === "complete" && (
                <button onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== attachment.id))}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
        <span className="text-xs text-gray-500">
          {isScheduled ? `Scheduled for ${scheduledDate}` : "Draft autosaved"}
        </span>
        <motion.button
          onClick={handleSend}
          disabled={isSending}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          <Send className="h-4 w-4" />
          {isSending ? "Sending..." : isScheduled ? "Schedule" : "Send"}
        </motion.button>
      </div>
    </div>
  );
}