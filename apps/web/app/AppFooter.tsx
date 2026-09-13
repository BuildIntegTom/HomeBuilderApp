"use client";

import { useEffect, useState } from "react";
import { FOOTER_FULL_TEXT_ID, footerDisclaimerFor } from "./footerDisclaimer";
import type { ViewerRole } from "./viewerRole";
import styles from "./AppFooter.module.css";

/**
 * Fixed bottom-of-screen chrome carrying the current viewer role's disclaimer
 * (spec: "Top Bar & App Chrome — the Stitch reorganisation", Stage 3).
 *
 * THE TEXT IS VERBATIM. It is `roleDisclaimers[role]` via footerDisclaimerFor,
 * the same object the printed title block uses. Nothing here shortens it.
 *
 * THE LENGTH, SOLVED IN LAYOUT. The engineer disclaimer is ~200 characters;
 * the strip is 24px (--footer-height) with text at the 11px legal floor. The
 * strip is one line, ellipsised, and the whole strip is a button:
 *   - its accessible name is the full text (CSS ellipsis is visual only),
 *   - its `title` is the full text on hover,
 *   - clicking or tapping it (keyboard included) opens the full wrapped text
 *     in a panel that grows UPWARD out of the strip.
 * The strip itself never changes height, so --footer-height stays a constant
 * and nothing that measures against it can drift. The panel overlays the
 * canvas only while the user has asked for it; Escape or the strip closes it.
 *
 * STAYS ON SCREEN, NOT ON PAPER. page.tsx wraps this in print-hidden-chrome,
 * like the top bar. Printed sheets carry their own disclaimer in
 * SheetTitleBlock.
 *
 * z-index sits above a fullscreen StickyNote (500): a fullscreen note ends at
 * the footer's top edge, so the upward full-text panel would otherwise open
 * underneath it and the text would be unreachable in exactly that state.
 */
export default function AppFooter({ role }: { role: ViewerRole }) {
  const [expanded, setExpanded] = useState(false);
  const { label, text } = footerDisclaimerFor(role);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <footer className={styles.footer} aria-label="Viewer role disclaimer">
      {expanded && (
        <div id={FOOTER_FULL_TEXT_ID} className={styles.fullText} data-footer-full-text>
          <span className={styles.label}>{label}</span> <span>{text}</span>
        </div>
      )}
      <button
        type="button"
        className={styles.strip}
        title={text}
        aria-expanded={expanded}
        aria-controls={FOOTER_FULL_TEXT_ID}
        onClick={() => setExpanded((was) => !was)}
        data-footer-strip
      >
        <span className={styles.label}>{label}</span>
        <span className={styles.text} data-footer-text>
          {text}
        </span>
        <span className={styles.caret} aria-hidden="true">
          {expanded ? "▾" : "▴"}
        </span>
      </button>
      {/* Privacy Policy and Legal Disclaimer links belong here, at the right
          end of the strip (as in the Stitch mockups). NOT BUILT: those
          documents do not exist yet and are Tommy's to supply — no placeholder
          pages and no links to "#". See the spec's Open Items. When they land,
          add them as a non-shrinking group after the strip button so the
          disclaimer text is still the only thing that truncates. */}
    </footer>
  );
}
