"use client";

import { useState } from "react";

/**
 * Tommy: "on some of the editor pages a user on a web browser cant really
 * see anything under the main editor. are there any features or text that
 * i may be missing? ... lets add a small button on the bottom left of the
 * screen inside the left bar that when clicked, it has a small pop up that
 * says features of this page." Pinned to the bottom of the editor sidebar
 * (see page.module.css's .editorSidebar — this button's own wrapper uses
 * `marginTop: auto` to push it to the bottom of that flex column) so it's
 * in the same place on every editor tab. The list itself is a short, static
 * per-tab summary — mainly pointing at controls that live outside this
 * sidebar entirely (the Foundation/Floor/Roof tabs keep almost all of their
 * real inputs in the "<Tab> Tools" section further down the page, not here)
 * rather than trying to dynamically enumerate every section, which would
 * risk drifting out of sync with what's actually on screen.
 */
export interface PageFeaturesButtonProps {
  features: string[];
}

export default function PageFeaturesButton({ features }: PageFeaturesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", marginTop: "auto", width: "100%" }}>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Features of this page"
        title="Features of this page"
        onClick={() => setOpen((was) => !was)}
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
      {open && (
        <div
          role="dialog"
          aria-label="Features of this page"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            zIndex: 100,
            marginBottom: 6,
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
        </div>
      )}
    </div>
  );
}
