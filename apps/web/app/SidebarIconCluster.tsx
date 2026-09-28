"use client";

import type { ReactNode } from "react";
import styles from "./SidebarIconCluster.module.css";

/**
 * The editor sidebar's bottom-left icon cluster (spec: "Top Bar & Navigation
 * Reorganisation" §9a, stage U0).
 *
 * Tommy: *"Put the read me as it's own cute little icon next to the ? On the
 * left bar on the bottom. I want report bug / request feature also as an icon
 * near the ?"*, and *"Let's make a cute fat outline of a log icon with the word
 * review on it (review log lol) and add that near the ? On the bottom left."*
 *
 * So four icons share the row at 240px: the existing `?` (`PageFeaturesButton`,
 * which keeps its own popup), then Review Log, Report Bug and Read Me. The
 * cluster itself owns the bottom-pinning (`margin-top: auto`) that
 * `PageFeaturesButton` used to own alone.
 *
 * INLINE SVG, NOT A WEBFONT — the same call the top bar's `GearIcon` made, for
 * the same recorded reasons: no network dependency, no FOUT, no licensing
 * question.
 *
 * WHY IT WRAPS RATHER THAN SCROLLS OR SHRINKS, and why it is a column at 64px:
 * see SidebarIconCluster.module.css, which has the measurement. Short version —
 * the 64px rail's usable width is ~40px, not 56px, because it scrolls and the
 * scrollbar takes ~15px, so two-across is not available there and `flex-wrap`
 * re-flows the cluster into one column. It must never become `nowrap` with an
 * `overflow`: an icon scrolled sideways out of a 40px column is exactly the
 * silently-unreachable failure this whole reorganisation exists to avoid.
 *
 * ⚠ At 64px that column is ~115px tall and can sit below the fold, so reaching
 * it uses the vertical scroll that rail already needs for its own tool sections.
 * `apps/web/harness/ui-reorg-u0` measures how far below rather than leaving it
 * to be discovered.
 */
export function SidebarIconCluster({ children }: { children: ReactNode }) {
  return (
    <div role="group" aria-label="Help, review log and feedback" data-sidebar-icon-cluster="" className={styles.cluster}>
      {children}
    </div>
  );
}

export interface SidebarIconButtonProps {
  /** Both the `aria-label` and the `title`: the icon-only rule from the Top
   * Bar section is that an icon-only control carries a real name in both. */
  label: string;
  /** True while the surface this icon opens is on screen. */
  active: boolean;
  onClick: () => void;
  /** Wider than tall, for the log — its whole point is the word on it. */
  wide?: boolean;
  children: ReactNode;
}

/** One icon in the cluster, styled to match `PageFeaturesButton`'s `?`
 * exactly: same 26px height, same 1px #ccc outline, same navy, same
 * open/closed background. */
export function SidebarIconButton({ label, active, onClick, wide = false, children }: SidebarIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`${active ? styles.iconActive : styles.icon}${wide ? ` ${styles.iconWide}` : ""}`}
    >
      {children}
    </button>
  );
}

/**
 * A fat-outline log — the timber kind — with the word "review" on it. Tommy's
 * joke ("review log lol"), so the word is the point and it has to be legible:
 * that is the one reason this icon is 42px wide where the others are 26px
 * square. A log is wider than tall anyway.
 *
 * Drawn as a cut end (ellipse + one growth ring) plus two long edges closed by
 * a curve at the far end, so it reads as a log rather than a pill.
 */
export function ReviewLogIcon() {
  return (
    <svg width="38" height="24" viewBox="0 0 42 26" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M8.5 4H34.5" />
        <path d="M8.5 22H34.5" />
        <path d="M34.5 4a5.5 9 0 0 1 0 18" />
        <ellipse cx="8.5" cy="13" rx="5.5" ry="9" />
      </g>
      <ellipse cx="8.5" cy="13" rx="2.3" ry="4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <text
        x="25.5"
        y="15.4"
        textAnchor="middle"
        fontSize="6"
        fontWeight="700"
        fontFamily="var(--font-geist-sans), sans-serif"
        fill="currentColor"
      >
        review
      </text>
    </svg>
  );
}

/** A cute outline bug: round head with two antennae, oval body with two
 * spots, three legs a side. Tommy: "a cute outline of a bug". */
export function BugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M10 4.4 8 2" />
        <path d="M14 4.4 16 2" />
        <circle cx="12" cy="6.6" r="2.7" />
        <ellipse cx="12" cy="14.5" rx="5" ry="6.5" />
        <path d="M7.2 11 3.6 9.2" />
        <path d="M6.9 14.5H3.2" />
        <path d="M7.2 18 3.6 19.8" />
        <path d="M16.8 11 20.4 9.2" />
        <path d="M17.1 14.5H20.8" />
        <path d="M16.8 18 20.4 19.8" />
      </g>
      <circle cx="10.1" cy="13" r="0.95" fill="currentColor" />
      <circle cx="13.9" cy="16" r="0.95" fill="currentColor" />
    </svg>
  );
}

/** An open book: the read-me. Outline only, to sit with the `?` and the bug. */
export function ReadMeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6.4C9.9 4.8 6.6 4.2 3.8 4.8v14c2.8-.6 6.1 0 8.2 1.6" />
        <path d="M12 6.4c2.1-1.6 5.4-2.2 8.2-1.6v14c-2.8-.6-6.1 0-8.2 1.6" />
        <path d="M12 6.4v14" />
      </g>
    </svg>
  );
}
