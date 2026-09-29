import type { Footprint } from "@building-integrity/geometry";

import { EDITOR_TAB_LABEL, type EditorTab } from "./editorTabs";
import type { MenuDestination, ViewerStop } from "./viewerMenus";

/**
 * The app's own name for the view you are looking at, in one place.
 *
 * `viewerStopLabel` was `ViewerDial`'s own label function, moved here so that
 * everything which needs to NAME the current view reads the same strings
 * rather than re-typing them — the same one-definition-two-readers rule
 * `editorTabs.ts` already enforces for the tab labels. Its readers now are the
 * top bar's Design and View menus and the Report Bug note's context line; the
 * dial itself was removed on 2026-09-28 at Tommy's instruction.
 *
 * `"Membranes"` (not `"3D Wraps"`) and the internal `"3d-wraps"` stop kind
 * are both deliberate and recorded on the type in `viewerMenus.ts`: the
 * user-facing word was renamed at Tommy's request, the key was not. Do not
 * "tidy" either half. `2D Floor Plan` → `Plan View` is an open question for
 * Tommy and is deliberately NOT answered here.
 *
 * The type import is type-only and therefore erased, so this module has no
 * runtime dependency on `viewerMenus` (and no import cycle) — which is also
 * what lets it be unit-tested without mounting a component.
 */
export function viewerStopLabel(stop: ViewerStop): string {
  switch (stop.kind) {
    case "plan":
      return "2D Floor Plan";
    case "elevation":
      return `Elevation: ${stop.label}`;
    case "3d-framed":
      return "3D Framed";
    case "3d-boxes":
      return "3D Boxes";
    case "3d-wraps":
      return "Membranes";
  }
}

/**
 * What one entry in the Design or View menu reads.
 *
 * Both halves come from a single definition that already existed — the view
 * stops from `viewerStopLabel` above, the design subjects from
 * `EDITOR_TAB_LABEL`, which is the same string the removed nav tab showed and
 * the tab dial still shows. **No new user-facing word is introduced by the
 * merge**, which matters because a merged menu is exactly where a new synonym
 * for an existing thing would slip in unnoticed.
 */
export function destinationLabel(destination: MenuDestination): string {
  return destination.kind === "stop" ? viewerStopLabel(destination.stop) : EDITOR_TAB_LABEL[destination.subject];
}

export interface ViewStopLiveInput {
  /** The active editor tab — the same `editorTab` state the nav and the tab
   * dial render from. */
  editorTab: EditorTab;
  /** `page.tsx`'s one `footprint` state. Only its presence is read; no field
   * of it is touched, so a wall-less or a many-walled footprint answers the
   * same. */
  footprint: Footprint | null | undefined;
}

/**
 * Whether a view stop is actually driving the canvas — i.e. whether there is
 * a view for anything to NAME or to highlight.
 *
 * ⚠ **RENAMED FROM `isViewerDialLive` on 2026-09-28, when the dial it was
 * named after was removed.** The property that made it worth having is
 * unchanged and is the reason the rename was not skipped: **one definition,
 * every reader.** The condition had been written out twice before this
 * existed, in opposite polarities, ~900 lines apart in `page.tsx` — the dial's
 * `disabled={editorTab !== "wall" || !footprint}` and the bug note's
 * `viewerActive: editorTab === "wall" && Boolean(footprint)`. The dial's copy
 * is gone with the dial; the readers now are the bar's `Design`/`View` buttons
 * (their `disabled`, and both levels of highlight through `viewerMenuOwner`
 * and `isCurrentViewerStop`) and the Report Bug note's context line. A name
 * that still said "dial" would have been a false description of the one thing
 * they all agree through.
 *
 * **The polarity is the POSITIVE one** (`live`, not `disabled`) because that is
 * the question every reader actually asks; the one site that wants the other
 * sense negates it there.
 *
 * Input is a plain object rather than component props on purpose — the same
 * reason `CurrentViewLabelInput` is one — so `TopBar` can call it and be
 * guaranteed the same answer as `page.tsx`. **Keep passing `footprint`, not a
 * ready-made boolean**: a caller handed a boolean can be handed a different
 * answer than every other caller, which is the seam this closed.
 */
export function isViewStopLive({ editorTab, footprint }: ViewStopLiveInput): boolean {
  return editorTab === "wall" && Boolean(footprint);
}

export interface CurrentViewLabelInput {
  /** The active editor tab — the same `editorTab` state the nav and the tab
   * dial render from. */
  editorTab: EditorTab;
  /** The single reader of the four view flags (`page.tsx`'s
   * `currentViewerStop`). */
  viewerStop: ViewerStop;
  /**
   * Whether a view stop is live. **Supply it from `isViewStopLive` above** —
   * that is the one definition of this condition, and it is the same one the
   * bar's Design and View buttons are disabled by.
   *
   * When it is false the stop `currentViewerStop` would report is not what is
   * on screen (the Roof tab shows roof tools, not `3D Boxes`), so the view
   * half is left off rather than stated wrongly. A bug report naming a view
   * the reporter was not on is worse than one naming only the tab.
   */
  viewerActive: boolean;
}

/**
 * One short line naming the current editor surface, as the app itself labels
 * it: the editor tab, and — only when a view stop is actually driving the
 * canvas — the view stop.
 *
 * Used by the Report Bug note so a report Tommy receives says where the
 * reporter was (spec, "the page context must be honest, and it is not
 * telemetry"). **Nothing else goes in it**: no version string, no user
 * agent, no viewport figures, no project state.
 *
 * **For U4/U5:** §9a says this line must also name `Summary` and `Print`
 * once those surfaces exist. When they do, **extend `CurrentViewLabelInput`**
 * — do not add a parallel branch at the call site. The whole point of this
 * function is that there is one place that decides what the current surface
 * is called.
 */
export function currentViewLabel({ editorTab, viewerStop, viewerActive }: CurrentViewLabelInput): string {
  const tab = EDITOR_TAB_LABEL[editorTab];
  return viewerActive ? `${tab} — ${viewerStopLabel(viewerStop)}` : tab;
}
