"use client";

/**
 * REPANELIZE R1 — the caution marker.
 *
 * Tommy, 2026-10-07: *"Perhaps a small triangle caution icon that's red and
 * orange can appear next to any settings that have been changed but not
 * implemented like changing panel size ect"*.
 *
 * It sits beside a setting whose value no longer matches the one the current
 * building was panelized with. The setting is not broken and the change was
 * not lost — it simply applies to the next panelization, and without this
 * the control looks like it did nothing.
 *
 * ⚠ **It is not decoration, so it is not `aria-hidden`.** A setting that
 * silently does nothing is exactly as confusing read aloud as it is seen,
 * and this is the same "a visible gap beats a substituted value" rule the
 * rest of the app applies to provisional values. The glyph carries a
 * `title` for hover and an `aria-label` for everything else.
 */
export default function PendingRetileMark({ what }: { what: string }) {
  const label = `${what} has changed since this building was panelized. Existing panels keep the old value until it is panelized again.`;
  return (
    <svg
      role="img"
      aria-label={label}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      style={{ verticalAlign: "-1px", marginLeft: 4, flex: "none" }}
    >
      <title>{label}</title>
      {/* Orange fill, red edge — his words. Drawn rather than an emoji so it
          renders identically on every platform and scales with nothing. */}
      <path d="M6 1 L11.2 10.5 L0.8 10.5 Z" fill="#f0a020" stroke="#c0392b" strokeWidth="1.2" strokeLinejoin="round" />
      <rect x="5.35" y="4.3" width="1.3" height="3.4" rx="0.5" fill="#7a2016" />
      <rect x="5.35" y="8.3" width="1.3" height="1.3" rx="0.55" fill="#7a2016" />
    </svg>
  );
}
