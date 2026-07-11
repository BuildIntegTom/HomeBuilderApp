"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./StickyNote.module.css";

export interface StickyNoteProps {
  id: string;
  label: string;
  isOpen: boolean;
  isFullscreen: boolean;
  cascadeIndex: number;
  top?: number;
  left?: number;
  onClose: () => void;
  onToggleFullscreen: () => void;
  onPrint?: () => void;
  children: ReactNode;
}

/**
 * A floating panel for one section (Windows, Wall Assembly, Project
 * Totals, Review Log, or one Detail Guide/Shop Drawing page) — Tommy:
 * "the other sections... appear as its own sticky note on the screen and
 * has a toggle hide button on the top right... make sure we aren't hiding
 * any options... make them sticky notes that they themselves could become
 * full screen as well." Opened/closed via `SectionCarousel`; each note can
 * independently expand to fill the whole viewport. Returns null when
 * closed — the section's content simply isn't mounted (no display:none
 * bookkeeping needed here, unlike the old DocumentViewer pagination this
 * replaces).
 *
 * Draggable by its header (Tommy: "can we make post it notes be able to be
 * drug around the screen if their top bar is clicked and drug?") — drag
 * position is local component state (`dragPos`), only ever set once a drag
 * actually starts, so a note that's never been dragged keeps using its
 * `top`/`left` props/cascade default. Dragging is ignored while fullscreen
 * (position is `inset: 0` there regardless) and ignored when the pointer
 * goes down on one of the header's own buttons, so print/fullscreen/close
 * still work normally.
 */
export default function StickyNote({
  id,
  label,
  isOpen,
  isFullscreen,
  cascadeIndex,
  top,
  left,
  onClose,
  onToggleFullscreen,
  onPrint,
  children,
}: StickyNoteProps) {
  // Default spawn point sits just below the sticky TopBar (56px tall) —
  // Tommy: "sticky notes to spawn directly below/stuck to the top bar -
  // sometimes it looks like they spawn under and you cant see the bar" —
  // the old default (24px) landed inside the bar itself, so a note's
  // higher z-index visually covered part of it instead of appearing below.
  const baseTop = top ?? 68 + (cascadeIndex % 6) * 26;
  const baseLeft = left ?? 24 + (cascadeIndex % 6) * 26;

  const [dragPos, setDragPos] = useState<{ top: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOriginRef = useRef<{ pointerX: number; pointerY: number; startTop: number; startLeft: number } | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: PointerEvent) => {
      const origin = dragOriginRef.current;
      if (!origin) return;
      setDragPos({
        top: origin.startTop + (e.clientY - origin.pointerY),
        left: origin.startLeft + (e.clientX - origin.pointerX),
      });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragging]);

  if (!isOpen) return null;

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isFullscreen) return;
    if ((e.target as HTMLElement).closest("button")) return;
    dragOriginRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startTop: dragPos?.top ?? baseTop,
      startLeft: dragPos?.left ?? baseLeft,
    };
    setDragging(true);
  };

  return (
    <div
      id={id}
      className={`${styles.note} ${isFullscreen ? styles.noteFullscreen : ""} documentSection`}
      style={isFullscreen ? undefined : { top: dragPos?.top ?? baseTop, left: dragPos?.left ?? baseLeft }}
    >
      <div className={styles.header} onPointerDown={handleHeaderPointerDown}>
        <span className={styles.label}>{label}</span>
        <div className={styles.headerButtons}>
          {onPrint && (
            <button type="button" title="Print this section" className={styles.headerButton} onClick={onPrint}>
              🖶
            </button>
          )}
          <button
            type="button"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen this section"}
            className={styles.headerButton}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? "⤡" : "⤢"}
          </button>
          <button type="button" title="Hide this note" className={styles.headerButton} onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
