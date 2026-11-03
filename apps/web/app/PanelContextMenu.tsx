"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { PanelSlotType } from "@building-integrity/geometry";
import { type PanelTypeChoice } from "@building-integrity/geometry";
import { PANEL_TYPE_COLORS, PANEL_TYPE_LABELS } from "./panelColors";

/**
 * **THE RIGHT-CLICK PANEL MENU — B19.**
 *
 * > *"I would like to be able to right click on a panel in the 2D plan and 2D
 * > elevation ... to see several options including delete/merge, delete/ no
 * > panel, change, panel type, and then a drop-down menu of all of the panel
 * > types. This would remove the need for the left click cycle which is fine
 * > because left clicking should be used for dragging and resizing."*
 * > — Tommy, 2026-11-02
 *
 * ⚠ **Every type is listed, every time, in the same order** — his answer when
 * asked whether to hide the impossible ones. The greyed rows carry their own
 * reason in a tooltip. `panelTypeChoices` in geometry decides which is which;
 * nothing about the building is decided here.
 *
 * ⚠ **The two deletes are genuinely different.** "Merge" hands the panel's
 * width back to the run and the neighbours absorb it, which is what
 * `resolvePanelDelete` has always done. "No panel" keeps the width exactly
 * where it is and empties the slot, which is the `open` type — his choice when
 * asked, over shortening the wall or quietly merging. A reader of the drawing
 * sees a void somebody meant, and the run still sums.
 */

export interface PanelContextMenuTarget {
  wallId: string;
  slotIndex: number;
  /** Where to put the menu, in client coordinates. */
  clientX: number;
  clientY: number;
  /** For the menu's own heading — the panel's name or type. */
  label: string;
  choices: PanelTypeChoice[];
  /** False when the slot is one the placement engine refuses to remove (a
   *  corner, a safety gap), so the two delete rows grey out with a reason. */
  /** False when the placement engine refuses to remove this slot (a corner, a
   *  safety gap) — its width is not the free run's to give back. Emptying it
   *  is still allowed, so only the MERGE row greys out. */
  canDeleteMerge: boolean;
  deleteRefusalReason?: string;
}

export interface PanelContextMenuProps {
  target: PanelContextMenuTarget | null;
  onClose: () => void;
  onDeleteMerge: (wallId: string, slotIndex: number) => void;
  onDeleteNoPanel: (wallId: string, slotIndex: number) => void;
  onChangeType: (wallId: string, slotIndex: number, type: PanelSlotType) => void;
}

const MENU_WIDTH_PX = 248;
/** Enough for the two deletes, the heading and ten types without clipping. */
const MENU_MAX_HEIGHT_PX = 460;

export function PanelContextMenu({ target, onClose, onDeleteMerge, onDeleteNoPanel, onChangeType }: PanelContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    /* Pointer-down rather than click: a click handler would also catch the
       release of the very right-click that opened the menu in some browsers,
       closing it before it was ever seen. */
    const onDown = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [target, onClose]);

  if (target === null || typeof document === "undefined") return null;

  /* Kept on screen when the click lands near an edge. The menu is positioned
     in client coordinates, so this is a clamp against the viewport, not the
     canvas. */
  const left = Math.max(4, Math.min(target.clientX, window.innerWidth - MENU_WIDTH_PX - 4));
  const top = Math.max(4, Math.min(target.clientY, window.innerHeight - MENU_MAX_HEIGHT_PX - 4));

  const row = (
    key: string,
    label: string,
    enabled: boolean,
    onPick: () => void,
    opts: { title?: string; swatch?: string; tick?: boolean } = {},
  ) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      disabled={!enabled}
      title={opts.title}
      onClick={() => {
        onPick();
        onClose();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "6px 10px",
        border: "none",
        background: "transparent",
        textAlign: "left",
        font: "inherit",
        fontSize: 13,
        color: enabled ? "inherit" : "#9a9a9a",
        cursor: enabled ? "pointer" : "not-allowed",
      }}
      onMouseEnter={(e) => {
        if (enabled) e.currentTarget.style.background = "rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {opts.swatch !== undefined && (
        <span
          aria-hidden
          style={{ width: 11, height: 11, borderRadius: 2, background: opts.swatch, border: "1px solid rgba(0,0,0,0.25)", flex: "0 0 auto" }}
        />
      )}
      <span style={{ flex: 1 }}>{label}</span>
      {opts.tick === true && <span aria-hidden>✓</span>}
    </button>
  );

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`Panel actions for ${target.label}`}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed",
        left,
        top,
        width: MENU_WIDTH_PX,
        maxHeight: MENU_MAX_HEIGHT_PX,
        overflowY: "auto",
        zIndex: 4000,
        background: "var(--panel-bg, #fff)",
        color: "var(--panel-fg, #111)",
        border: "1px solid rgba(0,0,0,0.22)",
        borderRadius: 6,
        boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
        padding: "4px 0",
      }}
    >
      <div style={{ padding: "6px 10px 4px", fontSize: 12, opacity: 0.68 }}>{target.label}</div>

      {row("del-merge", "Delete — merge into the wall", target.canDeleteMerge, () => onDeleteMerge(target.wallId, target.slotIndex), {
        title: target.canDeleteMerge
          ? "Remove this panel and hand its width back to the run. The wall's length does not change."
          : target.deleteRefusalReason,
      })}
      {row("del-open", "Delete — no panel", target.choices.find((c) => c.type === "open")?.allowed === true, () => onDeleteNoPanel(target.wallId, target.slotIndex), {
        title: target.canDeleteMerge
          ? "Empty this slot and leave a framed void of the same width. The wall's length does not change, and the void appears on drawings and takeoffs."
          : target.deleteRefusalReason,
      })}

      <div style={{ height: 1, background: "rgba(0,0,0,0.12)", margin: "4px 0" }} />
      <div style={{ padding: "4px 10px", fontSize: 12, opacity: 0.68 }}>Change panel type</div>

      {target.choices.map((c) =>
        row(
          c.type,
          PANEL_TYPE_LABELS[c.type],
          c.allowed && !c.current,
          () => onChangeType(target.wallId, target.slotIndex, c.type),
          { title: c.reason, swatch: PANEL_TYPE_COLORS[c.type], tick: c.current },
        ),
      )}
    </div>,
    document.body,
  );
}
