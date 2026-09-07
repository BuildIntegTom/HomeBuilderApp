"use client";

import { useState, type ReactNode } from "react";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import StickyNote from "./StickyNote";
import UnitSystemSwitch from "./UnitSystemSwitch";
import AccountControl from "./auth/AccountControl";
import styles from "./TopBar.module.css";

export interface TopBarProps {
  role: ViewerRole;
  onRoleChange: (role: ViewerRole) => void;
  showAllDetailPages: boolean;
  onShowAllDetailPagesChange: (value: boolean) => void;
  unitSystem: "imperial" | "metric";
  onUnitSystemChange: (value: "imperial" | "metric") => void;
  onSaveProject: () => void;
  onLoadProjectClick: () => void;
  siteContent: ReactNode;
  panelizerContent: ReactNode;
}

type OpenDropdown = "site" | "panelizer" | "admin" | null;

// Matches StickyNote.module.css's own `.note` width — used to keep a
// dropdown's spawn point from running off the right edge of the screen
// (Tommy: "the panel standards tab opens to the right of the drop down,
// since its on the right side of the tool bar this is often pushed out of
// the screen, lets turn this to spawn more left").
const NOTE_WIDTH_PX = 420;
const VIEWPORT_MARGIN_PX = 12;

/**
 * Sticky top-of-screen chrome (Tommy: "Viewing as section at the very top
 * of ... a window bar that always stays at the top of the screen... lets
 * try to fit all the top bar stuff in one row") — a fixed single-row bar:
 * Viewing-as (short Public/Fabricator/Admin labels) + the admin/fabricator
 * "show all detail pages" dropdown, then Save/Load, Site Properties, the
 * unit switch, and Panelizer (formerly "Panel Standards" — Tommy: "under
 * Panelizer lets add three check boxes"), left to right in one
 * `justify-content: space-between` row instead of two stacked rows.
 *
 * Each dropdown button opens its content as a real `StickyNote` (Tommy:
 * "when i click panel standards, it wants to load that menu inside of the
 * top bar - i want it to come out like another sticky note") instead of an
 * absolutely-positioned popover nested inside `.row` — that old popover
 * pattern got clipped by `.row`'s `overflow-x: auto` (which forces
 * `overflow-y` to `auto` too, per the CSS spec, once only one axis is set
 * to a non-`visible` value), squashing the panel's content into the bar's
 * own 56px height instead of floating below it. A StickyNote is
 * `position: fixed`, so it escapes that overflow context entirely, and
 * comes with the same drag/close/fullscreen behavior every other note has.
 * Opens positioned just under whichever button was clicked (captured via
 * the click event's own target, not a ref, since only one can be open at a
 * time).
 */
export default function TopBar({
  role,
  onRoleChange,
  showAllDetailPages,
  onShowAllDetailPagesChange,
  unitSystem,
  onUnitSystemChange,
  onSaveProject,
  onLoadProjectClick,
  siteContent,
  panelizerContent,
}: TopBarProps) {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [fullscreenDropdown, setFullscreenDropdown] = useState<OpenDropdown>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const toggleDropdown = (which: OpenDropdown, buttonEl: HTMLButtonElement) => {
    setOpenDropdown((was) => {
      const next = was === which ? null : which;
      if (next) {
        const rect = buttonEl.getBoundingClientRect();
        // Clamped so a button near the bar's right edge (Panelizer, the
        // last one) still opens fully on-screen instead of spilling off
        // the right side — anchors further left as needed, never further
        // right than the button's own left edge.
        const maxLeft = window.innerWidth - NOTE_WIDTH_PX - VIEWPORT_MARGIN_PX;
        setDropdownPos({ top: rect.bottom + 8, left: Math.min(rect.left, Math.max(VIEWPORT_MARGIN_PX, maxLeft)) });
      } else if (fullscreenDropdown === which) {
        setFullscreenDropdown(null);
      }
      return next;
    });
  };

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <div className={styles.roleGroup} role="group" aria-label="Viewing as">
          {(Object.keys(roleDisclaimers) as ViewerRole[]).map((r) => (
            <button
              key={r}
              type="button"
              title={roleDisclaimers[r].text}
              className={role === r ? styles.toolActive : styles.tool}
              aria-pressed={role === r}
              onClick={() => onRoleChange(r)}
            >
              {roleDisclaimers[r].label}
            </button>
          ))}
        </div>
        {role !== "public" && (
          <button
            type="button"
            title="Admin/fabricator options"
            className={openDropdown === "admin" ? styles.toolActive : styles.tool}
            aria-expanded={openDropdown === "admin"}
            onClick={(e) => toggleDropdown("admin", e.currentTarget)}
          >
            Admin Options {openDropdown === "admin" ? "▲" : "▼"}
          </button>
        )}

        <div className={styles.projectFileGroup} role="group" aria-label="Project file">
          <button type="button" title="Download every input on this page as one JSON file" className={styles.tool} onClick={onSaveProject}>
            Save Project
          </button>
          <button type="button" title="Load a previously saved project JSON file" className={styles.tool} onClick={onLoadProjectClick}>
            Load Project
          </button>
        </div>

        <button
          type="button"
          title="Zip code, seismic zone, foundation type, pier spacing"
          className={openDropdown === "site" ? styles.toolActive : styles.tool}
          aria-expanded={openDropdown === "site"}
          onClick={(e) => toggleDropdown("site", e.currentTarget)}
        >
          Site Properties {openDropdown === "site" ? "▲" : "▼"}
        </button>

        <UnitSystemSwitch value={unitSystem} onChange={onUnitSystemChange} />

        <button
          type="button"
          title="Which editor tools this project needs, panel-construction style, and panel width/thickness/density/wall height"
          className={openDropdown === "panelizer" ? styles.toolActive : styles.tool}
          aria-expanded={openDropdown === "panelizer"}
          onClick={(e) => toggleDropdown("panelizer", e.currentTarget)}
        >
          Panelizer {openDropdown === "panelizer" ? "▲" : "▼"}
        </button>

        {/* The acting-as switcher and the sign-in state. Deliberately at the
            far end of the bar, as far from the Role Selector at the other end
            as the row allows: those are the two axes that must never be
            merged, and sitting them side by side is how someone starts
            reading one as a level of the other. Permission is server-enforced;
            the Role Selector is a free presentation toggle available to
            everyone including guests, and neither reads the other. */}
        <AccountControl />
      </div>

      <StickyNote
        id="admin-options-note"
        label="Admin Options"
        isOpen={openDropdown === "admin"}
        isFullscreen={fullscreenDropdown === "admin"}
        cascadeIndex={0}
        top={dropdownPos?.top ?? 68}
        left={dropdownPos?.left ?? 24}
        onClose={() => setOpenDropdown(null)}
        onToggleFullscreen={() => setFullscreenDropdown((was) => (was === "admin" ? null : "admin"))}
      >
        <label>
          <input type="checkbox" checked={showAllDetailPages} onChange={(e) => onShowAllDetailPagesChange(e.target.checked)} />{" "}
          Show All Detail Pages
        </label>
        <p className={styles.dropdownNote}>
          Shows every Detail Guide and Shop Drawing page regardless of whether it applies to the current design. Off
          by default.
        </p>
      </StickyNote>

      <StickyNote
        id="site-properties-note"
        label="Site Properties"
        isOpen={openDropdown === "site"}
        isFullscreen={fullscreenDropdown === "site"}
        cascadeIndex={0}
        top={dropdownPos?.top ?? 68}
        left={dropdownPos?.left ?? 24}
        onClose={() => setOpenDropdown(null)}
        onToggleFullscreen={() => setFullscreenDropdown((was) => (was === "site" ? null : "site"))}
      >
        {siteContent}
      </StickyNote>

      <StickyNote
        id="panelizer-note"
        label="Panelizer"
        isOpen={openDropdown === "panelizer"}
        isFullscreen={fullscreenDropdown === "panelizer"}
        cascadeIndex={0}
        top={dropdownPos?.top ?? 68}
        left={dropdownPos?.left ?? 24}
        onClose={() => setOpenDropdown(null)}
        onToggleFullscreen={() => setFullscreenDropdown((was) => (was === "panelizer" ? null : "panelizer"))}
      >
        {panelizerContent}
      </StickyNote>
    </div>
  );
}
