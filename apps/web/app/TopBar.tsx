"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import StickyNote from "./StickyNote";
import UnitSystemSwitch from "./UnitSystemSwitch";
import AccountControl from "./auth/AccountControl";
import { EDITOR_TAB_LABEL, editorTabsInScope, type EditorTab } from "./editorTabs";
import { isViewerDialLive, viewerStopLabel } from "./viewLabels";
import {
  VIEWER_MENU_LABEL,
  VIEWER_MENU_ORDER,
  viewerMenuOwner,
  viewerStopKey,
  viewerStopsForMenu,
} from "./viewerMenus";
import type { ViewerStop } from "./ViewerDial";
import type { Footprint } from "@building-integrity/geometry";
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
  /* ---- U1: the Design and View menus ------------------------------------
     The bar form of the sidebar's ViewerDial, at 1454px and up. Three of
     these four props are EXACTLY the three the dial already takes, passed
     through unchanged, which is what makes "two presentations of one thing"
     true rather than aspirational. */
  /** The dial's whole cycle, in Tommy's order. Split into the two menus HERE
   * rather than by the caller, so the bar and the dial cannot be handed two
   * different lists. */
  viewerStops: ViewerStop[];
  /** page.tsx's `currentViewerStop` — the single reader of the four view
   * flags. This component never reads those flags itself. */
  currentViewerStop: ViewerStop;
  /** page.tsx's `handleViewerStopChange`, and the ONLY writer of them. Both
   * menus call this one function; see the note on the menus below. */
  onViewerStopChange: (stop: ViewerStop) => void;
  /** Only its presence is read, and only to answer `isViewerDialLive`. Passed
   * as the footprint rather than as a ready-made boolean so that this
   * component calls the one named predicate itself, instead of trusting a
   * caller to have computed the same condition — which is the seam that
   * predicate was added to close. */
  footprint: Footprint | null;
}

type OpenMenu = "project" | "site" | "panelizer" | "role" | "settings" | "design" | "view" | null;

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
  viewerStops,
  currentViewerStop,
  onViewerStopChange,
  footprint,
}: TopBarProps) {
  /**
   * Whether the view dial is actually driving the canvas — the SAME named
   * predicate the dial's own `disabled` prop negates and the Report Bug note's
   * context line reads, CALLED here rather than re-typed. Its input is a plain
   * object, not component props, precisely so that a different component can
   * ask the same question and be guaranteed the same answer.
   *
   * Writing `editorTab === "wall" && Boolean(footprint)` out here instead is
   * exactly what `isViewerDialLive` was added (2026-09-28) to prevent: that
   * condition had already been written twice, in opposite polarities, ~900
   * lines apart in page.tsx. The Design and View menus are its third and
   * fourth readers, and one call answers for both.
   */
  const viewerDialLive = isViewerDialLive({ editorTab, footprint });

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
    /* `data-top-bar` / `data-top-bar-row` / `data-bar-control` exist for the
       width harness (`apps/web/harness/ui-reorg-u1/`). U1's whole deliverable
       is a MEASUREMENT of this row — which controls are on it at each width,
       how wide each is, and what sheds first — and CSS-module class names are
       hashed, so a harness keyed to them is keyed to a build artefact. These
       names are stable and say what each control IS rather than where it sits.
       Nothing renders differently because of them. */
    <div className={styles.bar} data-top-bar="">
      <div className={styles.row} data-top-bar-row="">
        <div className={styles.zoneLeft} data-top-bar-zone="left">
          {/* Text, not an image: no logo asset exists (SheetTitleBlock renders a
              text wordmark too). Brand navy via --bi-primary — NOT Stitch's
              header-gold, which is a panel semantic in its own palette. Hidden
              below 1200px, where its width belongs to the company name. */}
          <span className={styles.wordmark} data-bar-control="wordmark">
            Building Integrity
          </span>

          {/* Returns null with no AuthProvider (tests mount the editor that
              way); it is a direct child so a null leaves no gap behind. */}
          <AccountControl />

          <button
            type="button"
            title="Save, load, site properties and panelizer — things that change the building or the file"
            className={openMenu === "project" ? styles.toolActive : styles.tool}
            data-bar-control="project"
            aria-expanded={openMenu === "project"}
            onClick={(e) => toggleMenu("project", e.currentTarget)}
          >
            Project{caret("project")}
          </button>

          {/* U1: Design and View — the top-bar form of the sidebar's view
              dial, at 1454px and up only.

              WHY A WRAPPER THAT RENDERS NOTHING. `.viewMenus` is
              `display: contents` when shown, so both buttons are direct flex
              children of the left zone and shrink, gap and truncate exactly as
              if they were written here unwrapped; and `display: none` below
              1454px, where the dial in the sidebar is the control instead.
              One condition flips the two in opposite directions rather than an
              opposed min/max pair — so there is no width, fractional ones
              under browser zoom included, where both forms show or neither
              does.

              ⚠ 1454, NOT THE NAV'S 1200, AND THAT IS THE WHOLE POINT.
              Changed 2026-09-28. U1 shipped these two on the nav's own 1200px
              query; measured there with four companies, they took the ENTIRE
              acting-as company name — a 16px select rendering zero characters
              while the caption still read ACTING AS. A wrong-company save is
              silent and plausible, which is why that name is the one thing on
              this bar that may never be crushed, so these two newcomers are
              what yield instead. 1454px is the bisected width at which they
              cost it nothing. Full reasoning and figures: TopBar.module.css
              on `.viewMenus`.

              ⚠ AND THE DIAL IS NOT MERELY THE NARROW FALLBACK. Scroll-wheel
              cycling and `useRustleSound()` exist only on the dial. Replacing
              it outright at desktop width would have deleted both without a
              word, which is exactly the kind of row a reorganisation loses
              quietly. Keeping it below the breakpoint keeps them at Tommy's
              own 710px viewport — and, since 2026-09-28, at every width below
              1454px, which is most of them. Whether the wheel and the rustle
              should also be offered at 1454px and up is his call, and is an
              Open Item. */}
          <div className={styles.viewMenus}>
            {VIEWER_MENU_ORDER.map((menu) => {
              const isOwner = viewerMenuOwner(currentViewerStop, viewerDialLive) === menu;
              return (
                <button
                  key={menu}
                  type="button"
                  data-bar-control={menu}
                  data-view-menu={menu}
                  data-view-menu-owner={isOwner ? "true" : "false"}
                  /* Mirrors the dial's own `disabled` EXACTLY, because it is
                     the same predicate and not a second copy of the
                     condition — `isViewerDialLive` is read once, above, and
                     both menus and the dial answer from it. The reason is in
                     the title rather than left as a dead control. */
                  disabled={!viewerDialLive}
                  title={
                    viewerDialLive
                      ? menu === "design"
                        ? "The drawing: the floor plan, and each wall's elevation"
                        : "The 3D views: framed, boxes and membranes"
                      : "Available on the Wall tab, once a footprint is drawn"
                  }
                  className={openMenu === menu ? styles.toolActive : styles.tool}
                  aria-expanded={openMenu === menu}
                  onClick={(e) => toggleMenu(menu, e.currentTarget)}
                >
                  {isOwner ? (
                    <>
                      {/* The two type treatments are the acting-as control's
                          own — 11px/600/uppercase/muted, then 13px/600/
                          on-surface — per Tommy's "(all caps dark grey) Design
                          (First Letter Cap and Black) Plan View". The caption
                          is the SAME string as the bare word, uppercased by
                          CSS, so there is only ever one spelling of each. */}
                      <span className={styles.viewMenuCaption} data-view-menu-caption="">
                        {VIEWER_MENU_LABEL[menu]}
                      </span>{" "}
                      <span className={styles.viewMenuValue} data-view-menu-value="">
                        {viewerStopLabel(currentViewerStop)}
                      </span>
                    </>
                  ) : (
                    <span data-view-menu-word="">{VIEWER_MENU_LABEL[menu]}</span>
                  )}
                  {caret(menu)}
                </button>
              );
            })}
          </div>

        </div>

        {/* Scope. display: none below 1200px (EditorTabDial has the job there),
            so it is out of the accessibility tree too and never doubles up. */}
        <nav className={styles.zoneMiddle} data-top-bar-zone="middle" aria-label="Editor">
          {editorTabsInScope(enabledTabs).map((tab) => (
            <button
              key={tab}
              type="button"
              className={tab === editorTab ? styles.navTabActive : styles.navTab}
              data-bar-control={`nav-${tab}`}
              aria-current={tab === editorTab ? "true" : undefined}
              onClick={() => onEditorTabChange(tab)}
            >
              {EDITOR_TAB_LABEL[tab]}
            </button>
          ))}
        </nav>

        <div className={styles.zoneRight} data-top-bar-zone="right">
          <button
            type="button"
            title={roleDisclaimers[role].text}
            className={openMenu === "role" ? styles.toolActive : styles.tool}
            data-bar-control="role"
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
            data-bar-control="settings"
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
            (decision 14). Guests stay download-only.

            STAGE 4B: Save Project is NOT RENDERED while a browsed design is on
            screen — it would hand over an editable copy of another company's
            project as one JSON file. Load Project stays: it replaces the
            browsed design with your own work, which is the way OUT of browsing,
            not a way around it. */}
        <div className={styles.menuList}>
          {!cloud?.browsing && (
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
          )}
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

      {/* U1: one note per view menu. Each lists ITS OWN stops and only its
          own, with the current one marked — which is the usable reading of
          Tommy's "will only show the current page under it's button menu".
          Read literally that sentence would make a menu list exactly the page
          you are already on, leaving no way to change page; his own example
          ("View and Summary just show view and Summary") is about the BAR
          text, not the menu body, and that is what the LABEL+Value treatment
          above implements.

          ⚠ ONE WRITER. Both notes call `onViewerStopChange` — page.tsx's
          `handleViewerStopChange` — with a stop out of the caller's own
          `viewerStops`. Neither sets `viewMode`, `simplified3D`, `showWraps`
          or `elevationViewWallId`; neither even knows those exist. Those four
          flags encode five stops between them, and two menus each writing
          their own subset is precisely how `showWraps` ends up true on a plan
          view. There is no second copy of that state machine here, and the
          sidebar's Region 3 — which keys off exactly those flags — is the
          harness assertion that proves it. */}
      {VIEWER_MENU_ORDER.map((menu) => (
        <StickyNote key={menu} id={`${menu}-note`} label={VIEWER_MENU_LABEL[menu]} {...noteProps(menu)}>
          <div className={styles.menuList} role="group" aria-label={`${VIEWER_MENU_LABEL[menu]} views`}>
            {viewerStopsForMenu(viewerStops, menu).map((stop) => {
              const key = viewerStopKey(stop);
              const isCurrent = viewerDialLive && key === viewerStopKey(currentViewerStop);
              return (
                <button
                  key={key}
                  type="button"
                  data-view-stop={key}
                  data-view-stop-current={isCurrent ? "true" : "false"}
                  className={isCurrent ? styles.menuItemActive : styles.menuItem}
                  aria-pressed={isCurrent}
                  onClick={() => {
                    onViewerStopChange(stop);
                    closeMenu();
                  }}
                >
                  {viewerStopLabel(stop)}
                </button>
              );
            })}
          </div>
        </StickyNote>
      ))}

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
        {/* U0 of the navigation reorganisation. Tommy: "move single wall run
            into the panelizer tab (speaking of which where is it? We should
            move the content of the panelizer into the settings in the top
            right)" — so Settings is where it lands, out of the right-hand
            tray's footer. Same label, same route.

            ⚠ It is still a NAVIGATION, exactly as it was in the tray: the
            sandbox is a whole separate calculation page, not a note. There is
            no localStorage anywhere in this app, so leaving the editor with an
            unsaved design still loses it — unchanged by this move, and the
            reason Read Me and Report Bug became notes instead. */}
        <div className={`${styles.menuList} ${styles.menuListAfterSection}`}>
          <Link
            href="/sandbox"
            className={styles.menuItemLink}
            title="A standalone sandbox for one wall run's panel layout and its numbers. Opens as its own page — save your design first."
            onClick={closeMenu}
          >
            Single Wall Run Calculation Sandbox →
          </Link>
        </div>
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
