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
  /** Renders in normal document flow, sized to its parent's own width,
   * instead of the usual floating/draggable overlay (Tommy: "when you
   * click on a panel or other 2d or 3d element, the [popup]... appears at
   * the bottom of the left bar above the question mark") — for a note a
   * caller wants docked inline in a fixed layout slot rather than floating
   * wherever it last cascaded/was dragged to. Not draggable while docked
   * (there's nowhere to drag it to). Still expands to the same full-
   * viewport `isFullscreen` overlay as any other note — docked only
   * changes the NON-fullscreen presentation. */
  docked?: boolean;
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
// Mirrors globals.css's --topbar-height custom property (plain CSS custom
// properties aren't readable from a JS default-prop expression without an
// extra getComputedStyle round trip, so this stays a plain constant kept in
// sync by hand) — every spawn point in this app, fullscreen or not,
// measures from here (Tommy: "let's make the bottom of the top bar a real
// notable place where everything else spawns").
const TOPBAR_HEIGHT_PX = 56;
const NOTE_SPAWN_MARGIN_PX = 12;

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
  docked = false,
}: StickyNoteProps) {
  // Default spawn point sits just below the sticky TopBar — Tommy: "sticky
  // notes to spawn directly below/stuck to the top bar - sometimes it
  // looks like they spawn under and you cant see the bar" — the old
  // default (24px) landed inside the bar itself, so a note's higher
  // z-index visually covered part of it instead of appearing below.
  const baseTop = top ?? TOPBAR_HEIGHT_PX + NOTE_SPAWN_MARGIN_PX + (cascadeIndex % 6) * 26;
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
    if (isFullscreen || docked) return;
    if ((e.target as HTMLElement).closest("button")) return;
    dragOriginRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startTop: dragPos?.top ?? baseTop,
      startLeft: dragPos?.left ?? baseLeft,
    };
    setDragging(true);
  };

  const dockedNotFullscreen = docked && !isFullscreen;

  return (
    <div
      id={id}
      className={`${styles.note} ${isFullscreen ? styles.noteFullscreen : dockedNotFullscreen ? styles.noteDocked : ""} documentSection`}
      style={isFullscreen || dockedNotFullscreen ? undefined : { top: dragPos?.top ?? baseTop, left: dragPos?.left ?? baseLeft }}
    >
      {/* The header BAR still prints, deliberately; only its buttons are
          chrome. For a note that renders no SheetTitleBlock (Review Log,
          Project Totals, Assembly Performance -- all of which expose a
          working print button), `label` is the printed document's only
          title, so hiding the whole header left the Review Log printing as
          a bare <ul> with nothing saying what it was. globals.css strips
          the bar's own background/border/grab cursor in print so the label
          reads as a plain heading. */}
      <div
        className={`${styles.header} documentSectionHeader`}
        style={docked && !isFullscreen ? { cursor: "default" } : undefined}
        onPointerDown={handleHeaderPointerDown}
      >
        <span className={styles.label}>{label}</span>
        <div className={`${styles.headerButtons} print-hidden-chrome`}>
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
      {/* `documentSectionBody` is a plain global class (like
          `documentSection` above) so globals.css's shared print block can
          neutralize this box's screen-only `overflow-y: auto` + padding
          without reaching into this module's hashed class names. A
          scrolling box is unfragmentable in paged media -- the browser clips
          it instead of flowing it onto the next page. */}
      <div className={`${styles.body} documentSectionBody`}>{children}</div>
    </div>
  );
}
