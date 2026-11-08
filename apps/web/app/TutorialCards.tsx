"use client";

import { useState } from "react";
import TutorialArt from "./TutorialArt";
import { TUTORIAL_MEMORY_NOTE, type Tutorial } from "./tutorials";

/**
 * ⚠ **U7's cards.** Three per tool, the first time you open it.
 *
 * > *"Not a manual — three illustrated cards the first time you open a tool,
 * > with DONE and a link to general help."*
 *
 * ⚠ **It does not block the tool it is teaching.** This is a panel in the
 * corner, not a modal over the app: the whole point is that it arrives at the
 * moment you first touch a tool, and a card you have to dismiss before you can
 * look at the thing it describes teaches nothing. Escape closes it, and so
 * does DONE — both count as seen, because a dismissal IS the answer to "have
 * you read this".
 *
 * ⚠ **The last card says what the remembering does NOT do.** See
 * `TUTORIAL_MEMORY_NOTE`: a promise about memory is exactly the kind of thing a
 * user discovers is wrong on their second device, so it is stated where the
 * promise is made.
 */
export interface TutorialCardsProps {
  tutorial: Tutorial;
  /** Dismissed — by DONE, by Escape, or by the ×. Always counts as seen. */
  onDone: () => void;
  /** Opens the app's general help. The teardown's *"a link to general help"*. */
  onOpenReadMe: () => void;
}

export default function TutorialCards({ tutorial, onDone, onOpenReadMe }: TutorialCardsProps) {
  const [index, setIndex] = useState(0);
  const card = tutorial.cards[index]!;
  const isLast = index === tutorial.cards.length - 1;

  return (
    <div
      role="dialog"
      aria-label={`${tutorial.tool} — a quick tour`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone();
        }
      }}
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        /* ⚠ Above the editor and its notes, below nothing that matters: a
           context menu opened on top of this must still win, because this is
           teaching that menu. */
        zIndex: 180,
        width: 288,
        background: "#fff",
        border: "1px solid #c7d0d9",
        borderRadius: 10,
        boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
        padding: 14,
        font: "13px/1.45 system-ui, sans-serif",
        color: "#1d2733",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase", color: "#5a6a7a" }}>
          {tutorial.tool}
        </strong>
        <button
          type="button"
          aria-label="Close this tour"
          onClick={onDone}
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16, lineHeight: 1, color: "#5a6a7a" }}
        >
          ×
        </button>
      </div>

      <div style={{ margin: "10px 0 8px" }}>
        <TutorialArt art={card.art} />
      </div>

      <h3 style={{ margin: "0 0 4px", fontSize: 14 }}>{card.title}</h3>
      <p style={{ margin: 0 }}>{card.body}</p>

      {isLast && (
        <p style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.4, color: "#6b7785" }}>{TUTORIAL_MEMORY_NOTE}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        {/* Which card you are on, and how many there are — so "three cards"
            is a promise the reader can see being kept. */}
        <div style={{ display: "flex", gap: 4, flex: 1 }} aria-hidden="true">
          {tutorial.cards.map((c, i) => (
            <span
              key={c.title}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: i === index ? "#3a5a8a" : "#cfd8e1",
              }}
            />
          ))}
        </div>
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Card {index + 1} of {tutorial.cards.length}
        </span>
        {index > 0 && (
          <button type="button" onClick={() => setIndex((i) => i - 1)} style={secondaryButton}>
            Back
          </button>
        )}
        {isLast ? (
          <button type="button" onClick={onDone} style={primaryButton} autoFocus>
            Done
          </button>
        ) : (
          <button type="button" onClick={() => setIndex((i) => i + 1)} style={primaryButton} autoFocus>
            Next
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenReadMe}
        style={{
          marginTop: 8,
          border: "none",
          background: "none",
          padding: 0,
          font: "inherit",
          fontSize: 12,
          color: "#3a5a8a",
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        Open the Read Me
      </button>
    </div>
  );
}

const primaryButton: React.CSSProperties = {
  font: "inherit",
  fontWeight: 600,
  padding: "4px 12px",
  borderRadius: 6,
  border: "1px solid #3a5a8a",
  background: "#3a5a8a",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  font: "inherit",
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid #b7c2cd",
  background: "#fff",
  color: "#28333f",
  cursor: "pointer",
};
