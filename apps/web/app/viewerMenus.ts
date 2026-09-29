import type { Footprint } from "@building-integrity/geometry";

import { EDITOR_TAB_LABEL, EDITOR_TAB_ORDER, editorTabsInScope, type EditorTab } from "./editorTabs";

/**
 * Everywhere the two top-bar menus — `Design` and `View` — can take you, and
 * which of them owns where you are.
 *
 * ## ⚠ THE TWO AXES MERGED (Tommy's interview, 2026-09-28)
 *
 * Until now the **tab** said what you were editing (Wall / Foundation / Floor /
 * Roof) and the **view** said how you were looking at it (plan, elevation, 3D,
 * membranes). He collapsed them:
 *
 * - **Design** holds every design destination, grouped by subject — the wall
 *   subject's Plan View and one entry per wall elevation, then Floor, Roof and
 *   Foundation.
 * - **View** holds the generated representations: 3D Framed, 3D Boxes,
 *   Membranes.
 * - **The four tab items are gone from the bar**, which frees roughly 264px —
 *   the single biggest saving available on it.
 *
 * So a destination is one of two things, and that is why `MenuDestination`
 * exists: a **view stop** (the four view flags, written only by
 * `handleViewerStopChange`) or a **subject** (the `editorTab` state, written
 * only by `setEditorTab`). Each still has exactly one writer; this module
 * writes neither and merely says what the choices are.
 *
 * ## Why this module is now the home of `ViewerStop`
 *
 * The stop type, its keys and its order used to live in `ViewerDial.tsx`.
 * **`ViewerDial` was REMOVED on 2026-09-28 at Tommy's instruction** — *"I would
 * like to not have the dial after these updates. All of the viewers and
 * editors that you can reach through the dial should be accessible on the top
 * bar"* — so the two bar menus are the only presentation of these stops left,
 * and the type moved to the module that owns the split rather than being left
 * in a file whose only remaining job was to export it.
 *
 * What went with the dial, deliberately and on Tommy's own decisions, recorded
 * here so a later reader does not read either absence as an oversight:
 * **scroll-wheel cycling** (nothing replaces it yet, and that is an open
 * question rather than a settled answer) and **`useRustleSound()`** (*"The
 * rustle sound is no big deal. I'll probably add sound effects to certain
 * things at later dates"*). `EditorTabDial` — the Walls/Floor/Roof/Foundation
 * tab dial — is a DIFFERENT control and is untouched.
 *
 * ## What this module deliberately does NOT do: write anything
 *
 * The four flags behind a stop (`viewMode`, `simplified3D`, `showWraps`,
 * `elevationViewWallId`) encode five stop kinds between them, and
 * `page.tsx`'s `handleViewerStopChange` is the only function that sets them
 * consistently — `currentViewerStop` is the only thing that reads them back.
 * Both menus call that same one function with a stop out of that same one
 * list. **Two menus each setting their own subset is exactly how `showWraps`
 * ends up true on a plan view**, and it is the single thing the U1 plan names
 * as most likely to be got wrong. Splitting the PRESENTATION is safe; there
 * is no second copy of the state machine anywhere in here, and every function
 * below is pure.
 *
 * ## The two levels of highlight are two functions, not one
 *
 * Tommy, 2026-09-28: *"This will make the design button highlighted so that
 * the user immediately can tell that they're designing. If they click the
 * design button, it opens a small drop-down menu that you can clearly see that
 * Plan View is highlighted."* Those are two different controls carrying two
 * different facts, so they are `viewerMenuOwner` (the BAR: which menu owns the
 * surface) and `isCurrentDestination` (the OPEN MENU: which entry you are on).
 * Neither is derived from the other's rendering, and each has its own test and
 * its own browser acceptance criterion.
 */

/**
 * One stop of the view control: the plan, one per wall elevation, and the
 * three 3D modes.
 *
 * `"Membranes"` (not `"3D Wraps"`) is the user-facing label and `"3d-wraps"`
 * is the internal key. Both are deliberate — the word was renamed at Tommy's
 * request and the key was not — and the rename of `2D Floor Plan` to
 * `Plan View` is still an OPEN QUESTION for him. Do not "tidy" any of the
 * three; `viewLabels.ts` holds the strings and its test asserts them.
 */
export type ViewerStop =
  | { kind: "plan" }
  | { kind: "elevation"; wallId: string; label: string }
  | { kind: "3d-framed" }
  | { kind: "3d-boxes" }
  | { kind: "3d-wraps" };

export type ViewerMenuId = "design" | "view";

/** Left to right on the bar, matching Tommy's own list: "Design, View, …". */
export const VIEWER_MENU_ORDER: readonly ViewerMenuId[] = ["design", "view"];

/**
 * The word each menu shows on the bar.
 *
 * **BARE WORDS, and that is the design.** Tommy, 2026-09-28: *"Can design and
 * view be drop down menus that don't have a: nor the description of what page
 * they are on reading after it… That would reduce the view button to just
 * saying view."* This supersedes his own 2026-09-26 instruction that the two
 * should read like the acting-as chip (`DESIGN 2D Floor Plan`), and the reason
 * is measured: the built labelled Design button was **176.8px**, against about
 * 73px bare. The current stop is shown by highlight instead — on the bar for
 * the owning menu, in the open menu for the stop itself.
 *
 * **Consequence worth keeping:** the LABEL + Value treatment is now unique to
 * the acting-as chip, the one control whose value must always be readable for
 * a documented safety reason.
 */
export const VIEWER_MENU_LABEL: Record<ViewerMenuId, string> = {
  design: "Design",
  view: "View",
};

/**
 * A stop's identity, independent of the object it arrived in.
 *
 * `viewerStops` is rebuilt by a `useMemo` whenever the footprint changes and
 * `currentViewerStop` is constructed fresh on every render, so two stops that
 * mean the same view are never the same object. This is how each menu marks
 * its current item. (It was `ViewerDial`'s own private `stopKey`.)
 */
export function viewerStopKey(stop: ViewerStop): string {
  return stop.kind === "elevation" ? `elevation-${stop.wallId}` : stop.kind;
}

/**
 * Which menu a stop belongs under.
 *
 * Tommy's own division: *"View, where the 3D box, 3d framed, and membranes
 * editors/viewers live"* — so everything 3D is View, and the drawing surfaces
 * (the plan and every wall elevation) are Design. Written as an exhaustive
 * switch rather than a `startsWith("3d")` test so that adding a sixth stop
 * kind is a type error here instead of a silent default.
 */
export function viewerMenuForStop(stop: ViewerStop): ViewerMenuId {
  switch (stop.kind) {
    case "plan":
    case "elevation":
      return "design";
    case "3d-framed":
    case "3d-boxes":
    case "3d-wraps":
      return "view";
  }
}

/**
 * The stops one menu offers, **in the order Tommy set for the cycle**.
 *
 * That order is his and was recorded on the dial before it was removed:
 * *"cycle the wall view options… starting at the top and going clockwise, and
 * the wheel moves onto 3D views"* — plan, then one elevation per wall in
 * footprint order, then the three 3D modes. Filtering preserves it, which is
 * why Design reads Plan first and View reads Framed → Boxes → Membranes.
 * Deriving both menus from the caller's one `viewerStops` array (rather than
 * from a list typed out here) is what guarantees the two menus together are
 * exactly the whole cycle, no more and no less — including one entry per wall
 * for a footprint with any number of walls. **With the dial gone that property
 * is the only thing standing between "every stop is reachable from the bar"
 * and a stop nobody can get to**, so its test is not a formality.
 */
export function viewerStopsForMenu(stops: readonly ViewerStop[], menu: ViewerMenuId): ViewerStop[] {
  return stops.filter((stop) => viewerMenuForStop(stop) === menu);
}

/**
 * One place a menu entry can take you: a view stop, or a design subject.
 *
 * Two kinds rather than one because the two write different state through
 * different single writers — `handleViewerStopChange` for the four view flags,
 * `setEditorTab` for the tab. A discriminated union makes the caller handle
 * both, so a third kind added later is a type error at every call site instead
 * of a silently ignored entry.
 */
export type MenuDestination =
  | { kind: "stop"; stop: ViewerStop }
  | { kind: "subject"; subject: EditorTab };

/** A destination's identity, for React keys, harness locators and the
 * current-entry comparison. Never object identity: both stops and the current
 * tab are rebuilt on every render. */
export function destinationKey(destination: MenuDestination): string {
  return destination.kind === "stop" ? viewerStopKey(destination.stop) : `subject-${destination.subject}`;
}

/**
 * One headed group inside a menu.
 *
 * `heading` is `null` when the group holds a single destination, because there
 * the entry's own label already says the subject and a heading would repeat the
 * word immediately above it. Tommy's reason for choosing grouped over flat was
 * that *"the headings do the work the removed tabs used to do — they say which
 * subject"*; a heading over one identically-named entry does not do that work,
 * it just doubles it. So the Wall group is headed as soon as it has a plan plus
 * at least one elevation (i.e. as soon as a footprint exists), and Floor, Roof
 * and Foundation are single entries until they grow a second destination — at
 * which point they become headed automatically, with no rule to remember. ⚠
 * This is a presentational judgement, not something Tommy ruled on; it is
 * flagged in the report rather than passed off as his decision.
 */
export interface MenuGroup {
  /** Which subject this group is, for locators and for the heading. `null` for
   * the View menu, whose entries are representations of the whole building and
   * belong to no one subject. */
  subject: EditorTab | null;
  heading: string | null;
  destinations: MenuDestination[];
}

/**
 * The order the Design menu's subject groups appear in.
 *
 * ⚠ **THIS IS NOT `EDITOR_TAB_ORDER`, AND THE DIFFERENCE IS DELIBERATE.** That
 * one is *building* order — wall, foundation, floor, roof — and is what the tab
 * controls have always used. **Tommy named this order twice on 2026-09-28**,
 * in the instruction and again in the interview: *"Walls (Plan View, then each
 * wall elevation), then Floor, Roof, Foundation."* His order is used here
 * because he gave it for this menu specifically; the two constants are kept
 * apart rather than one being quietly re-sorted, and the test asserts this one
 * holds exactly the four tabs so a fifth cannot slip past either list.
 * **Whether the menu should instead follow building order is a question for
 * him, raised in the report, not answered here.**
 */
export const DESIGN_SUBJECT_ORDER: readonly EditorTab[] = ["wall", "floor", "roof", "foundation"];

export interface MenuGroupsInput {
  /** The caller's whole stop cycle. Filtered, never rebuilt. */
  stops: readonly ViewerStop[];
  /** `page.tsx`'s `enabledEditorTabs` — Panelizer's keyhole checkboxes, already
   * derived from `wallsEnabled` / `foundationEnabled` / `floorsEnabled` /
   * `roofEnabled`. **Read, never duplicated:** the scope of work has one source
   * of truth and this is downstream of it. An unchecked subject has no group,
   * which is the same "absent, not shown-and-inert" rule `editorTabsInScope`
   * already applies to the tab controls. */
  enabledTabs: readonly EditorTab[];
  /** Only its presence is read. The 3D representations are of a building, so
   * with no footprint the View menu has nothing to offer and says so by being
   * empty — which is how the old dial behaved (it was `disabled` with no
   * footprint), kept rather than reinvented. */
  footprint: Footprint | null | undefined;
}

/**
 * What one menu offers, grouped.
 *
 * **A pure function of the caller's own inputs.** It types out no stop, no
 * label and no scope: the stops are the caller's array filtered, and the
 * subjects are the caller's enabled-tabs array filtered. That is what makes
 * "the two menus together reach everything, and nothing that is out of scope"
 * a property rather than a hope — and it is why adding, say, a 3D foundation
 * viewer later is a change to what the caller passes, not to this file.
 *
 * ⚠ **AN EMPTY LIST IS A REAL ANSWER AND MUST NOT BE PAPERED OVER.** `View`
 * with no footprint has no destinations; the button is then disabled with its
 * reason in the title, exactly as the dial was. `Design` cannot be empty,
 * because at least one scope branch is always checked (`isLastEnabledScopeBranch`
 * refuses to let the last one off) and the wall subject always carries the plan
 * stop — but the caller is not asked to know that, it just renders what it is
 * given.
 */
export function viewerMenuGroups(menu: ViewerMenuId, { stops, enabledTabs, footprint }: MenuGroupsInput): MenuGroup[] {
  /* ⚠ `editorTabsInScope`, NOT `enabledTabs.includes(...)`, and the difference
     is not style. That helper is the one place the keyhole's rule lives, and
     its own doc says sharing it "is what stops the two presentations from ever
     disagreeing". Their behaviours differ in exactly one case — an EMPTY list,
     where the helper falls back to every tab and a raw `includes` offers
     nothing — and "the menu is empty" is the one state this whole module
     treats as meaningful (it is what disables a button). page.tsx cannot
     produce an empty list today, because the last checked scope branch refuses
     to be unchecked, so this is a seam rather than a bug; using the helper is
     what stops it re-opening. */
  const subjectsInScope = editorTabsInScope(enabledTabs);
  if (menu === "view") {
    if (!footprint || !subjectsInScope.includes("wall")) return [];
    const destinations = viewerStopsForMenu(stops, "view").map((stop) => ({ kind: "stop" as const, stop }));
    return destinations.length > 0 ? [{ subject: null, heading: null, destinations }] : [];
  }
  const groups: MenuGroup[] = [];
  for (const subject of DESIGN_SUBJECT_ORDER) {
    if (!subjectsInScope.includes(subject)) continue;
    const destinations: MenuDestination[] =
      subject === "wall"
        ? viewerStopsForMenu(stops, "design").map((stop) => ({ kind: "stop" as const, stop }))
        : [{ kind: "subject" as const, subject }];
    if (destinations.length === 0) continue;
    /* The heading is the tab's OWN label out of `editorTabs.ts` — the same
       string the removed nav tab showed, which is the most faithful reading of
       "the headings do the work the removed tabs used to do". (Tommy wrote the
       wall one as the plural "Walls"; this uses the app's single definition,
       `Wall`, rather than introducing a second spelling. Flagged in the report
       as a wording question for him.) */
    groups.push({
      subject,
      heading: destinations.length > 1 ? EDITOR_TAB_LABEL[subject] : null,
      destinations,
    });
  }
  return groups;
}

/**
 * LEVEL ONE OF THE HIGHLIGHT — the BAR: which menu owns the editor surface,
 * and therefore which button renders as pressed.
 *
 * Tommy: *"the design button highlighted so that the user immediately can tell
 * that they're designing."*
 *
 * **Exactly one menu always owns**, and that is a change from the split-axis
 * version, made for a measured reason: on a cold load there is no footprint
 * yet, and the old rule (`live`, which requires one) left NEITHER menu
 * highlighted on the very screen Tommy describes as *"When you open the app
 * it'll automatically be in planview editor. This will make the design button
 * highlighted."* The plan surface is what is on screen before a footprint
 * exists — it is where you draw it — so Design owns there. Off the wall
 * subject, Design owns because a floor, roof or foundation editor is a design
 * destination too, now that the menu holds them.
 *
 * **Derived, never stored.** There is no `owner` state anywhere; this reads
 * `editorTab` and `currentViewerStop`, the latter being itself the single
 * reader of the four view flags.
 *
 * ⚠ **This is NOT the same question as `isViewStopLive`, and they must not be
 * conflated.** That predicate asks *"is a view stop what is on screen"*, which
 * is what the Report Bug note needs before it names one — and before a
 * footprint exists the honest answer there is still no. Ownership asks *"which
 * menu is the user working inside"*. Same screen, two different true answers.
 */
export function viewerMenuOwner({
  editorTab,
  currentStop,
}: {
  editorTab: EditorTab;
  currentStop: ViewerStop;
}): ViewerMenuId {
  return editorTab === "wall" ? viewerMenuForStop(currentStop) : "design";
}

/**
 * LEVEL TWO OF THE HIGHLIGHT — the OPEN MENU: whether this entry is where you
 * actually are.
 *
 * Tommy: *"it opens a small drop-down menu that you can clearly see that Plan
 * View is highlighted in the drop-down menu."* A separate fact from the bar's
 * highlight and a separate control, so it is a separate function rather than an
 * expression inlined at the one call site — the same reason `isViewStopLive`
 * exists.
 *
 * A **stop** is current only while the wall subject is the one being edited: a
 * Floor editor on screen makes `Elevation: CD` a statement about somewhere you
 * are not, and marking it would be the same lie the bug note's context line
 * refuses to tell. A **subject** is current when it is the active tab. Stops
 * are compared by `viewerStopKey` and never by object identity, because
 * `currentViewerStop` is rebuilt every render.
 */
export function isCurrentDestination(
  destination: MenuDestination,
  { editorTab, currentStop }: { editorTab: EditorTab; currentStop: ViewerStop },
): boolean {
  if (destination.kind === "subject") return destination.subject === editorTab;
  return editorTab === "wall" && viewerStopKey(destination.stop) === viewerStopKey(currentStop);
}

/**
 * Why a menu is offering nothing, or `null` when it is offering something.
 *
 * ⚠ **THE BUTTON'S REASON HAS TO BE THE MENU'S REASON, AND IT WAS NOT.** The
 * `View` button said "The 3D views need a footprint — draw one on the plan
 * first" whenever it was empty, which is a lie in the reachable state where a
 * footprint IS drawn and the Walls branch is simply unchecked in the Panelizer.
 * A disabled control whose stated reason cannot be acted on is worse than one
 * with no reason at all: it sends the user to the canvas to do something they
 * have already done. So the reason is derived here, from the same inputs that
 * decide the emptiness, rather than written out at the call site as a guess.
 *
 * Returns a key rather than a sentence: the wording is presentation and lives
 * in `TopBar`, but which of the two truths applies is logic and is tested.
 */
export function viewerMenuEmptyReason(
  menu: ViewerMenuId,
  input: MenuGroupsInput,
): "no-footprint" | "walls-out-of-scope" | "nothing-in-scope" | null {
  if (viewerMenuGroups(menu, input).length > 0) return null;
  if (menu === "view") {
    if (!editorTabsInScope(input.enabledTabs).includes("wall")) return "walls-out-of-scope";
    return "no-footprint";
  }
  /* Design can only be empty if no subject at all is in scope, which page.tsx
     prevents. Named rather than left to fall through to the View wording. */
  return "nothing-in-scope";
}

/** Every editor tab is a design subject, and the two lists are checked against
 * each other rather than trusted to match. Exported for the test, which is the
 * only reader — a fifth tab that nobody added to `DESIGN_SUBJECT_ORDER` would
 * otherwise be a destination the merged menu silently cannot reach. */
export function designSubjectsCoverEveryEditorTab(): boolean {
  return (
    DESIGN_SUBJECT_ORDER.length === EDITOR_TAB_ORDER.length &&
    EDITOR_TAB_ORDER.every((tab) => DESIGN_SUBJECT_ORDER.includes(tab))
  );
}
