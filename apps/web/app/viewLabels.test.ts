import { describe, expect, it } from "vitest";
import { currentViewLabel, viewerStopLabel } from "./viewLabels";

describe("viewerStopLabel", () => {
  it("labels the plan stop the way the dial always has", () => {
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

describe("currentViewLabel", () => {
  it("names the tab and the view while the view dial is driving the canvas", () => {
    expect(
      currentViewLabel({ editorTab: "wall", viewerStop: { kind: "plan" }, viewerActive: true }),
    ).toBe("Wall — 2D Floor Plan");
  });

  it("names an elevation the way the dial does", () => {
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

  it("names only the tab on Roof, where the dial is disabled", () => {
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
