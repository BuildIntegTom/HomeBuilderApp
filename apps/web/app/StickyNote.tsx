"use client";

import type { ReactNode } from "react";
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
  if (!isOpen) return null;

  return (
    <div
      id={id}
      className={`${styles.note} ${isFullscreen ? styles.noteFullscreen : ""} documentSection`}
      style={
        isFullscreen
          ? undefined
          : { top: top ?? 24 + (cascadeIndex % 6) * 26, left: left ?? 24 + (cascadeIndex % 6) * 26 }
      }
    >
      <div className={styles.header}>
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
