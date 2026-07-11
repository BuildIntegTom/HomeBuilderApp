"use client";

import { useState, type ReactNode } from "react";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import StickyNote from "./StickyNote";
import UnitSystemSwitch from "./UnitSystemSwitch";
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
  panelStandardsContent: ReactNode;
}

type OpenDropdown = "site" | "panel-standards" | "admin" | null;

/**
 * Sticky top-of-screen chrome (Tommy: "Viewing as section at the very top
 * of ... a window bar that always stays at the top of the screen... lets
 * try to fit all the top bar stuff in one row") — a fixed single-row bar:
 * Viewing-as (short Public/Fabricator/Admin labels) + the admin/fabricator
 * "show all detail pages" dropdown, then Save/Load, Site Properties, the
 * unit switch, and Panel Standards, left to right in one `justify-content:
 * space-between` row instead of two stacked rows.
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
  panelStandardsContent,
}: TopBarProps) {
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const [fullscreenDropdown, setFullscreenDropdown] = useState<OpenDropdown>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const toggleDropdown = (which: OpenDropdown, buttonEl: HTMLButtonElement) => {
    setOpenDropdown((was) => {
      const next = was === which ? null : which;
      if (next) {
        const rect = buttonEl.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 8, left: rect.left });
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
          title="Panel width/thickness/density/wall height and wall-panelization style"
          className={openDropdown === "panel-standards" ? styles.toolActive : styles.tool}
          aria-expanded={openDropdown === "panel-standards"}
          onClick={(e) => toggleDropdown("panel-standards", e.currentTarget)}
        >
          Panel Standards {openDropdown === "panel-standards" ? "▲" : "▼"}
        </button>
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
        id="panel-standards-note"
        label="Panel Standards"
        isOpen={openDropdown === "panel-standards"}
        isFullscreen={fullscreenDropdown === "panel-standards"}
        cascadeIndex={0}
        top={dropdownPos?.top ?? 68}
        left={dropdownPos?.left ?? 24}
        onClose={() => setOpenDropdown(null)}
        onToggleFullscreen={() => setFullscreenDropdown((was) => (was === "panel-standards" ? null : "panel-standards"))}
      >
        {panelStandardsContent}
      </StickyNote>
    </div>
  );
}
