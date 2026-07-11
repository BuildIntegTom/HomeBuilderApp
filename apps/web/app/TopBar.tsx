"use client";

import { useState, type ReactNode } from "react";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
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
 * of ... a window bar that always stays at the top of the screen") — a
 * fixed 2-row bar. Row 1 is Viewing-as + the admin/fabricator "show all
 * detail pages" toggle. Row 2 uses `justify-content: space-between` across
 * exactly 4 children, which naturally lands them at top-left (Save/Load),
 * middle-left (Site Properties), center (unit switch), and middle-right
 * (Panel Standards) — matching Tommy's spec without hand-tuned positioning.
 * The two dropdown buttons toggle a popover open/closed on repeat clicks;
 * `siteContent`/`panelStandardsContent` are passed in as JSX from page.tsx
 * so all of their existing state/logic stays exactly where it was.
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
  const toggleDropdown = (which: OpenDropdown) => setOpenDropdown((was) => (was === which ? null : which));

  return (
    <div className={styles.bar}>
      <div className={styles.row1}>
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
              Viewing as: {roleDisclaimers[r].label}
            </button>
          ))}
        </div>
        {role !== "public" && (
          <div className={styles.dropdownAnchor}>
            <button
              type="button"
              title="Admin/fabricator options"
              className={openDropdown === "admin" ? styles.toolActive : styles.tool}
              aria-expanded={openDropdown === "admin"}
              onClick={() => toggleDropdown("admin")}
            >
              Admin Options {openDropdown === "admin" ? "▲" : "▼"}
            </button>
            {openDropdown === "admin" && (
              <div className={styles.dropdownPanel}>
                <label>
                  <input
                    type="checkbox"
                    checked={showAllDetailPages}
                    onChange={(e) => onShowAllDetailPagesChange(e.target.checked)}
                  />{" "}
                  Show All Detail Pages
                </label>
                <p className={styles.dropdownNote}>
                  Shows every Detail Guide and Shop Drawing page regardless of whether it applies to the current
                  design. Off by default.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.row2}>
        <div className={styles.projectFileGroup} role="group" aria-label="Project file">
          <button type="button" title="Download every input on this page as one JSON file" className={styles.tool} onClick={onSaveProject}>
            Save Project
          </button>
          <button type="button" title="Load a previously saved project JSON file" className={styles.tool} onClick={onLoadProjectClick}>
            Load Project
          </button>
        </div>

        <div className={styles.dropdownAnchor}>
          <button
            type="button"
            title="Zip code, seismic zone, foundation type, pier spacing"
            className={openDropdown === "site" ? styles.toolActive : styles.tool}
            aria-expanded={openDropdown === "site"}
            onClick={() => toggleDropdown("site")}
          >
            Site Properties {openDropdown === "site" ? "▲" : "▼"}
          </button>
          {openDropdown === "site" && <div className={styles.dropdownPanel}>{siteContent}</div>}
        </div>

        <UnitSystemSwitch value={unitSystem} onChange={onUnitSystemChange} />

        <div className={styles.dropdownAnchor}>
          <button
            type="button"
            title="Panel width/thickness/density/wall height and wall-panelization style"
            className={openDropdown === "panel-standards" ? styles.toolActive : styles.tool}
            aria-expanded={openDropdown === "panel-standards"}
            onClick={() => toggleDropdown("panel-standards")}
          >
            Panel Standards {openDropdown === "panel-standards" ? "▲" : "▼"}
          </button>
          {openDropdown === "panel-standards" && (
            <div className={`${styles.dropdownPanel} ${styles.dropdownPanelRight}`}>{panelStandardsContent}</div>
          )}
        </div>
      </div>
    </div>
  );
}
