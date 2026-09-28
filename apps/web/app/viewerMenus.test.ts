import { describe, expect, it } from "vitest";
import type { ViewerStop } from "./ViewerDial";
import { viewerStopLabel } from "./viewLabels";
import {
  VIEWER_MENU_LABEL,
  VIEWER_MENU_ORDER,
  viewerMenuForStop,
  viewerMenuOwner,
  viewerStopKey,
  viewerStopsForMenu,
} from "./viewerMenus";

/** The cycle `page.tsx` builds for a four-wall footprint: plan, one elevation
 * per wall in footprint order, then the three 3D modes. Written the way
 * `viewerStops` builds it rather than hand-ordered, so the order under test is
 * the app's order. */
const stopsFor = (wallIds: string[]): ViewerStop[] => [
  { kind: "plan" },
  ...wallIds.map((id) => ({ kind: "elevation" as const, wallId: id, label: id })),
  { kind: "3d-framed" },
  { kind: "3d-boxes" },
  { kind: "3d-wraps" },
];

const RECTANGLE = stopsFor(["AB", "BC", "CD", "DA"]);

describe("viewerStopKey", () => {
  it("identifies a stop by meaning, not by object identity", () => {
    // `viewerStops` is rebuilt by a useMemo and `currentViewerStop` is
    // constructed fresh every render, so two stops that mean the same view are
    // never the same object. Both the dial's index and each menu's "current"
    // marker depend on this.
    expect(viewerStopKey({ kind: "elevation", wallId: "AB", label: "AB" })).toBe(
      viewerStopKey({ kind: "elevation", wallId: "AB", label: "AB" }),
    );
  });

  it("tells two walls' elevations apart", () => {
    expect(viewerStopKey({ kind: "elevation", wallId: "AB", label: "AB" })).not.toBe(
      viewerStopKey({ kind: "elevation", wallId: "BC", label: "BC" }),
    );
  });

  it("gives every stop in a real cycle a distinct key", () => {
    const keys = RECTANGLE.map(viewerStopKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("viewerMenuForStop", () => {
  it("puts the drawing surfaces under Design and the 3D modes under View", () => {
    // Tommy: "View, where the 3D box, 3d framed, and membranes editors/viewers
    // live."
    expect(viewerMenuForStop({ kind: "plan" })).toBe("design");
    expect(viewerMenuForStop({ kind: "elevation", wallId: "AB", label: "AB" })).toBe("design");
    expect(viewerMenuForStop({ kind: "3d-framed" })).toBe("view");
    expect(viewerMenuForStop({ kind: "3d-boxes" })).toBe("view");
    expect(viewerMenuForStop({ kind: "3d-wraps" })).toBe("view");
  });
});

describe("viewerStopsForMenu", () => {
  it("splits the cycle in two with nothing lost and nothing duplicated", () => {
    // The central requirement of the whole reorganisation is "let's make sure
    // nothing is lost", and for this stage that is a countable claim: the two
    // menus together must be exactly the dial's cycle.
    const design = viewerStopsForMenu(RECTANGLE, "design");
    const view = viewerStopsForMenu(RECTANGLE, "view");
    expect([...design, ...view]).toEqual(RECTANGLE);
  });

  it("keeps Tommy's order inside each menu", () => {
    // "cycle the wall view options... starting at the top and going clockwise,
    // and the wheel moves onto 3D views" — so Design reads Plan first and then
    // the walls in footprint order, and View reads Framed, Boxes, Membranes.
    expect(viewerStopsForMenu(RECTANGLE, "design").map(viewerStopLabel)).toEqual([
      "2D Floor Plan",
      "Elevation: AB",
      "Elevation: BC",
      "Elevation: CD",
      "Elevation: DA",
    ]);
    expect(viewerStopsForMenu(RECTANGLE, "view").map(viewerStopLabel)).toEqual(["3D Framed", "3D Boxes", "Membranes"]);
  });

  it("gives Design one entry per wall, however many walls there are", () => {
    // An octagon is the plan's own edge case. Eight elevations, and the 3D
    // menu is unchanged by the shape of the building.
    const octagon = stopsFor(["AB", "BC", "CD", "DE", "EF", "FG", "GH", "HA"]);
    expect(viewerStopsForMenu(octagon, "design")).toHaveLength(9);
    expect(viewerStopsForMenu(octagon, "view")).toHaveLength(3);
  });

  it("still offers the 3D modes when there is no footprint at all", () => {
    // With no footprint `viewerStops` has no elevation entries. Design is left
    // with just the plan stop, View is untouched, and neither menu is empty —
    // which is what stops the split from inventing an empty-state nobody
    // designed. (Both menus are disabled in that case; see viewerMenuOwner.)
    const bare = stopsFor([]);
    expect(viewerStopsForMenu(bare, "design").map(viewerStopLabel)).toEqual(["2D Floor Plan"]);
    expect(viewerStopsForMenu(bare, "view")).toHaveLength(3);
  });

  it("is a pure filter — it never reorders, rewrites or reconstructs a stop", () => {
    // The menus must hand `handleViewerStopChange` the very stop objects the
    // caller built, so an elevation arrives with its real wallId rather than
    // one rebuilt from a label. Identity, not deep equality, is the assertion.
    const design = viewerStopsForMenu(RECTANGLE, "design");
    expect(design[1]).toBe(RECTANGLE[1]);
  });
});

describe("viewerMenuOwner", () => {
  it("gives ownership to the menu the current stop belongs to", () => {
    expect(viewerMenuOwner({ kind: "plan" }, true)).toBe("design");
    expect(viewerMenuOwner({ kind: "elevation", wallId: "AB", label: "AB" }, true)).toBe("design");
    expect(viewerMenuOwner({ kind: "3d-framed" }, true)).toBe("view");
    expect(viewerMenuOwner({ kind: "3d-wraps" }, true)).toBe("view");
  });

  it("gives ownership to NEITHER menu when the dial is not driving the canvas", () => {
    // On the Roof tab, or before a footprint exists, the dial is disabled and
    // what is on screen is not the stop `currentViewerStop` would report. The
    // bar must not claim otherwise — the same rule the Report Bug note's
    // context line already follows.
    for (const stop of RECTANGLE) {
      expect(viewerMenuOwner(stop, false)).toBeNull();
    }
  });

  it("never lets both menus own at once", () => {
    // The owner rule stated as a property rather than as four examples: for
    // every stop in a real cycle, exactly one menu owns, and it is the menu
    // that stop is filed under.
    for (const stop of RECTANGLE) {
      const owner = viewerMenuOwner(stop, true);
      expect(owner).toBe(viewerMenuForStop(stop));
      expect(VIEWER_MENU_ORDER.filter((menu) => menu === owner)).toHaveLength(1);
    }
  });
});

describe("the menu words", () => {
  it("are Tommy's two words, in his order", () => {
    expect(VIEWER_MENU_ORDER.map((menu) => VIEWER_MENU_LABEL[menu])).toEqual(["Design", "View"]);
  });

  it("has a label for every menu id, so neither can render blank", () => {
    for (const menu of VIEWER_MENU_ORDER) {
      expect(VIEWER_MENU_LABEL[menu]).toBeTruthy();
    }
  });
});
