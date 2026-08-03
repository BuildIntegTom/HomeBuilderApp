"use client";

import type { ReactNode } from "react";
import styles from "./SectionCarousel.module.css";

export interface SectionCarouselProps {
  sections: { id: string; label: string }[];
  openIds: Set<string>;
  onToggle: (id: string) => void;
  /** Rendered as the first item, above every section card (Tommy: "at the
   * top of the right bar, lets make an export pdf button") — a fixed slot
   * for actions that apply across sections, not a section toggle itself. */
  header?: ReactNode;
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
export default function SectionCarousel({ sections, openIds, onToggle, header, footer }: SectionCarouselProps) {
  return (
    <div className={`${styles.carousel} print-hidden-chrome`} role="group" aria-label="Sections">
      {header && <div className={styles.headerSlot}>{header}</div>}
      {sections.map((s) => {
        // Shop Fabrication pages (Tommy: "color code all of the shop
        // fabrication buttons... to a light green color with purple
        // outline") — every real cut-list page uses this "shop"/"shop-fab-"
        // id prefix (see relevantDetailPages in page.tsx), so the prefix
        // alone reliably distinguishes them from every other section card.
        const isShopFab = s.id.startsWith("shop");
        const isOpen = openIds.has(s.id);
        const className = isShopFab ? (isOpen ? styles.cardShopFabActive : styles.cardShopFab) : isOpen ? styles.cardActive : styles.card;
        return (
          <button key={s.id} type="button" title={s.label} aria-pressed={isOpen} className={className} onClick={() => onToggle(s.id)}>
            {s.label}
          </button>
        );
      })}
      {footer && <div className={styles.footerSlot}>{footer}</div>}
    </div>
  );
}
