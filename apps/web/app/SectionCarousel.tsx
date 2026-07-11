"use client";

import styles from "./SectionCarousel.module.css";

export interface SectionCarouselProps {
  sections: { id: string; label: string }[];
  openIds: Set<string>;
  onToggle: (id: string) => void;
}

/**
 * Scrolling bottom carousel (Tommy: "the other sections... appear in a
 * scrolling bottom carousel of straw bales with each option on it. when
 * you click on each one of these options, that becomes full screen" — the
 * "full screen" part is now the per-note fullscreen button, since a note
 * can also just sit open as a floating panel; this carousel's own job is
 * only open/close). Clicking a card toggles that section's StickyNote.
 */
export default function SectionCarousel({ sections, openIds, onToggle }: SectionCarouselProps) {
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
    </div>
  );
}
