"use client";

import { useState } from "react";
import {
  footprintAreaWithHolesSqFt,
  isCourtyardFootprint,
  isOffsetRefusal,
  offsetRefusalMessage,
  addCourtyard,
  type Footprint,
} from "@building-integrity/geometry";
import { resolveLengthEntry } from "./canvasGeometry";

/**
 * ADDING A COURTYARD — Tommy, 2026-10-20: *"The Octagon Ring is currently
 * impossible to build."*
 *
 * ⚠ **The number typed is the WIDTH OF THE BUILDING**, not the size of the
 * courtyard, and the label says so. A ring is specified by how deep the
 * building is all the way round; the hole is what is left. Asking for the
 * courtyard's size instead would make every irregular shape ambiguous — a
 * 40ft courtyard inside an octagon is 40ft across which way?
 *
 * ⚠ It works on any shape, which is his own requirement from 2026-10-21:
 * *"This should also be compatible with concentric Square/ rectangle
 * buildings."* Nothing here mentions octagons.
 */

export interface CourtyardPanelProps {
  footprint: Footprint;
  /** Commits the new footprint. The caller re-tiles; this never touches
   * panels. */
  onAddCourtyard: (next: Footprint) => void;
  onRemoveCourtyard: () => void;
}

const DEFAULT_WIDTH_FT = 12;

export default function CourtyardPanel({ footprint, onAddCourtyard, onRemoveCourtyard }: CourtyardPanelProps) {
  const [draft, setDraft] = useState(String(DEFAULT_WIDTH_FT));
  const [refusal, setRefusal] = useState<string | null>(null);
  const hasCourtyard = isCourtyardFootprint(footprint);

  const entry = resolveLengthEntry(draft, "ft");

  const add = () => {
    if (entry.value === null || entry.value <= 0) {
      setRefusal("Didn't understand that width.");
      return;
    }
    const next = addCourtyard(footprint, entry.value);
    if (isOffsetRefusal(next)) {
      setRefusal(offsetRefusalMessage(next, entry.value));
      return;
    }
    setRefusal(null);
    onAddCourtyard(next);
  };

  return (
    <div
      role="group"
      aria-label="Courtyard"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        padding: 8,
        boxSizing: "border-box",
        border: "1px solid #ddd",
        borderRadius: 6,
        background: "#fcfcfb",
      }}
    >
      <strong style={{ fontSize: 12 }}>Courtyard</strong>

      {hasCourtyard ? (
        <>
          <span style={{ fontSize: 11, color: "#444", lineHeight: 1.35 }}>
            This building is a ring around an open courtyard. Its walls total{" "}
            {Math.round(footprintAreaWithHolesSqFt(footprint))} sq ft of floor — the courtyard is not counted.
          </span>
          <button type="button" onClick={onRemoveCourtyard} style={{ fontSize: 12, padding: "5px 8px" }}>
            Remove the courtyard
          </button>
        </>
      ) : (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: "#444" }}>
            <span>Building width, all the way round</span>
            <input
              type="text"
              inputMode="decimal"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setRefusal(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "4px 6px",
                fontSize: 12,
                border: `1px solid ${refusal ? "#c0392b" : "#ccc"}`,
                borderRadius: 4,
              }}
            />
            {!refusal && entry.value !== null && <span style={{ color: "#777" }}>{entry.hint}</span>}
          </label>
          <button type="button" onClick={add} style={{ fontSize: 12, padding: "5px 8px" }}>
            Add a courtyard
          </button>
          {refusal && <span style={{ fontSize: 11, color: "#c0392b", lineHeight: 1.35 }}>{refusal}</span>}
          <span style={{ fontSize: 10, color: "#777", lineHeight: 1.35 }}>
            The courtyard is open to the sky, and the inner walls&apos; weather side faces into it.
          </span>
        </>
      )}
    </div>
  );
}
