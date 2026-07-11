"use client";

import type { ReactNode } from "react";
import styles from "./SectionCarousel.module.css";

export interface SectionCarouselProps {
  sections: { id: string; label: string }[];
  openIds: Set<string>;
  onToggle: (id: string) => void;
  /** Rendered as the last item in the scrolling list (Tommy: "for the right
   * side bar, can they snap to the top bar and the bottom?" — the strip now
   * spans the full height under the TopBar down to the very bottom edge, so
   * there's no separate fixed-height footer strip below it anymore; the
   * sandbox link just scrolls along with the section cards instead). */
  footer?: ReactNode;
}

/**
 * Scrolling right-hand carousel (originally a bottom bar, per Tommy: "the
 * other sections... appear in a scrolling carousel of straw bales with
 * each option on it" — later moved to a vertical strip on the right edge,
 * scrolling up/down, so it reserves its own layout space instead of
 * overlaying the editor canvas). Clicking a card toggles that section's
 * StickyNote; a note's own fullscreen button (not this carousel) is what
 * makes it fill the screen.
 */
export default function SectionCarousel({ sections, openIds, onToggle, footer }: SectionCarouselProps) {
  return (
    <div className={`${styles.carousel} print-hidden-chrome`} role="group" aria-label="Sections">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          title={s.label}
          aria-pressed={openIds.has(s.id)}
          className={openIds.has(s.id) ? styles.cardActive : styles.card}
          onClick={() => onToggle(s.id)}
        >
          {s.label}
        </button>
      ))}
      {footer && <div className={styles.footerSlot}>{footer}</div>}
    </div>
  );
}
