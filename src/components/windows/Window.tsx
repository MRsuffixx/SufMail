"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWindowStore } from "~/stores";
import { cn } from "~/lib/ui/utils";
import { clamp } from "~/lib/ui/utils";
import type { ResizeEdge, WindowConfig } from "~/types/ui";
import {
  Minus,
  Square,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface WindowProps {
  config: WindowConfig;
  children?: React.ReactNode;
  onClose?: () => void;
}

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;

export function Window({ config, children, onClose }: WindowProps) {
  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    updateWindowPosition,
    updateWindowSize,
    focusWindow,
    activeWindowId,
  } = useWindowStore();

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<ResizeEdge | null>(null);
  const [localPosition, setLocalPosition] = useState(config.position);
  const [localSize, setLocalSize] = useState(config.size);

  const windowRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ size: { width: 0, height: 0 }, position: { x: 0, y: 0 }, mouse: { x: 0, y: 0 } });

  const isActive = activeWindowId === config.id;

  useEffect(() => {
    setLocalPosition(config.position);
    setLocalSize(config.size);
  }, [config.position, config.size]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      focusWindow(config.id);
    },
    [config.id, focusWindow]
  );

  const handleTitleBarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (config.state === "maximized") return;

      e.preventDefault();
      setIsDragging(true);
      focusWindow(config.id);

      dragOffsetRef.current = {
        x: e.clientX - localPosition.x,
        y: e.clientY - localPosition.y,
      };
    },
    [config.id, config.state, focusWindow, localPosition]
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, edge: ResizeEdge) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      setIsResizing(true);
      setResizeEdge(edge);
      focusWindow(config.id);

      resizeStartRef.current = {
        size: { ...localSize },
        position: { ...localPosition },
        mouse: { x: e.clientX, y: e.clientY },
      };
    },
    [config.id, focusWindow, localPosition, localSize]
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = clamp(e.clientX - dragOffsetRef.current.x, 0, window.innerWidth - 100);
        const newY = clamp(e.clientY - dragOffsetRef.current.y, 0, window.innerHeight - 100);
        setLocalPosition({ x: newX, y: newY });
      } else if (isResizing && resizeEdge) {
        const deltaX = e.clientX - resizeStartRef.current.mouse.x;
        const deltaY = e.clientY - resizeStartRef.current.mouse.y;

        let newWidth = resizeStartRef.current.size.width;
        let newHeight = resizeStartRef.current.size.height;
        let newX = resizeStartRef.current.position.x;
        let newY = resizeStartRef.current.position.y;

        if (resizeEdge.includes("e")) {
          newWidth = Math.max(MIN_WIDTH, resizeStartRef.current.size.width + deltaX);
        }
        if (resizeEdge.includes("w")) {
          const potentialWidth = resizeStartRef.current.size.width - deltaX;
          if (potentialWidth >= MIN_WIDTH) {
            newWidth = potentialWidth;
            newX = resizeStartRef.current.position.x + deltaX;
          }
        }
        if (resizeEdge.includes("s")) {
          newHeight = Math.max(MIN_HEIGHT, resizeStartRef.current.size.height + deltaY);
        }
        if (resizeEdge.includes("n")) {
          const potentialHeight = resizeStartRef.current.size.height - deltaY;
          if (potentialHeight >= MIN_HEIGHT) {
            newHeight = potentialHeight;
            newY = resizeStartRef.current.position.y + deltaY;
          }
        }

        setLocalSize({ width: newWidth, height: newHeight });
        setLocalPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        updateWindowPosition(config.id, localPosition);
        setIsDragging(false);
      }
      if (isResizing) {
        updateWindowSize(config.id, localSize);
        setIsResizing(false);
        setResizeEdge(null);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, resizeEdge, config.id, localPosition, localSize, updateWindowPosition, updateWindowSize]);

  const handleClose = useCallback(() => {
    closeWindow(config.id);
    onClose?.();
  }, [config.id, closeWindow, onClose]);

  const handleMinimize = useCallback(() => {
    minimizeWindow(config.id);
  }, [config.id, minimizeWindow]);

  const handleMaximize = useCallback(() => {
    if (config.state === "maximized") {
      restoreWindow(config.id);
    } else {
      maximizeWindow(config.id);
    }
  }, [config.id, config.state, maximizeWindow, restoreWindow]);

  if (config.isMinimized) {
    return null;
  }

  const windowStyle =
    config.state === "maximized"
      ? { top: 0, left: 0, width: "100%", height: "100%" }
      : {
          top: localPosition.y,
          left: localPosition.x,
          width: localSize.width,
          height: localSize.height,
        };

  return (
    <motion.div
      ref={windowRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "absolute flex flex-col rounded-xl border border-white/10 bg-gray-900/95 backdrop-blur-xl shadow-2xl",
        isActive ? "ring-2 ring-blue-500/50" : "ring-1 ring-white/5"
      )}
      style={{
        ...windowStyle,
        zIndex: config.zIndex,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Title Bar */}
      <div
        className="flex h-10 items-center justify-between border-b border-white/10 bg-gray-800/50 px-3 select-none rounded-t-xl"
        onMouseDown={handleTitleBarMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <div className="h-3 w-3 rounded-full bg-green-500" />
        </div>
        <span className="flex-1 text-center text-xs font-medium text-gray-300 truncate">
          {config.title}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/10 transition-colors"
          >
            <Minus className="h-3 w-3 text-gray-400" />
          </button>
          <button
            onClick={handleMaximize}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-white/10 transition-colors"
          >
            {config.state === "maximized" ? (
              <Minimize2 className="h-3 w-3 text-gray-400" />
            ) : (
              <Maximize2 className="h-3 w-3 text-gray-400" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-red-500/80 transition-colors"
          >
            <X className="h-3 w-3 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Resize Handles */}
      {config.state !== "maximized" && (
        <>
          <div
            className="absolute top-0 left-0 w-2 h-full cursor-w-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "w")}
          />
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-e-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "e")}
          />
          <div
            className="absolute bottom-0 left-0 h-2 w-full cursor-s-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "s")}
          />
          <div
            className="absolute top-0 left-0 w-2 h-2 cursor-nw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "nw")}
          />
          <div
            className="absolute top-0 right-0 w-2 h-2 cursor-ne-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "ne")}
          />
          <div
            className="absolute bottom-0 left-0 w-2 h-2 cursor-sw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "sw")}
          />
          <div
            className="absolute bottom-0 right-0 w-2 h-2 cursor-se-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, "se")}
          />
        </>
      )}
    </motion.div>
  );
}