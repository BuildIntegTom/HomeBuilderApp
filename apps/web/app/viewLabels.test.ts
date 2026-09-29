import { buildRectangleFootprint } from "@building-integrity/geometry";
import { describe, expect, it } from "vitest";
import { EDITOR_TAB_LABEL, EDITOR_TAB_ORDER } from "./editorTabs";
import { currentViewLabel, destinationLabel, isViewStopLive, viewerStopLabel } from "./viewLabels";

describe("viewerStopLabel", () => {
  it("labels the plan stop the way it has always been labelled", () => {
    expect(viewerStopLabel({ kind: "plan" })).toBe("2D Floor Plan");
  });

  it("names the wall in an elevation stop", () => {
    expect(viewerStopLabel({ kind: "elevation", wallId: "AB", label: "AB" })).toBe("Elevation: AB");
  });

  it("keeps Membranes as the user-facing word for the 3d-wraps stop", () => {
    // Tommy renamed "3D Wraps" to "Membranes" and the internal key was
    // deliberately left alone. Both halves are asserted here so a later
    // "tidy-up" of either one fails a test instead of shipping.
    expect(viewerStopLabel({ kind: "3d-wraps" })).toBe("Membranes");
  });

  it("labels the two other 3D stops", () => {
    expect(viewerStopLabel({ kind: "3d-framed" })).toBe("3D Framed");
    expect(viewerStopLabel({ kind: "3d-boxes" })).toBe("3D Boxes");
  });
});

describe("isViewStopLive", () => {
  const footprint = buildRectangleFootprint(24, 16);

  it("is live only on the Wall tab, and only once a footprint exists", () => {
    expect(isViewStopLive({ editorTab: "wall", footprint })).toBe(true);
    expect(isViewStopLive({ editorTab: "wall", footprint: null })).toBe(false);
    expect(isViewStopLive({ editorTab: "roof", footprint })).toBe(false);
    expect(isViewStopLive({ editorTab: "roof", footprint: null })).toBe(false);
  });

  it("treats an absent footprint the same however it is absent", () => {
    expect(isViewStopLive({ editorTab: "wall", footprint: undefined })).toBe(false);
  });

  it("agrees with BOTH expressions it replaced, across the whole tab x footprint matrix", () => {
    // The two sites read the same condition in opposite polarities, ~900
    // lines apart in page.tsx:
    //
    //   ViewerDial:          disabled={editorTab !== "wall" || !footprint}
    //   bug note's context:  viewerActive: editorTab === "wall" && Boolean(footprint)
    //
    // They were exact complements when this helper replaced them. This is
    // the assertion that says so in every case rather than by De Morgan in
    // a comment — and it is what will catch U1's two new menus drifting
    // away from the dial, since all four call the helper.
    const dialDisabledBefore = (editorTab: (typeof EDITOR_TAB_ORDER)[number], fp: object | null) =>
      editorTab !== "wall" || !fp;
    const viewerActiveBefore = (editorTab: (typeof EDITOR_TAB_ORDER)[number], fp: object | null) =>
      editorTab === "wall" && Boolean(fp);

    for (const editorTab of EDITOR_TAB_ORDER) {
      for (const fp of [footprint, null]) {
        const live = isViewStopLive({ editorTab, footprint: fp });
        expect(live).toBe(viewerActiveBefore(editorTab, fp));
        expect(!live).toBe(dialDisabledBefore(editorTab, fp));
      }
    }
  });

  it("covers all four tabs, so a fifth tab cannot slip past the matrix above", () => {
    expect(EDITOR_TAB_ORDER).toHaveLength(4);
  });
});

describe("currentViewLabel", () => {
  it("names the tab and the view while a view stop is driving the canvas", () => {
    expect(
      currentViewLabel({ editorTab: "wall", viewerStop: { kind: "plan" }, viewerActive: true }),
    ).toBe("Wall — 2D Floor Plan");
  });

  it("names an elevation the way the menu does", () => {
    expect(
      currentViewLabel({
        editorTab: "wall",
        viewerStop: { kind: "elevation", wallId: "CD", label: "CD" },
        viewerActive: true,
      }),
    ).toBe("Wall — Elevation: CD");
  });

  it("names Membranes, not 3D Wraps", () => {
    expect(
      currentViewLabel({ editorTab: "wall", viewerStop: { kind: "3d-wraps" }, viewerActive: true }),
    ).toBe("Wall — Membranes");
  });

  it("names only the tab on Roof, where no view stop is on screen", () => {
    // The stop is still whatever it last was; stating it here would tell
    // Tommy the reporter was on 3D Boxes when the screen showed roof tools.
    expect(
      currentViewLabel({ editorTab: "roof", viewerStop: { kind: "3d-boxes" }, viewerActive: false }),
    ).toBe("Roof");
  });

  it("names only the tab on Wall before a footprint is drawn", () => {
    expect(
      currentViewLabel({ editorTab: "wall", viewerStop: { kind: "plan" }, viewerActive: false }),
    ).toBe("Wall");
  });

  it("uses the editor tab labels rather than its own words", () => {
    expect(currentViewLabel({ editorTab: "floor", viewerStop: { kind: "plan" }, viewerActive: false })).toBe("Floor");
    expect(
      currentViewLabel({ editorTab: "foundation", viewerStop: { kind: "plan" }, viewerActive: false }),
    ).toBe("Foundation");
  });
});

describe("destinationLabel", () => {
  it("labels a view stop with the app's own name for it", () => {
    expect(destinationLabel({ kind: "stop", stop: { kind: "plan" } })).toBe("2D Floor Plan");
    expect(destinationLabel({ kind: "stop", stop: { kind: "3d-wraps" } })).toBe("Membranes");
    expect(destinationLabel({ kind: "stop", stop: { kind: "elevation", wallId: "CD", label: "CD" } })).toBe(
      "Elevation: CD",
    );
  });

  it("labels a design subject with the editor tab's own label, introducing no new word", () => {
    // The merge is exactly where a synonym for an existing thing would slip in
    // unnoticed, so both halves come from a definition that already existed.
    expect(destinationLabel({ kind: "subject", subject: "floor" })).toBe(EDITOR_TAB_LABEL.floor);
    expect(destinationLabel({ kind: "subject", subject: "roof" })).toBe(EDITOR_TAB_LABEL.roof);
    expect(destinationLabel({ kind: "subject", subject: "foundation" })).toBe(EDITOR_TAB_LABEL.foundation);
  });
});
