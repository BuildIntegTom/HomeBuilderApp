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

export interface CurrentViewLabelInput {
  /** The active editor tab — the same `editorTab` state the nav and the tab
   * dial render from. */
  editorTab: EditorTab;
  /** The single reader of the four view flags (`page.tsx`'s
   * `currentViewerStop`). */
  viewerStop: ViewerStop;
  /**
   * Whether the view dial is live — `editorTab === "wall" && footprint`,
   * exactly the condition that drives `ViewerDial`'s own `disabled` prop.
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
 */
export function currentViewLabel({ editorTab, viewerStop, viewerActive }: CurrentViewLabelInput): string {
  const tab = EDITOR_TAB_LABEL[editorTab];
  return viewerActive ? `${tab} — ${viewerStopLabel(viewerStop)}` : tab;
}
