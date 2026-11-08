"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * Tommy: "on some of the editor pages a user on a web browser cant really
 * see anything under the main editor. are there any features or text that
 * i may be missing? ... lets add a small button on the bottom left of the
 * screen inside the left bar that when clicked, it has a small pop up that
 * says features of this page." Pinned to the bottom of the editor sidebar so
 * it's in the same place on every editor tab — the bottom-pinning
 * (`marginTop: auto` in that flex column) now belongs to SidebarIconCluster,
 * which this button shares a row with; this wrapper keeps only the
 * `position: relative` its own popup is anchored to, and sizes to the button
 * rather than to the column so the icons beside it are not pushed onto their
 * own rows. The list itself is a short, static
 * per-tab summary — mainly pointing at controls that live outside this
 * sidebar entirely (the Foundation/Floor/Roof tabs keep almost all of their
 * real inputs in the "<Tab> Tools" section further down the page, not here)
 * rather than trying to dynamically enumerate every section, which would
 * risk drifting out of sync with what's actually on screen.
 */
export interface PageFeaturesButtonProps {
  features: string[];
  /**
   * ⚠ **U7 — where a dismissed tutorial comes back from.**
   *
   * > *"Always reachable afterwards: the `?` on the tool reopens its cards. A
   * > tutorial you cannot get back is a tutorial you resent dismissing."*
   *
   * This `?` is the app's one help button and is in the same place on every
   * editor tab, so it is the honest answer to "where did that go" — better
   * than a per-tool `?`, because two of the three tools (a context menu and a
   * settings section) have no chrome of their own to hang one on.
   */
  tutorials?: { id: string; tool: string }[];
  onShowTutorial?: (id: string) => void;
}

export default function PageFeaturesButton({ features, tutorials, onShowTutorial }: PageFeaturesButtonProps) {
  const [open, setOpen] = useState(false);
  /** Where the popup floats, in viewport coordinates — see the portal below. */
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);

  return (
    <div style={{ position: "relative", lineHeight: 0 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Features of this page"
        title="Features of this page"
        /* ⚠ The anchor is measured from the EVENT's own target, never from a
           ref read during render — that is the trap U1 hit, where a ref read
           inside a render-time helper pushed `react-hooks/refs` up by one in a
           gate that forbids it rising. */
        onClick={(e) => {
          if (open) {
            setOpen(false);
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top + 6 });
          setOpen(true);
        }}
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          border: "1px solid #ccc",
          background: open ? "#eef3fa" : "#fff",
          color: "#3a5a8a",
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        ?
      </button>
      {/* ⚠ **PORTALLED TO THE BODY, and that is a fix rather than a flourish.**
          This popup used to be `position: absolute` inside the sidebar, where
          it was painted BEHIND the sidebar's own later content: measured
          2026-11-07 with the panel editor open, `elementFromPoint` at the
          popup's own centre returned `ElevationControls.structuralSection`, so
          the `?` opened something nobody could read. `zIndex: 100` could not
          win, because the competition is inside a stacking context the popup
          does not escape.

          ⚠ U7 is why it had to be fixed now rather than noted: this popup is
          where a dismissed tutorial comes back from, and *"a tutorial you
          cannot get back is a tutorial you resent dismissing"*. A reopen route
          that does not paint is not a reopen route. */}
      {open &&
        anchor !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-label="Features of this page"
            style={{
              position: "fixed",
              left: anchor.left,
              bottom: anchor.bottom,
              zIndex: 300,
              background: "#fff",
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: "10px 12px",
              width: 260,
              maxHeight: 320,
              overflowY: "auto",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              fontSize: 12,
            }}
          >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <strong>Features of this page</strong>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {features.map((f, i) => (
              <li key={i} style={{ marginBottom: 5 }}>
                {f}
              </li>
            ))}
          </ul>
          {tutorials && tutorials.length > 0 && onShowTutorial && (
            <div style={{ marginTop: 10, borderTop: "1px solid #e4e9ee", paddingTop: 8 }}>
              <strong style={{ display: "block", marginBottom: 5 }}>Show me a tool again</strong>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                {tutorials.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onShowTutorial(t.id);
                    }}
                    style={{
                      border: "none",
                      background: "none",
                      padding: 0,
                      font: "inherit",
                      color: "#3a5a8a",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                  >
                    {t.tool}
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>,
          document.body,
        )}
    </div>
  );
}
