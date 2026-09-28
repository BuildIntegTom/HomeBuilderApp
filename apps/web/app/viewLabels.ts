import type { Footprint } from "@building-integrity/geometry";

import { EDITOR_TAB_LABEL, type EditorTab } from "./editorTabs";
import type { ViewerStop } from "./ViewerDial";

/**
 * The app's own name for the view you are looking at, in one place.
 *
 * `viewerStopLabel` is `ViewerDial`'s own label function, moved here so the
 * dial and anything else that needs to NAME the current view read the same
 * strings rather than re-typing them — the same one-definition-two-readers
 * rule `editorTabs.ts` already enforces for the tab labels. `ViewerDial`
 * imports it back and is still the only thing that renders the dial.
 *
 * `"Membranes"` (not `"3D Wraps"`) and the internal `"3d-wraps"` stop kind
 * are both deliberate and recorded in `ViewerDial`'s doc comment: the
 * user-facing word was renamed at Tommy's request, the key was not. Do not
 * "tidy" either half.
 *
 * The type import is type-only and therefore erased, so this module has no
 * runtime dependency on `ViewerDial` (and no import cycle) — which is also
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

export interface ViewerDialLiveInput {
  /** The active editor tab — the same `editorTab` state the nav and the tab
   * dial render from. */
  editorTab: EditorTab;
  /** `page.tsx`'s one `footprint` state. Only its presence is read; no field
   * of it is touched, so a wall-less or a many-walled footprint answers the
   * same. */
  footprint: Footprint | null | undefined;
}

/**
 * Whether the view dial is actually driving the canvas — i.e. whether there
 * is a view for anything to NAME.
 *
 * **One name for a condition that was written twice, in opposite polarities,
 * ~900 lines apart:** `ViewerDial`'s own `disabled={editorTab !== "wall" || !footprint}`
 * and the bug note's `viewerActive: editorTab === "wall" && Boolean(footprint)`.
 * They were exact complements, and both were covered, so this is not a bug
 * fix — it is a seam closed before **U1 needs the same answer a third and a
 * fourth time**, once for each of the Design and View menus. The plan's own
 * recommendation for those menus is that they *"mirror today's behaviour
 * exactly, with the reason in their `title`"*, which is a far easier promise
 * to keep against one named predicate than against two hand-written
 * expressions that have to stay De Morgan duals of each other.
 *
 * **The polarity here is the POSITIVE one** (`live`, not `disabled`) because
 * that is the question every reader actually asks; the dial's `disabled` prop
 * negates it at the one site that wants the other sense.
 *
 * Input is a plain object rather than component props on purpose — the same
 * reason `CurrentViewLabelInput` is one — so U1's two-menu form can call it
 * unchanged from a different component.
 */
export function isViewerDialLive({ editorTab, footprint }: ViewerDialLiveInput): boolean {
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
   * Whether the view dial is live. **Supply it from `isViewerDialLive` above**
   * — that is the one definition of this condition, and it is the same one
   * `ViewerDial`'s `disabled` prop negates.
   *
   * When it is false the dial is disabled and the stop it would report is
   * not what is on screen (the Roof tab shows roof tools, not `3D Boxes`),
   * so the view half is left off rather than stated wrongly. A bug report
   * naming a view the reporter was not on is worse than one naming only the
   * tab.
   */
  viewerActive: boolean;
}

/**
 * One short line naming the current editor surface, as the app itself labels
 * it: the editor tab, and — only when the view dial is actually driving the
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
