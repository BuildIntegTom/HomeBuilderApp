import { buildRectangleFootprint } from "@building-integrity/geometry";
import { describe, expect, it } from "vitest";
import { EDITOR_TAB_ORDER, type EditorTab } from "./editorTabs";
import { destinationLabel, viewerStopLabel } from "./viewLabels";
import {
  DESIGN_SUBJECT_ORDER,
  viewerMenuEmptyReason,
  VIEWER_MENU_LABEL,
  VIEWER_MENU_ORDER,
  destinationKey,
  designSubjectsCoverEveryEditorTab,
  isCurrentDestination,
  viewerMenuForStop,
  viewerMenuGroups,
  viewerMenuOwner,
  viewerStopKey,
  viewerStopsForMenu,
  type MenuDestination,
  type ViewerStop,
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
const FOOTPRINT = buildRectangleFootprint(24, 16);
/** Every subject checked on in the Panelizer — the widest the merged menu ever
 * gets, and the case the grouping and the order are worth testing on. */
const ALL_TABS: EditorTab[] = ["wall", "foundation", "floor", "roof"];

describe("viewerStopKey", () => {
  it("identifies a stop by meaning, not by object identity", () => {
    // `viewerStops` is rebuilt by a useMemo and `currentViewerStop` is
    // constructed fresh every render, so two stops that mean the same view are
    // never the same object. Both menus' "current" marker depends on this.
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
    // menus together must be exactly the whole cycle.
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

  it("still offers the 3D modes when there is no footprint at all", () => {
    // With no footprint `viewerStops` has no elevation entries. Design is left
    // with just the plan stop and View is untouched — the gating of View on a
    // footprint happens in `viewerMenuGroups`, not here, and is tested there.
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

describe("viewerMenuOwner — LEVEL ONE of the highlight, the bar", () => {
  it("gives ownership to the menu the current stop belongs to, on the wall subject", () => {
    expect(viewerMenuOwner({ editorTab: "wall", currentStop: { kind: "plan" } })).toBe("design");
    expect(viewerMenuOwner({ editorTab: "wall", currentStop: { kind: "elevation", wallId: "AB", label: "AB" } })).toBe(
      "design",
    );
    expect(viewerMenuOwner({ editorTab: "wall", currentStop: { kind: "3d-framed" } })).toBe("view");
    expect(viewerMenuOwner({ editorTab: "wall", currentStop: { kind: "3d-wraps" } })).toBe("view");
  });

  it("gives ownership to Design on every other subject, whatever the stop last was", () => {
    // The merged menu holds the Floor, Roof and Foundation editors, so editing
    // one of them IS designing. A stale 3D stop must not leave View looking
    // like the surface you are on — the same lie the bug note's context line
    // refuses to tell.
    for (const editorTab of ["foundation", "floor", "roof"] as const) {
      expect(viewerMenuOwner({ editorTab, currentStop: { kind: "3d-boxes" } })).toBe("design");
      expect(viewerMenuOwner({ editorTab, currentStop: { kind: "plan" } })).toBe("design");
    }
  });

  it("highlights Design on a cold load, before any footprint exists", () => {
    // page.tsx's defaults are editorTab "wall" and viewMode "plan", so this is
    // literally the launch state. Tommy: "When you open the app it'll
    // automatically be in planview editor. This will make the design button
    // highlighted." The rule this replaced required a LIVE view stop, which
    // needs a footprint — so on launch neither menu was highlighted and that
    // sentence was false. Ownership deliberately does not read the footprint.
    expect(viewerMenuOwner({ editorTab: "wall", currentStop: { kind: "plan" } })).toBe("design");
  });

  it("always names exactly one owner, for every tab x stop pair", () => {
    for (const editorTab of EDITOR_TAB_ORDER) {
      for (const stop of RECTANGLE) {
        const owner = viewerMenuOwner({ editorTab, currentStop: stop });
        expect(VIEWER_MENU_ORDER.filter((menu) => menu === owner)).toHaveLength(1);
      }
    }
  });
});

describe("isCurrentDestination — LEVEL TWO of the highlight, the open menu", () => {
  const current: ViewerStop = { kind: "elevation", wallId: "CD", label: "CD" };

  it("marks the stop you are on, comparing keys and not object identity", () => {
    const sameMeaningDifferentObject: MenuDestination = {
      kind: "stop",
      stop: { kind: "elevation", wallId: "CD", label: "CD" },
    };
    expect(isCurrentDestination(sameMeaningDifferentObject, { editorTab: "wall", currentStop: current })).toBe(true);
    expect(
      isCurrentDestination(
        { kind: "stop", stop: { kind: "elevation", wallId: "AB", label: "AB" } },
        { editorTab: "wall", currentStop: current },
      ),
    ).toBe(false);
  });

  it("marks NO stop while another subject is being edited", () => {
    for (const editorTab of ["foundation", "floor", "roof"] as const) {
      for (const stop of RECTANGLE) {
        expect(isCurrentDestination({ kind: "stop", stop }, { editorTab, currentStop: current })).toBe(false);
      }
    }
  });

  it("marks the subject you are on, and only that one", () => {
    expect(isCurrentDestination({ kind: "subject", subject: "roof" }, { editorTab: "roof", currentStop: current })).toBe(
      true,
    );
    expect(
      isCurrentDestination({ kind: "subject", subject: "floor" }, { editorTab: "roof", currentStop: current }),
    ).toBe(false);
    expect(
      isCurrentDestination({ kind: "subject", subject: "floor" }, { editorTab: "wall", currentStop: current }),
    ).toBe(false);
  });

  it("marks at most one destination in the Design menu, and exactly one whenever Design owns", () => {
    // The property the two levels rest on. Two marks would be a lie about where
    // you are; none, while Design is the highlighted button, would leave the
    // bare bar word with no way at all to say where you are.
    for (const editorTab of EDITOR_TAB_ORDER) {
      for (const currentStop of RECTANGLE) {
        const groups = viewerMenuGroups("design", { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
        const marked = groups
          .flatMap((group) => group.destinations)
          .filter((destination) => isCurrentDestination(destination, { editorTab, currentStop }));
        const designOwns = viewerMenuOwner({ editorTab, currentStop }) === "design";
        expect(marked).toHaveLength(designOwns ? 1 : 0);
      }
    }
  });

  it("marks exactly one destination in the View menu whenever View owns", () => {
    for (const currentStop of viewerStopsForMenu(RECTANGLE, "view")) {
      const groups = viewerMenuGroups("view", { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
      const marked = groups
        .flatMap((group) => group.destinations)
        .filter((destination) => isCurrentDestination(destination, { editorTab: "wall", currentStop }));
      expect(marked).toHaveLength(1);
    }
  });
});

describe("viewerMenuGroups — what the merged menu offers", () => {
  it("groups Design by subject, in the order Tommy gave twice on 2026-09-28", () => {
    const groups = viewerMenuGroups("design", { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
    expect(groups.map((g) => g.subject)).toEqual(["wall", "floor", "roof", "foundation"]);
  });

  it("puts the plan and every wall elevation under the wall subject, in footprint order", () => {
    const [wall] = viewerMenuGroups("design", { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
    expect(wall!.destinations.map(destinationLabel)).toEqual([
      "2D Floor Plan",
      "Elevation: AB",
      "Elevation: BC",
      "Elevation: CD",
      "Elevation: DA",
    ]);
  });

  it("heads a group only when it holds more than one destination", () => {
    const groups = viewerMenuGroups("design", { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
    expect(groups[0]!.heading).toBe("Wall");
    expect(groups.slice(1).map((g) => g.heading)).toEqual([null, null, null]);
    // With no footprint the wall subject is only the plan, so it loses its
    // heading too rather than heading a list of one.
    const bare = viewerMenuGroups("design", { stops: stopsFor([]), enabledTabs: ALL_TABS, footprint: null });
    expect(bare[0]!.heading).toBeNull();
    expect(bare[0]!.destinations).toHaveLength(1);
  });

  it("hides a subject that is out of the scope of work, rather than showing it inert", () => {
    // The scope has one source of truth — page.tsx's `enabledEditorTabs`,
    // derived from the Panelizer's keyhole checkboxes — and this reads it.
    // Smearforn Stage 0 defaults floor and foundation OFF, which is this case.
    const groups = viewerMenuGroups("design", {
      stops: RECTANGLE,
      enabledTabs: ["wall", "roof"],
      footprint: FOOTPRINT,
    });
    expect(groups.map((g) => g.subject)).toEqual(["wall", "roof"]);
  });

  it("offers the three representations under View, with no subject heading", () => {
    const groups = viewerMenuGroups("view", { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.subject).toBeNull();
    expect(groups[0]!.heading).toBeNull();
    expect(groups[0]!.destinations.map(destinationLabel)).toEqual(["3D Framed", "3D Boxes", "Membranes"]);
  });

  it("leaves View empty — so the bar disables it — until there is a building to view", () => {
    // What the removed dial did (`disabled` with no footprint), kept rather
    // than reinvented: a 3D view of nothing is not a destination.
    expect(viewerMenuGroups("view", { stops: stopsFor([]), enabledTabs: ALL_TABS, footprint: null })).toEqual([]);
    expect(viewerMenuGroups("view", { stops: RECTANGLE, enabledTabs: ["floor"], footprint: FOOTPRINT })).toEqual([]);
  });

  it("reads the scope through editorTabsInScope, so an empty list means what it means everywhere else", () => {
    // The two differ in exactly one case, and it is the case this module treats
    // as meaningful: an EMPTY enabled list. `editorTabsInScope` falls back to
    // every tab; a raw `includes` would offer nothing and disable Design, which
    // is the state that means "there is nowhere to go". page.tsx cannot produce
    // an empty list (the last scope branch refuses to be unchecked), so this is
    // a seam being kept closed rather than a bug being fixed.
    const groups = viewerMenuGroups("design", { stops: RECTANGLE, enabledTabs: [], footprint: FOOTPRINT });
    expect(groups.map((g) => g.subject)).toEqual([...DESIGN_SUBJECT_ORDER]);
  });

  it("never leaves Design empty while any scope branch is checked", () => {
    for (const only of ALL_TABS) {
      const groups = viewerMenuGroups("design", { stops: RECTANGLE, enabledTabs: [only], footprint: FOOTPRINT });
      expect(groups.flatMap((g) => g.destinations).length).toBeGreaterThan(0);
    }
  });

  it("together the two menus reach every stop, once, and every subject in scope", () => {
    // "Let's make sure nothing is lost", as a countable claim — and it matters
    // more than it did: with the view dial and the four bar tabs both gone, a
    // destination missing here is a destination nobody can reach at all.
    const design = viewerMenuGroups("design", { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
    const view = viewerMenuGroups("view", { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
    const all = [...design, ...view].flatMap((g) => g.destinations);
    const stops = all.flatMap((d) => (d.kind === "stop" ? [d.stop] : []));
    expect(stops).toEqual(RECTANGLE);
    const subjects = all.flatMap((d) => (d.kind === "subject" ? [d.subject] : []));
    expect(subjects).toEqual(["floor", "roof", "foundation"]);
    expect(new Set(all.map(destinationKey)).size).toBe(all.length);
  });

  it("gives Design one entry per wall, however many walls there are", () => {
    // An octagon is the plan's own edge case: nine wall destinations, and the
    // View menu unchanged by the shape of the building.
    const octagon = stopsFor(["AB", "BC", "CD", "DE", "EF", "FG", "GH", "HA"]);
    const [wall] = viewerMenuGroups("design", { stops: octagon, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
    expect(wall!.destinations).toHaveLength(9);
  });

  it("is a pure filter — the stop objects handed back are the caller's own", () => {
    const [wall] = viewerMenuGroups("design", { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT });
    const second = wall!.destinations[1]!;
    expect(second.kind === "stop" && second.stop).toBe(RECTANGLE[1]);
  });
});

describe("viewerMenuEmptyReason — why a disabled button is disabled", () => {
  it("is null whenever the menu has anywhere to go", () => {
    const input = { stops: RECTANGLE, enabledTabs: ALL_TABS, footprint: FOOTPRINT };
    expect(viewerMenuEmptyReason("design", input)).toBeNull();
    expect(viewerMenuEmptyReason("view", input)).toBeNull();
  });

  it("blames the missing footprint when that is what is missing", () => {
    expect(viewerMenuEmptyReason("view", { stops: stopsFor([]), enabledTabs: ALL_TABS, footprint: null })).toBe(
      "no-footprint",
    );
  });

  it("blames the scope of work when the walls are unchecked, even with a footprint drawn", () => {
    // ⚠ THE CASE THE BUTTON USED TO GET WRONG. It told anyone whose Walls
    // branch was unchecked to "draw one on the plan first" while a footprint
    // was already drawn — an instruction that cannot be acted on, which is
    // worse than no reason at all.
    expect(
      viewerMenuEmptyReason("view", { stops: RECTANGLE, enabledTabs: ["floor"], footprint: FOOTPRINT }),
    ).toBe("walls-out-of-scope");
  });
});

describe("the design subjects and the editor tabs", () => {
  it("cover each other exactly, so no tab is unreachable from the merged menu", () => {
    expect(designSubjectsCoverEveryEditorTab()).toBe(true);
  });

  it("are deliberately in DIFFERENT orders, and both are recorded", () => {
    // EDITOR_TAB_ORDER is building order; DESIGN_SUBJECT_ORDER is the order
    // Tommy named for this menu ("Walls, then Floor, Roof, Foundation").
    // Asserted so that "they differ" stays a decision on the record rather than
    // something a later reader quietly tidies into one list.
    expect([...DESIGN_SUBJECT_ORDER]).toEqual(["wall", "floor", "roof", "foundation"]);
    expect([...EDITOR_TAB_ORDER]).toEqual(["wall", "foundation", "floor", "roof"]);
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

  it("is a BARE word — no caption and no value is composed into it anywhere", () => {
    // Tommy, 2026-09-28: "That would reduce the view button to just saying
    // view." The bar label is one word, whatever the current stop is, and the
    // stop is carried by the two highlights instead. A test rather than a
    // comment, because "the value crept back into the label" is exactly the
    // kind of regression that looks like a feature.
    for (const menu of VIEWER_MENU_ORDER) {
      expect(VIEWER_MENU_LABEL[menu]).not.toContain(" ");
      expect(VIEWER_MENU_LABEL[menu]).not.toContain(":");
    }
  });
});
