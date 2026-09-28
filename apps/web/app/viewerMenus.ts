import type { ViewerStop } from "./ViewerDial";

/**
 * Which of the two top-bar view menus owns which of the dial's stops — one
 * definition, shared by both presentations, in the shape `editorTabs.ts`
 * already uses for the Wall/Foundation/Floor/Roof tabs.
 *
 * **U1 splits `ViewerDial`'s single cycle into `Design` and `View` on the top
 * bar at 1200px and up, while the dial itself stays as the below-breakpoint
 * form.** That is two presentations of one thing, and the reason this module
 * exists rather than the split being written inline in `TopBar.tsx` is that
 * the bar and the dial must never be able to disagree about which stops exist
 * or what order they come in.
 *
 * **What this module deliberately does NOT do: write anything.** The four
 * flags behind a stop (`viewMode`, `simplified3D`, `showWraps`,
 * `elevationViewWallId`) encode five stop kinds between them, and
 * `page.tsx`'s `handleViewerStopChange` is the only function that sets them
 * consistently — `currentViewerStop` is the only thing that reads them back.
 * Both menus call that same one function with a stop out of that same one
 * list. **Two menus each setting their own subset is exactly how `showWraps`
 * ends up true on a plan view**, and it is the single thing the U1 plan names
 * as most likely to be got wrong. Splitting the PRESENTATION is safe; there
 * is no second copy of the state machine anywhere in here.
 *
 * The `ViewerStop` import is type-only and therefore erased, so this module
 * has no runtime dependency on `ViewerDial` (and no import cycle — the dial
 * imports `viewerStopKey` back from here). Same arrangement `viewLabels.ts`
 * already uses, and it is what lets all of this be unit-tested without
 * mounting a component.
 */
export type ViewerMenuId = "design" | "view";

/** Left to right on the bar, matching Tommy's own list: "Design, View, …". */
export const VIEWER_MENU_ORDER: readonly ViewerMenuId[] = ["design", "view"];

/** The bare word each menu shows when it is not the owner. Title Case; the
 * owner's ALL-CAPS caption is a `text-transform`, not a second string, so
 * there is only ever one spelling of each word. */
export const VIEWER_MENU_LABEL: Record<ViewerMenuId, string> = {
  design: "Design",
  view: "View",
};

/**
 * A stop's identity, independent of the object it arrived in.
 *
 * `viewerStops` is rebuilt by a `useMemo` whenever the footprint changes and
 * `currentViewerStop` is constructed fresh on every render, so two stops that
 * mean the same view are never the same object. This is how the dial finds
 * its index and how each menu marks its current item; it lives here so both
 * use the same answer. (It was `ViewerDial`'s own private `stopKey`.)
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
 * The stops one menu offers, **in the dial's own order**.
 *
 * The order is Tommy's and is recorded in `ViewerDial`'s doc comment: *"cycle
 * the wall view options… starting at the top and going clockwise, and the
 * wheel moves onto 3D views"* — plan, then one elevation per wall in
 * footprint order, then the three 3D modes. Filtering preserves it, which is
 * why Design reads Plan first and View reads Framed → Boxes → Membranes.
 * Deriving both menus from the caller's one `viewerStops` array (rather than
 * from a list typed out here) is what guarantees the two menus together are
 * exactly the dial's cycle, no more and no less — including one entry per
 * wall for a footprint with any number of walls.
 */
export function viewerStopsForMenu(stops: readonly ViewerStop[], menu: ViewerMenuId): ViewerStop[] {
  return stops.filter((stop) => viewerMenuForStop(stop) === menu);
}

/**
 * Which menu, if either, currently owns the editor surface — and therefore
 * which one renders the two-part `LABEL` + `Value` treatment while the other
 * renders its bare word.
 *
 * **Derived, never stored.** The plan states the rule as *"exactly one of
 * Design / View / Summary / Print owns the editor surface at any moment…
 * ownership is derived, never stored twice"*. There is no `owner` state
 * anywhere; this reads `currentViewerStop`, which is itself the single reader
 * of the four flags.
 *
 * `live` is `isViewerDialLive({ editorTab, footprint })` and nothing else.
 * When the dial is not driving the canvas — no footprint, or any tab but Wall
 * — **neither menu owns**, and both show their bare word. That mirrors the
 * dial, which is `disabled` in exactly those cases, and it mirrors the Report
 * Bug note's context line, which refuses to name a stop it is not on for the
 * same reason: naming `3D Boxes` while the Roof tab's tools are on screen is
 * a statement about where the user is, and it would be false.
 */
export function viewerMenuOwner(currentStop: ViewerStop, live: boolean): ViewerMenuId | null {
  return live ? viewerMenuForStop(currentStop) : null;
}
