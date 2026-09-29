"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { roleDisclaimers, type ViewerRole } from "./viewerRole";
import StickyNote from "./StickyNote";
import UnitSystemSwitch from "./UnitSystemSwitch";
import AccountControl from "./auth/AccountControl";
import { EDITOR_TAB_LABEL, type EditorTab } from "./editorTabs";
import { destinationLabel, isViewStopLive, viewerStopLabel } from "./viewLabels";
import {
  VIEWER_MENU_LABEL,
  VIEWER_MENU_ORDER,
  destinationKey,
  isCurrentDestination,
  viewerMenuEmptyReason,
  viewerMenuGroups,
  viewerMenuOwner,
  type MenuDestination,
  type MenuGroup,
  type ViewerMenuId,
  type ViewerStop,
} from "./viewerMenus";
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
  /** `page.tsx`'s one `editorTab` state. Since the tab dial was removed
   * (2026-09-29) the Design menu is its ONLY presentation — one source of
   * truth, one control — and `onEditorTabChange` is still `setEditorTab`, its
   * one writer, not a second copy of the state. */
  editorTab: EditorTab;
  onEditorTabChange: (tab: EditorTab) => void;
  /** Panelizer's keyhole — `page.tsx`'s `enabledEditorTabs`, which is derived
   * from the scope-of-work checkboxes. Read here, never duplicated: it decides
   * which subject groups the Design menu offers. */
  enabledTabs: EditorTab[];
  /* ---- the Design and View menus -----------------------------------------
     THE ONLY VIEW CONTROL IN THE APP since `ViewerDial` was removed
     (2026-09-28, Tommy: "All of the viewers and editors that you can reach
     through the dial should be accessible on the top bar"). These are the same
     three values the dial took, unchanged, which is why the dial could simply
     be removed rather than rewritten. */
  /** The whole cycle, in Tommy's order. **Supplied by the caller and merely
   * FILTERED here** (`viewerStopsForMenu`), so what the two menus contain is
   * the caller's business: adding the Floor / Roof / Foundation editors to
   * them later — which Tommy raised on 2026-09-28 and which is still being
   * settled with him — needs no change to this component. Nothing in here
   * types out a list of stops. */
  viewerStops: ViewerStop[];
  /** page.tsx's `currentViewerStop` — the single reader of the four view
   * flags. This component never reads those flags itself. */
  currentViewerStop: ViewerStop;
  /** page.tsx's `handleViewerStopChange`, and the ONLY writer of them. Both
   * menus call this one function; see the note on the menus below. */
  onViewerStopChange: (stop: ViewerStop) => void;
  /** Only its presence is read, and only to answer `isViewStopLive`. Passed
   * as the footprint rather than as a ready-made boolean so that this
   * component calls the one named predicate itself, instead of trusting a
   * caller to have computed the same condition — which is the seam that
   * predicate was added to close. */
  footprint: Footprint | null;
}

type OpenMenu = "project" | "site" | "panelizer" | "role" | "settings" | "design" | "view" | null;

/**
 * The two bar words that hold a place for a page nobody has built yet.
 *
 * ⚠ A CONTROL THAT OPENS NOTHING IS FORBIDDEN BY THIS SECTION'S OWN RULE, and
 * Tommy broke it here knowingly, 2026-09-29, having been told so: *"i like the
 * add then now as disabled placeholders. that is okay for this instance because
 * i want to get a feel for how this is going to be a user friendly
 * experience."* Recorded as his decision so that a later reader finds an
 * exception with a reason rather than a rule that quietly stopped applying.
 *
 * They are `disabled`, so the exception costs nobody a dead click, and each
 * says in its title what is not built yet. **When U4 and U5 build the pages,
 * these two entries are what they replace** — and `viewLabels.ts`'s
 * `currentViewLabel` will need extending then, per its own note, so the Report
 * Bug context line can name those surfaces too.
 *
 * ⚠ THE ORDER IS AN OPEN QUESTION, not a decision. Tommy's own 2026-09-26 list
 * reads "Design, View, Print, Summary" while his example of the menus a
 * sentence later reads "Summary Print". This uses Summary then Print, which is
 * the order U1 measured and published; it is a label-order question for him and
 * costs nothing either way (they measure 71.8px and 55.4px, so the pair is the
 * same width in either order).
 */
/**
 * What a disabled Design or View button says about itself.
 *
 * The WHICH is `viewerMenuEmptyReason`, in viewerMenus.ts, where it is derived
 * from the same inputs that made the menu empty and is unit-tested; the WORDING
 * is here, because it is presentation. ⚠ The reason this split exists at all:
 * View used to tell anyone whose Walls branch was unchecked to "draw one on the
 * plan first" even with a footprint already drawn — a disabled control giving an
 * instruction that cannot help, which sends the user to fix something that is
 * not broken.
 */
const EMPTY_MENU_REASON: Record<"no-footprint" | "walls-out-of-scope" | "nothing-in-scope", string> = {
  "no-footprint": "The 3D views need a footprint — draw one on the plan first",
  "walls-out-of-scope": "The 3D views are of the walls, and Walls is unchecked in the Panelizer's scope of work",
  "nothing-in-scope": "Nothing is in the scope of work yet — check a branch in the Panelizer",
};

const BAR_PLACEHOLDERS: readonly { id: string; label: string; title: string }[] = [
  {
    id: "summary",
    label: "Summary",
    title:
      "Not built yet — a placeholder. Summary will hold the project summary, project totals and materials totals pages that are in the right-hand tray today.",
  },
  {
    id: "print",
    label: "Print",
    title: "Not built yet — a placeholder. Print will hold all the shop drawings.",
  },
];

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
 * Sticky top-of-screen chrome, in TWO zones (spec: "Top Bar & App Chrome — the
 * Stitch reorganisation", and Tommy's decisions of 2026-09-28/29).
 *
 * - LEFT, identity & document & where you are: the acting-as / sign-in control,
 *   then Project ▾ (Save, Load, Site Properties, Panelizer — the things that
 *   change the building or the file), then Design ▾ and View ▾, then the
 *   Summary and Print placeholders.
 * - RIGHT, presentation: Role ▾ and ⚙ Settings (units and Admin Options — the
 *   things that change only how you look at it). No help icon: there is
 *   nothing for it to open yet.
 *
 * ⚠ **THE MIDDLE ZONE IS GONE, AND SO IS EVERY `min-width: 1200px` RULE IN
 * THIS COMPONENT'S STYLESHEET.** It held the Wall / Foundation / Floor / Roof
 * nav at ≥1200px, paired with `EditorTabDial` in the sidebar below that width.
 * On 2026-09-28 Tommy merged the two axes and the nav's four items became
 * subject groups inside the Design menu; on 2026-09-29 he removed the tab dial
 * too ("Remove it — Design is the only door"), so **neither half of that pair
 * exists** and there is nothing left for a breakpoint to flip. The wordmark,
 * which shared the same query, went with them. 1200px still matters to this
 * bar's NEIGHBOURS — the company name's cap rises there
 * (`AccountControl.module.css`) — and nowhere in this file.
 *
 * Why the nav was never put at 768px, kept because the reasoning still governs
 * what may shed: measured with four companies, the bar at 768 has 34px spare
 * with the company name at its 220px, and the nav plus the wordmark needed
 * ~380px more. They would have crushed the acting-as company name — the one
 * thing this bar exists to keep legible. Tommy moved them to 1200 (2026-09-13),
 * and then removed both.
 *
 * WHY DESIGN AND VIEW HAVE NO BREAKPOINT AT ALL. U1 shipped them at a fourth,
 * measured width (1454px) and let the sidebar dial catch the stops below it.
 * **With the dial removed there is nothing to catch them**: a width at which
 * these two are hidden is a width at which the plan, every wall elevation and
 * the three 3D views are unreachable. So they are on the bar at every width,
 * which is what makes the honest declared range (below) a statement about the
 * acting-as company name rather than about reachability.
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
 * WHY THERE IS NO SCROLLER. The left zone is the only thing allowed to shrink,
 * and inside it only the acting-as company name does (ellipsis + title). If a
 * future change breaks that, it should break visibly, not slide a control
 * silently off-screen. Truncated-with-a-tooltip beats absent — and where even
 * truncation runs out, the measured widths are published rather than glossed:
 * see `apps/web/harness/ui-reorg-u1/README.md`, which records the declared
 * supported range and every width at which the company name is fully absent.
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
   * Whether a view stop is actually driving the canvas — the SAME named
   * predicate the Report Bug note's context line reads, CALLED here rather
   * than re-typed. Its input is a plain object, not component props, precisely
   * so that a different component can ask the same question and be guaranteed
   * the same answer.
   *
   * Writing `editorTab === "wall" && Boolean(footprint)` out here instead is
   * exactly what this predicate was added (2026-09-28) to prevent: that
   * condition had already been written twice, in opposite polarities, ~900
   * lines apart in page.tsx.
   *
   * ⚠ WHAT IT ACTUALLY ANSWERS HERE, stated exactly, because an earlier version
   * of this comment claimed it drove the buttons' `disabled` and both
   * highlights and it drives neither: it decides ONLY whether the owning
   * button's title names the current view STOP or the current SUBJECT. The
   * `disabled` state is "this menu has no destinations"; the highlights are
   * `viewerMenuOwner` and `isCurrentDestination`, which do not read the
   * footprint at all — on purpose, since Design owns the plan before one is
   * drawn.
   * (It was `isViewerDialLive`; the dial it was named after is gone, the
   * one-definition property it was created for is not.)
   */
  const viewStopLive = isViewStopLive({ editorTab, footprint });
  /** LEVEL ONE of the highlight, computed once for both buttons: which menu the
   * user is working inside. Exactly one always owns — including on a cold load,
   * before any footprint exists, which is the screen Tommy described as making
   * "the design button highlighted". */
  const owningMenu = viewerMenuOwner({ editorTab, currentStop: currentViewerStop });
  /** What each menu offers, grouped by subject, out of the ONE list of stops and
   * the ONE enabled-tabs array the caller passed. Computed here rather than in
   * the render of each button so the bar's `disabled` state and the note's
   * contents can never disagree about whether a menu is empty. */
  const menuGroups: Record<ViewerMenuId, MenuGroup[]> = {
    design: viewerMenuGroups("design", { stops: viewerStops, enabledTabs, footprint }),
    view: viewerMenuGroups("view", { stops: viewerStops, enabledTabs, footprint }),
  };
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
  /** Selecting a destination. **Neither branch writes any state itself** — each
   * calls the one existing writer of the state it changes: the four view flags
   * only ever move through page.tsx's `handleViewerStopChange`, and `editorTab`
   * only ever through its `setEditorTab`.
   *
   * A stop chosen from the Floor tab has to bring the wall subject with it, or
   * the click would set a view nobody can see and look like a dead control; so
   * the tab is set FIRST and the stop second, which is also the order that
   * leaves `editorTab` correct if a render happens in between. */
  const goToDestination = (destination: MenuDestination) => {
    if (destination.kind === "subject") {
      onEditorTabChange(destination.subject);
    } else {
      if (editorTab !== "wall") onEditorTabChange("wall");
      onViewerStopChange(destination.stop);
    }
    closeMenu();
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
          {/* ⚠ THE WORDMARK USED TO BE HERE and was removed 2026-09-28 on
              Tommy's word: "I don't think it's really all that important to
              have Building Integrity in left side. Maybe that would save a lot
              of space." It was a `Building Integrity` text span (no logo asset
              exists) shown at 1200px and up only, measured at ~142px with its
              gap. Recorded rather than silently absent, because the space it
              freed is what the two view menus spend at ≥1200px. The app's name
              still prints on every sheet — SheetTitleBlock renders its own
              wordmark and is untouched. */}

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

          {/* Design ▾ and View ▾ — THE app's view control since `ViewerDial`
              was removed (2026-09-28).

              ⚠ BARE WORDS, NO CAPTION AND NO VALUE, and that is Tommy's
              decision of 2026-09-28, superseding his own of 2026-09-26: "Can
              design and view be drop down menus that don't have a: nor the
              description of what page they are on reading after it… That would
              reduce the view button to just saying view." The value string was
              most of the width — the built `DESIGN 2D Floor Plan ▼` measured
              176.8px against ~73px bare — and that saving is what lets these
              two live on the bar at EVERY width, which is what the dial's
              removal requires of them.

              ⚠ NO MEDIA QUERY, DELIBERATELY. U1 hid them below 1454px and let
              the sidebar dial catch the stops. There is no dial now, so a
              width at which these are hidden is a width at which the plan,
              every wall elevation and the three 3D views cannot be reached at
              all. They are always on the bar; the acting-as company name is
              what gives instead, and every width at which it is fully absent
              is published in the harness README rather than left to be found.

              ⚠ WHAT WENT WITH THE DIAL, so neither absence reads as an
              oversight later: scroll-wheel cycling (nothing replaces it — an
              open question, not a settled answer) and `useRustleSound()`
              (Tommy: "The rustle sound is no big deal. I'll probably add sound
              effects to certain things at later dates"). The sidebar's
              Wall/Foundation/Floor/Roof tab dial was a DIFFERENT control and
              was left alone that day; Tommy removed it the next, so these two
              words are now the only navigation in the app's chrome.

              ⚠ WHAT THESE MENUS CONTAIN IS THE CALLER'S BUSINESS. Nothing here
              lists a destination: `viewerMenuGroups` filters the caller's own
              `viewerStops` and its own `enabledTabs`. That is what let the
              subjects Tommy merged in on 2026-09-28 — Floor, Roof, Foundation,
              each gated by the scope checkbox it already had — arrive as a
              grouping rule rather than as a rewrite of this component, and it
              is what will let the roof-panel and 3D-foundation viewers arrive
              the same way. */}
          {VIEWER_MENU_ORDER.map((menu) => {
            /* LEVEL ONE OF THE HIGHLIGHT — the bar. `owningMenu` is
               `viewerMenuOwner` called once above; "Design highlighted" means
               "you are designing", and Design owns the plan, every wall
               elevation and the Floor / Roof / Foundation editors, View the
               three 3D representations.

               ⚠ IT IS NOT COLOUR ALONE, and the attribute is `aria-current`,
               not `aria-pressed`. Both were tried; `aria-pressed` is wrong here
               and the reason is worth keeping: this button ALSO carries
               `aria-expanded`, and activating it opens a menu rather than
               toggling anything on or off. A screen reader would announce a
               toggle button that is "pressed" and then open a menu, which
               describes a control this is not. `aria-current="true"` says the
               true thing — this is the one of the set you are currently in —
               and it is the same attribute the menu entries use one level down,
               which is exactly the relationship being expressed.

               The visible cue is an underline as well as colour, which is the
               device the removed nav tabs used and for their recorded reason:
               an underline does not change the control's width, so ownership
               moving between Design and View can never reflow the bar. Weight
               would have. */
            const isOwner = owningMenu === menu;
            return (
              <button
                key={menu}
                type="button"
                data-bar-control={menu}
                data-view-menu={menu}
                data-view-menu-owner={isOwner ? "true" : "false"}
                /* The current stop's NAME, for the browser harnesses only —
                   they used to read it off the dial's face, and the bar
                   deliberately no longer shows it anywhere. It is rendered from
                   the same `viewerStopLabel(currentViewerStop)` the open menu
                   marks, so the two cannot drift, and the harness asserts they
                   agree. Nothing is displayed; it adds no width. */
                data-view-menu-current-stop={
                  isOwner && viewStopLive ? viewerStopLabel(currentViewerStop) : undefined
                }
                /* ⚠ DISABLED WHEN, AND ONLY WHEN, THE MENU HAS NOWHERE TO GO —
                   which is read off the very groups the note below renders, so
                   the button and its menu can never disagree. It is NOT keyed to
                   `isViewStopLive` any more, and that is a correctness fix
                   rather than a preference: these menus now hold the Floor, Roof
                   and Foundation editors, so a Design button disabled off the
                   wall subject would be a door locked from the inside — the only
                   way back to the drawing, greyed out because you had used it.
                   In practice Design is never empty (at least one scope branch
                   is always checked) and View is empty until a footprint exists,
                   exactly as the old dial was disabled until then. */
                disabled={menuGroups[menu].length === 0}
                aria-current={isOwner ? "true" : undefined}
                title={
                  menuGroups[menu].length === 0
                    ? EMPTY_MENU_REASON[
                        viewerMenuEmptyReason(menu, { stops: viewerStops, enabledTabs, footprint }) ?? "nothing-in-scope"
                      ]
                    : isOwner
                      ? menu === "design"
                        ? `You are designing — ${viewStopLive ? viewerStopLabel(currentViewerStop) : EDITOR_TAB_LABEL[editorTab]}`
                        : `You are viewing — ${viewerStopLabel(currentViewerStop)}`
                      : menu === "design"
                        ? "Where to design: the plan, each wall's elevation, and the floor, roof and foundation editors in scope"
                        : "The 3D views: framed, boxes and membranes"
                }
                className={
                  isOwner
                    ? openMenu === menu
                      ? styles.toolOwnerActive
                      : styles.toolOwner
                    : openMenu === menu
                      ? styles.toolActive
                      : styles.tool
                }
                aria-expanded={openMenu === menu}
                onClick={(e) => toggleMenu(menu, e.currentTarget)}
              >
                {/* The word gets its own span rather than being loose text:
                    the button also carries the caret, so a reader comparing
                    `textContent` to "View" would fail on "View ▼" and read
                    exactly like a rename that never happened. */}
                <span data-view-menu-word="">{VIEWER_MENU_LABEL[menu]}</span>
                {caret(menu)}
              </button>
            );
          })}

          {/* ⚠ SUMMARY AND PRINT — DISABLED PLACEHOLDERS, AND THAT BREAKS THIS
              SECTION'S OWN RULE ON TOMMY'S EXPLICIT DECISION.

              The Top Bar rule is that a control which opens nothing does not go
              on the bar; it is why U1 measured Summary and Print rather than
              building them. Told that, he chose to break it here, 2026-09-29:
              *"i like the add then now as disabled placeholders. that is okay
              for this instance because i want to get a feel for how this is
              going to be a user friendly experience."* So this is a deliberate,
              recorded exception for ONE case, not the rule quietly lapsing —
              and the `disabled` state plus the title is what keeps it honest:
              the control cannot be clicked into a dead end, and hovering says
              why.

              THEY ARE NOT VIEW MENUS. They carry no `data-view-menu`, take no
              part in the owner rule, and open no note. They are two words
              holding two places, and the pages behind them are U4 and U5.

              What he says goes in them, recorded here and NOT built: Summary
              holds "project summary, project totals, and materials totals pages
              that we have under summary"; Print holds "all the shop drawings".
              And, tentatively — his word is "maybe" — "maybe the print button
              opens and closes the right bar", which is an unresolved idea
              rather than a requirement, and one that interacts with U5, the
              stage that deletes the right sidebar. */}
          {BAR_PLACEHOLDERS.map((placeholder) => (
            <button
              key={placeholder.id}
              type="button"
              data-bar-control={placeholder.id}
              data-bar-placeholder=""
              disabled
              title={placeholder.title}
              className={styles.toolPlaceholder}
            >
              {placeholder.label}
            </button>
          ))}
        </div>

        {/* ⚠ THE FOUR SCOPE TABS USED TO BE HERE — a middle zone of
            Wall / Foundation / Floor / Roof buttons at 1200px and up. Tommy
            merged the two axes on 2026-09-28: the subjects are now GROUPS
            INSIDE the Design menu, and "no separate Walls / Floor / Roof /
            Foundation bar items". The plan estimated that at ~264px; MEASURED
            against the same bar with the four tab items projected back onto it,
            it is **294.3px** — the single biggest saving available on this bar,
            and the reason this pass's figures are not comparable to U1's.
            (apps/web/harness/ui-reorg-u1/evidence.json, tabFoldSavingPx.)

            The state did not move: `editorTab` is still one `useState` in
            page.tsx with `setEditorTab` its one writer. `EditorTabDial` in the
            sidebar went on 2026-09-29 — asked what should become of it now that
            the bar carried no tabs, Tommy said "Remove it — Design is the only
            door", against a review that recommended showing it at every width.
            ⚠ The reason the review gave is real and is recorded at Region 2 in
            page.tsx: with both gone, NOTHING IN THE CHROME NAMES THE CURRENT
            SUBJECT — this button reads "Design" on all four. */}

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

      {/* One note per view menu. Each lists ITS OWN stops and only its own,
          with the current one marked — which is the usable reading of Tommy's
          "will only show the current page under it's button menu". Read
          literally that sentence would make a menu list exactly the page you
          are already on, leaving no way to change page.

          ⚠ LEVEL TWO OF THE HIGHLIGHT, and it is the whole of how the current
          stop is shown now that the bar words are bare. Tommy, 2026-09-28: "it
          opens a small drop-down menu that you can clearly see that Plan View
          is highlighted in the drop-down menu." So this marker is load-bearing
          information, not decoration, and it is NOT colour alone:
          `aria-current="true"` names it to a screen reader, and the visible
          cue adds weight and a left edge bar on top of the surface colour.
          `aria-current` rather than `aria-pressed` because these five items are
          one single-select set — where you ARE — and not five independent
          toggles; the bar button beside them is the toggle, and it is the one
          that carries `aria-pressed`. Two states, two controls, two different
          attributes, on purpose.

          ⚠ ONE WRITER, AND THE MERGE DID NOT ADD A SECOND. Every stop entry in
          either note goes through `goToDestination`, which calls
          `onViewerStopChange` — page.tsx's `handleViewerStopChange` — with a
          stop out of the caller's own `viewerStops`. Nothing here sets
          `viewMode`, `simplified3D`, `showWraps` or `elevationViewWallId`;
          nothing here knows those exist. Those four flags encode five stops
          between them, and two menus each writing their own subset is precisely
          how `showWraps` ends up true on a plan view. Subject entries write
          `editorTab` and nothing else, through its own one writer
          (`setEditorTab`, arriving as `onEditorTabChange`) — the same one the
          sidebar's tab dial has always called. Two states, two writers, no
          third. Sidebar Region 3 keys off exactly those four view flags, which
          is why its rendered signature is the harness assertion that proves
          this. */}
      {VIEWER_MENU_ORDER.map((menu) => (
        <StickyNote key={menu} id={`${menu}-note`} label={VIEWER_MENU_LABEL[menu]} {...noteProps(menu)}>
          {/* One `role="group"` per SUBJECT, each with its own accessible name:
              Tommy chose grouped over flat so that the headings say which
              subject, and a heading that is only a bold line of text says that
              to sighted readers alone. A group with an accessible name says it
              to everyone.

              ⚠ EVERY GROUP IS NAMED, INCLUDING THE SINGLE-ENTRY ONES. A
              single-entry subject shows no visible heading — repeating "Floor"
              directly above an entry reading "Floor" is noise, not grouping —
              but it still gets `aria-label={EDITOR_TAB_LABEL[subject]}`. The
              first version labelled all three of them "Design destinations",
              which gave Floor, Roof and Foundation one shared accessible name
              between them: to a screen reader that is one group listed three
              times, which is worse than no grouping at all. */}
          {menuGroups[menu].map((group) => (
            <div
              key={group.subject ?? "representations"}
              className={styles.menuList}
              data-menu-group={group.subject ?? "representations"}
              role="group"
              aria-label={
                group.heading ?? (group.subject ? EDITOR_TAB_LABEL[group.subject] : `${VIEWER_MENU_LABEL[menu]} destinations`)
              }
            >
              {group.heading && (
                <p className={styles.menuGroupHeading} data-menu-group-heading="">
                  {group.heading}
                </p>
              )}
              {group.destinations.map((destination) => {
                const key = destinationKey(destination);
                /* LEVEL TWO OF THE HIGHLIGHT, from its one definition — called
                   rather than re-typed, and comparing stop KEYS because
                   `currentViewerStop` is rebuilt on every render so object
                   identity would silently never match. */
                const isCurrent = isCurrentDestination(destination, { editorTab, currentStop: currentViewerStop });
                return (
                  <button
                    key={key}
                    type="button"
                    /* `data-view-stop` is kept as the name for stop entries —
                       five harnesses locate by it — and subject entries get
                       their own attribute rather than being folded into it, so
                       a harness asking for a view stop can never be handed a
                       tab. */
                    {...(destination.kind === "stop" ? { "data-view-stop": key } : { "data-design-subject": destination.subject })}
                    data-view-stop-current={isCurrent ? "true" : "false"}
                    className={isCurrent ? styles.menuItemCurrent : styles.menuItem}
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => goToDestination(destination)}
                  >
                    {destinationLabel(destination)}
                  </button>
                );
              })}
            </div>
          ))}
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
