"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * **THE RIGHT-CLICK MEMBER MENU — B30, 2026-11-05.**
 *
 * > *"If you right click on a member in the panel editor, you get a selection
 * > to change it to anything."* — Tommy, 2026-11-02
 *
 * The rows are the same four actions the left bar already offers plus the
 * seating rotation B30 added, which is deliberate: the menu is a second DOOR
 * onto one set of ops, not a second set of rules. Every row runs through
 * `panelEditorOps`, so a refusal reads the same whichever way it was reached.
 *
 * ⚠ **A separate component from `PanelContextMenu`, on purpose.** That one is
 * about a SLOT in a wall — it knows about panel types, deletes and merges, and
 * its rows come from `panelTypeChoices`. This one is about a BOARD. Sharing a
 * component would mean one list of props that half the callers ignore; sharing
 * the *behaviour* that matters — dismiss on Escape, dismiss on an outside
 * pointer-down rather than a click, clamp to the viewport — is what the two
 * actually have in common, and that is small enough to state twice and read
 * once.
 */

export interface MemberMenuAction {
  key: string;
  label: string;
  enabled: boolean;
  /** Why it is greyed, or what it will do. */
  title?: string;
  onPick: () => void;
}

export interface MemberContextMenuTarget {
  /** Where to put the menu, in client coordinates. */
  clientX: number;
  clientY: number;
  /** The board, in the editor's own words — `Straight · vertical · 87.00″`. */
  heading: string;
  actions: MemberMenuAction[];
}

const MENU_WIDTH_PX = 236;
const MENU_MAX_HEIGHT_PX = 300;

export function MemberContextMenu({ target, onClose }: { target: MemberContextMenuTarget | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    /* Pointer-down rather than click, for the reason `PanelContextMenu` found:
       a click handler also catches the release of the very right-click that
       opened the menu in some browsers, closing it before it was seen. */
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

  const left = Math.max(4, Math.min(target.clientX, window.innerWidth - MENU_WIDTH_PX - 4));
  const top = Math.max(4, Math.min(target.clientY, window.innerHeight - MENU_MAX_HEIGHT_PX - 4));

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`Member actions for ${target.heading}`}
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
      <div style={{ padding: "6px 10px 4px", fontSize: 12, opacity: 0.68 }}>{target.heading}</div>
      {target.actions.map((action) => (
        <button
          key={action.key}
          type="button"
          role="menuitem"
          disabled={!action.enabled}
          title={action.title}
          onClick={() => {
            action.onPick();
            onClose();
          }}
          style={{
            display: "block",
            width: "100%",
            padding: "6px 10px",
            border: "none",
            background: "transparent",
            textAlign: "left",
            font: "inherit",
            fontSize: 13,
            color: action.enabled ? "inherit" : "#9a9a9a",
            cursor: action.enabled ? "pointer" : "not-allowed",
          }}
          onMouseEnter={(e) => {
            if (action.enabled) e.currentTarget.style.background = "rgba(0,0,0,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
