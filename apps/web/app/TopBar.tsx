"use client";

import { useEffect, useState, type ReactNode } from "react";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import StickyNote from "./StickyNote";
import UnitSystemSwitch from "./UnitSystemSwitch";
import AccountControl from "./auth/AccountControl";
import { EDITOR_TAB_LABEL, editorTabsInScope, type EditorTab } from "./editorTabs";
import { clampMenuLeft, roleControlLabel, roleOptions, settingsMenuHasAdminGroup } from "./topBarMenus";
import type { CloudMenuModel } from "./cloud/useCloudProjects";
import { CLOUD_FOLDERS, FOLDER_LABEL, isCloudFolder } from "./cloud/cloudTypes";
import styles from "./TopBar.module.css";

export interface TopBarProps {
  /** Stage 2B: the Project ▾ status line and cloud group. Absent (undefined)
   * renders the menu exactly as before. Nothing new goes on the bar itself. */
  cloud?: CloudMenuModel;
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
  /** The same `editorTab` state EditorTabDial is driven by — one source of
   * truth, two presentations. */
  editorTab: EditorTab;
  onEditorTabChange: (tab: EditorTab) => void;
  /** Panelizer's keyhole, exactly as passed to EditorTabDial. */
  enabledTabs: EditorTab[];
}

type OpenMenu = "project" | "site" | "panelizer" | "role" | "settings" | null;

/** Icon-only, so the button carries a real aria-label and title. Inline SVG
 * rather than a Material Symbols webfont: no network dependency, no FOUT, no
 * licensing question for a one-icon need. */
function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 1.2v1.9M8 12.9v1.9M1.2 8h1.9M12.9 8h1.9M3.2 3.2l1.35 1.35M11.45 11.45l1.35 1.35M12.8 3.2l-1.35 1.35M4.55 11.45L3.2 12.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <circle cx="8" cy="8" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

/**
 * Sticky top-of-screen chrome, in three zones (spec: "Top Bar & App Chrome —
 * the Stitch reorganisation").
 *
 * - LEFT, identity & document: the wordmark (1200px and up), then the
 *   acting-as / sign-in control, then Project ▾ (Save, Load, Site Properties,
 *   Panelizer — the things that change the building or the file).
 * - MIDDLE, scope: Wall / Foundation / Floor / Roof (1200px and up). Below
 *   that, EditorTabDial in the sidebar is the tab control. Both are driven by
 *   the same state, and one CSS condition flips them, so exactly one shows.
 * - RIGHT, presentation: Role ▾ and ⚙ Settings (units and Admin Options — the
 *   things that change only how you look at it). No help icon: there is
 *   nothing for it to open yet, and the spec forbids an icon that opens nothing.
 *
 * WHY 1200 AND NOT `md`. The spec first put the nav at 768px. Measured with
 * four companies, the bar at 768 has 34px spare with the company name at its
 * 220px; the wordmark and nav need ~380px more. Showing them there would have
 * crushed the acting-as company name — the one thing this bar exists to keep
 * legible. Tommy moved them to 1200 (2026-09-13).
 *
 * WHY THE ACCOUNT CONTROL IS ON THE LEFT. This bar used to be one nowrap row
 * needing ~1400px, scrolled with `overflow-x: auto`, with the account control
 * last in it. In Tommy's 710px viewport it sat ~700px off-screen: present in
 * the DOM, unfindable in practice. The acting-as company has to be visible at
 * all times because the failure it prevents (saving into the wrong company's
 * folder tree) is silent. In an LTR overflow the rightmost content falls off
 * first, so first-in-row is the only placement that structurally cannot
 * reproduce that. It also keeps the two role axes at opposite ends: permission
 * lives in the identity zone, the viewer role in the presentation zone. They
 * must never read as two levels of one thing.
 *
 * WHY THERE IS NO SCROLLER. The bar fits by construction down to 360px: the
 * left zone is the only thing allowed to shrink, and inside it only the
 * acting-as company name does (ellipsis + title). If a future change breaks
 * that, it should break visibly, not slide a control silently off-screen.
 * Truncated-with-a-tooltip beats absent.
 *
 * Every menu opens as a real `StickyNote`, as before: the old nested popovers
 * were clipped by the row's overflow (setting one axis non-`visible` forces
 * the other to `auto`), and a `position: fixed` note escapes any overflow
 * context. Only one note from this bar is open at a time; each opens just
 * under whichever control opened it, clamped to stay on screen.
 */
export default function TopBar({
  cloud,
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
  editorTab,
  onEditorTabChange,
  enabledTabs,
}: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [fullscreenMenu, setFullscreenMenu] = useState<OpenMenu>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const openMenuUnder = (which: Exclude<OpenMenu, null>, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: clampMenuLeft(rect.left, window.innerWidth) });
    setFullscreenMenu(null);
    setOpenMenu(which);
  };

  const toggleMenu = (which: Exclude<OpenMenu, null>, button: HTMLButtonElement) => {
    if (openMenu === which) {
      setOpenMenu(null);
      setFullscreenMenu(null);
    } else {
      openMenuUnder(which, button);
    }
  };

  const closeMenu = () => {
    setOpenMenu(null);
    setFullscreenMenu(null);
  };

  // A menu opened wide and then the window narrowed must not be left anchored
  // off the right edge. Only ever moves the note left, so widening again leaves
  // it where it is rather than jumping.
  useEffect(() => {
    if (!openMenu) return;
    const onResize = () =>
      setMenuPos((was) => (was ? { ...was, left: clampMenuLeft(was.left, window.innerWidth) } : was));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [openMenu]);

  const caret = (which: OpenMenu) => (
    <span className={styles.caret} aria-hidden="true">
      {" "}
      {openMenu === which ? "▲" : "▼"}
    </span>
  );

  const noteProps = (which: Exclude<OpenMenu, null>) => ({
    isOpen: openMenu === which,
    isFullscreen: fullscreenMenu === which,
    cascadeIndex: 0,
    top: menuPos?.top ?? 68,
    left: menuPos?.left ?? 24,
    onClose: closeMenu,
    onToggleFullscreen: () => setFullscreenMenu((was) => (was === which ? null : which)),
  });

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <div className={styles.zoneLeft}>
          {/* Text, not an image: no logo asset exists (SheetTitleBlock renders a
              text wordmark too). Brand navy via --bi-primary — NOT Stitch's
              header-gold, which is a panel semantic in its own palette. Hidden
              below 1200px, where its width belongs to the company name. */}
          <span className={styles.wordmark}>Building Integrity</span>

          {/* Returns null with no AuthProvider (tests mount the editor that
              way); it is a direct child so a null leaves no gap behind. */}
          <AccountControl />

          <button
            type="button"
            title="Save, load, site properties and panelizer — things that change the building or the file"
            className={openMenu === "project" ? styles.toolActive : styles.tool}
            aria-expanded={openMenu === "project"}
            onClick={(e) => toggleMenu("project", e.currentTarget)}
          >
            Project{caret("project")}
          </button>
        </div>

        {/* Scope. display: none below 1200px (EditorTabDial has the job there),
            so it is out of the accessibility tree too and never doubles up. */}
        <nav className={styles.zoneMiddle} aria-label="Editor">
          {editorTabsInScope(enabledTabs).map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === editorTab ? styles.navTabActive : styles.navTab}
              aria-current={tab === editorTab ? "true" : undefined}
              onClick={() => onEditorTabChange(tab)}
            >
              {EDITOR_TAB_LABEL[tab]}
            </button>
          ))}
        </nav>

        <div className={styles.zoneRight}>
          <button
            type="button"
            title={roleDisclaimers[role].text}
            className={openMenu === "role" ? styles.toolActive : styles.tool}
            aria-expanded={openMenu === "role"}
            onClick={(e) => toggleMenu("role", e.currentTarget)}
          >
            {roleControlLabel(role)}
            {caret("role")}
          </button>

          <button
            type="button"
            aria-label="Settings"
            title="Settings — units and display options"
            className={openMenu === "settings" ? styles.iconToolActive : styles.iconTool}
            aria-expanded={openMenu === "settings"}
            onClick={(e) => toggleMenu("settings", e.currentTarget)}
          >
            <GearIcon />
          </button>
        </div>
      </div>

      <StickyNote id="project-note" label="Project" {...noteProps("project")}>
        {/* Stage 2B. Only while a cloud project is open: what it is, and (if the
            switcher points elsewhere) that saves still go to it. */}
        {cloud && cloud.statusLines.length > 0 && (
          <div className={styles.cloudStatus} data-cloud-status="">
            {cloud.statusLines.map((line, i) => (
              <p key={i} className={i === 0 ? styles.cloudStatusLine : styles.dropdownNote}>
                {line}
              </p>
            ))}
            {/* Stage 3B: Move to… on the status line. The folders are the
                OWNER's, and the picker says so (spec, "Folder moves by a
                collaborator"). Inside this note, not on the bar. */}
            {cloud.refile && (
              <select
                className={styles.cloudRefile}
                aria-label={cloud.refile.heading}
                value=""
                disabled={cloud.refile.busy}
                onChange={(e) => {
                  const folder = e.target.value;
                  if (cloud.refile && isCloudFolder(folder)) cloud.refile.onMove(folder);
                }}
              >
                <option value="">Move to…</option>
                <optgroup label={cloud.refile.heading}>
                  {CLOUD_FOLDERS.map((f) => (
                    <option key={f} value={f} disabled={f === cloud.refile?.folder}>
                      {FOLDER_LABEL[f]}
                      {f === cloud.refile?.folder ? " (here now)" : ""}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>
        )}
        {cloud && cloud.menu.kind !== "absent" && <h3 className={styles.menuSectionTitle}>This computer</h3>}
        {/* Save Project and Load Project: unchanged, and never sign-in-gated
            (decision 14). Guests stay download-only. */}
        <div className={styles.menuList}>
          <button
            type="button"
            title="Download every input on this page as one JSON file"
            className={styles.menuItem}
            onClick={() => {
              closeMenu();
              onSaveProject();
            }}
          >
            Save Project
          </button>
          <button
            type="button"
            title="Load a previously saved project JSON file"
            className={styles.menuItem}
            onClick={() => {
              closeMenu();
              onLoadProjectClick();
            }}
          >
            Load Project
          </button>
        </div>
        {cloud && cloud.menu.kind === "sign-in-prompt" && (
          <div className={styles.menuSection}>
            <button
              type="button"
              title="Opens the account control. Save Project and Load Project work without signing in."
              className={styles.menuItem}
              onClick={() => {
                closeMenu();
                cloud.onSignIn();
              }}
            >
              {cloud.menu.text}
            </button>
          </div>
        )}
        {cloud && cloud.menu.kind === "signed-in" && (
          <div className={styles.menuSection} role="group" aria-label={cloud.menu.heading}>
            <h3 className={styles.menuSectionTitle}>{cloud.menu.heading}</h3>
            {cloud.menu.message && <p className={styles.dropdownNote}>{cloud.menu.message}</p>}
            {(cloud.menu.saveToCloud || cloud.menu.saveAsNew || cloud.menu.openFromCloud || cloud.menu.versionHistory || cloud.menu.sharing) && (
              <div className={styles.menuList}>
                {cloud.menu.saveToCloud && (
                  <button
                    type="button"
                    title={
                      cloud.statusLines.length > 0
                        ? "Save a new version of the cloud project that is open"
                        : "Save this design as a new project in the company you are acting as"
                    }
                    className={styles.menuItem}
                    disabled={cloud.busy}
                    onClick={() => {
                      closeMenu();
                      cloud.onSaveToCloud();
                    }}
                  >
                    {cloud.busy ? "Saving to cloud…" : "Save to cloud"}
                  </button>
                )}
                {cloud.menu.saveAsNew && (
                  <button
                    type="button"
                    title="Save a copy as a separate new project in the company you are acting as"
                    className={styles.menuItem}
                    disabled={cloud.busy}
                    onClick={() => {
                      closeMenu();
                      cloud.onSaveAsNew();
                    }}
                  >
                    Save as new cloud project…
                  </button>
                )}
                {cloud.menu.openFromCloud && (
                  <button
                    type="button"
                    title="Open a project saved in the cloud, or any of its earlier versions"
                    className={styles.menuItem}
                    onClick={() => {
                      closeMenu();
                      cloud.onOpenFromCloud();
                    }}
                  >
                    Open from cloud…
                  </button>
                )}
                {/* Stage 2C. Inside this note, not on the bar. */}
                {cloud.menu.versionHistory && (
                  <button
                    type="button"
                    title="Every saved version of the cloud project that is open: who saved it and when. Any of them can be opened."
                    className={styles.menuItem}
                    onClick={() => {
                      closeMenu();
                      cloud.onVersionHistory();
                    }}
                  >
                    Version history
                  </button>
                )}
                {/* Stage 3B. Inside this note, not on the bar. */}
                {cloud.menu.sharing && (
                  <button
                    type="button"
                    title="Who has access to the cloud project that is open, and share it with a person or a company"
                    className={styles.menuItem}
                    onClick={() => {
                      closeMenu();
                      cloud.onSharing();
                    }}
                  >
                    Sharing…
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <div className={`${styles.menuList} ${cloud && cloud.menu.kind !== "absent" ? styles.menuListAfterSection : ""}`}>
          <button
            type="button"
            title="Zip code, seismic zone, foundation type, pier spacing"
            className={styles.menuItem}
            onClick={(e) => openMenuUnder("site", e.currentTarget)}
          >
            Site Properties
          </button>
          <button
            type="button"
            title="Which editor tools this project needs, panel-construction style, and panel width/thickness/density/wall height"
            className={styles.menuItem}
            onClick={(e) => openMenuUnder("panelizer", e.currentTarget)}
          >
            Panelizer
          </button>
        </div>
      </StickyNote>

      <StickyNote id="site-properties-note" label="Site Properties" {...noteProps("site")}>
        {siteContent}
      </StickyNote>

      <StickyNote id="panelizer-note" label="Panelizer" {...noteProps("panelizer")}>
        {panelizerContent}
      </StickyNote>

      <StickyNote id="role-note" label="Role" {...noteProps("role")}>
        <p className={styles.dropdownNote}>Changes which disclaimer prints; it is not a permission.</p>
        <div className={styles.menuList} role="group" aria-label="Viewing as">
          {roleOptions.map((r) => (
            <button
              key={r}
              type="button"
              title={roleDisclaimers[r].text}
              className={role === r ? styles.menuItemActive : styles.menuItem}
              aria-pressed={role === r}
              onClick={() => {
                onRoleChange(r);
                closeMenu();
              }}
            >
              <span className={styles.menuItemLabel} data-role-option-label="">
                {roleDisclaimers[r].label}
              </span>
              {/* Verbatim. These strings are the app's legal posture: they
                  may be relocated, never reworded. */}
              <span className={styles.roleOptionText}>{roleDisclaimers[r].text}</span>
            </button>
          ))}
        </div>
      </StickyNote>

      <StickyNote id="settings-note" label="Settings" {...noteProps("settings")}>
        <UnitSystemSwitch value={unitSystem} onChange={onUnitSystemChange} />
        {settingsMenuHasAdminGroup(role) && (
          <div className={styles.menuSection}>
            <h3 className={styles.menuSectionTitle}>Admin Options</h3>
            <label>
              <input
                type="checkbox"
                checked={showAllDetailPages}
                onChange={(e) => onShowAllDetailPagesChange(e.target.checked)}
              />{" "}
              Show All Detail Pages
            </label>
            <p className={styles.dropdownNote}>
              Shows every Detail Guide and Shop Drawing page regardless of whether it applies to the current design.
              Off by default.
            </p>
          </div>
        )}
      </StickyNote>
    </div>
  );
}
