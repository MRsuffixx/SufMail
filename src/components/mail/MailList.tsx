"use client";

import { useCallback, useMemo, useRef } from "react";
import { FixedSizeList } from "react-window";
import { motion } from "framer-motion";
import { formatRelativeTime, cn } from "~/lib/ui/utils";
import { Star, Paperclip, ChevronRight } from "lucide-react";
import type { MessageListItem, LabelInfo } from "~/types/mail";
import { useMailStore } from "~/stores";

interface MailListProps {
  messages: MessageListItem[];
  isLoading?: boolean;
  onMessageClick?: (message: MessageListItem) => void;
  onMessageRightClick?: (message: MessageListItem, e: React.MouseEvent) => void;
  onThreadClick?: (threadId: string) => void;
  labels?: LabelInfo[];
}

interface MailListItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: MessageListItem[];
    labels: LabelInfo[];
    selectedMessageId: string | null;
    hoveredMessageId: string | null;
    onMessageClick?: (message: MessageListItem) => void;
    onMessageRightClick?: (message: MessageListItem, e: React.MouseEvent) => void;
  };
}

const MailListRow = ({ index, style, data }: MailListItemProps) => {
  const { messages, selectedMessageId, hoveredMessageId, onMessageClick, onMessageRightClick } = data;
  const message = messages[index];
  if (!message) return null;

  const isSelected = selectedMessageId === message.id;
  const isHovered = hoveredMessageId === message.id;
  const { setHoveredMessage } = useMailStore();

  const handleMouseEnter = useCallback(() => {
    setHoveredMessage(message.id);
  }, [message.id, setHoveredMessage]);

  const handleMouseLeave = useCallback(() => {
    setHoveredMessage(null);
  }, [setHoveredMessage]);

  const handleClick = useCallback(() => {
    onMessageClick?.(message);
  }, [message, onMessageClick]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onMessageRightClick?.(message, e);
    },
    [message, onMessageRightClick]
  );

  const fromDisplay = message.fromName || message.fromEmail;

  return (
    <div
      style={style}
      className={cn(
        "group flex items-center border-b border-white/5 px-4 cursor-pointer transition-colors",
        isSelected && "bg-blue-600/20",
        !isSelected && isHovered && "bg-white/5",
        !isSelected && !isHovered && "hover:bg-white/5"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Star indicator */}
      <div className="flex-shrink-0 w-8 flex items-center justify-center">
        {message.isStarred ? (
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-gray-600" />
        )}
      </div>

      {/* Sender */}
      <div className={cn(
        "flex-shrink-0 w-40 truncate text-sm font-medium",
        !message.isRead ? "text-gray-200" : "text-gray-400"
      )}>
        {fromDisplay}
      </div>

      {/* Subject and snippet */}
      <div className="flex-1 min-w-0 px-4">
        <div className="flex items-center gap-2">
          {message.labels.length > 0 && (
            <div className="flex items-center gap-1">
              {message.labels.slice(0, 2).map((label) => (
                <div
                  key={label.id}
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: label.color ?? "#666" }}
                />
              ))}
            </div>
          )}
          <span className={cn(
            "truncate text-sm",
            !message.isRead ? "text-gray-200 font-medium" : "text-gray-400"
          )}>
            {message.subject || "(No subject)"}
          </span>
        </div>
        <p className="truncate text-xs text-gray-500 mt-0.5">
          {message.snippet || "No preview available"}
        </p>
      </div>

      {/* Attachment indicator */}
      <div className="flex-shrink-0 w-16 flex items-center justify-end">
        {message.attachmentCount > 0 && (
          <div className="flex items-center gap-1 text-gray-500">
            <Paperclip className="h-3.5 w-3.5" />
            <span className="text-xs">{message.attachmentCount}</span>
          </div>
        )}
      </div>

      {/* Date */}
      <div className="flex-shrink-0 w-20 text-right">
        <span className="text-xs text-gray-500">
          {formatRelativeTime(message.receivedAt ?? message.sentAt)}
        </span>
      </div>

      {/* Expand arrow for threads */}
      <div className="flex-shrink-0 w-6 flex items-center justify-center">
        {message.threadId && (
          <ChevronRight className="h-4 w-4 text-gray-600" />
        )}
      </div>
    </div>
  );
};

export function MailList({
  messages,
  isLoading,
  onMessageClick,
  onMessageRightClick,
}: MailListProps) {
  const listRef = useRef<FixedSizeList>(null);
  const { selectedMessageId, hoveredMessageId } = useMailStore();

  const itemData = useMemo(
    () => ({
      messages,
      labels: [] as LabelInfo[],
      selectedMessageId,
      hoveredMessageId,
      onMessageClick,
      onMessageRightClick,
    }),
    [messages, selectedMessageId, hoveredMessageId, onMessageClick, onMessageRightClick]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!messages.length) return;

      const currentIndex = messages.findIndex((m) => m.id === selectedMessageId);

      if (e.key === "ArrowDown" && currentIndex < messages.length - 1) {
        e.preventDefault();
        const nextMessage = messages[currentIndex + 1];
        if (nextMessage) {
          useMailStore.getState().setSelectedMessage(nextMessage.id);
          listRef.current?.scrollToItem(currentIndex + 1);
        }
      } else if (e.key === "ArrowUp" && currentIndex > 0) {
        e.preventDefault();
        const prevMessage = messages[currentIndex - 1];
        if (prevMessage) {
          useMailStore.getState().setSelectedMessage(prevMessage.id);
          listRef.current?.scrollToItem(currentIndex - 1);
        }
      } else if (e.key === "Enter" && selectedMessageId) {
        const message = messages.find((m) => m.id === selectedMessageId);
        if (message) onMessageClick?.(message);
      }
    },
    [messages, selectedMessageId, onMessageClick]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-sm text-gray-500">Loading messages...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-gray-800 p-4">
            <svg className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-300">No messages</p>
            <p className="text-xs text-gray-500 mt-1">Your inbox is empty</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <FixedSizeList
        ref={listRef}
        height={window.innerHeight - 200}
        width="100%"
        itemCount={messages.length}
        itemSize={72}
        itemData={itemData}
        overscanCount={5}
      >
        {MailListRow}
      </FixedSizeList>
    </div>
  );
}