import { describe, expect, it } from "vitest";
import { buildRectangleFootprint, tileWall, type PanelSlot } from "@building-integrity/geometry";
import { applyDrawTimeBracing, isBraceEligible } from "./drawTimeBracing";
import { allPanelInstances } from "./panelInstances";
import { computeBracedPanelShearCapacityLb } from "@building-integrity/calc-engine";
import { standardPanelMembersFor } from "./standardPanelMembers";

/**
 * ⚠ **B15 switched ON — the pattern reaching the paperwork.**
 *
 * > *"Proceed with pattern overlay and hook it up to shop drawings etc."*
 * > — Tommy, 2026-11-02
 *
 * The foundation stride deliberately stopped one step short of this: the
 * fields existed on the slot and on the instance, and `pushInstance` dropped
 * them on the floor, so the 3D view could have drawn braces the Shop
 * Fabrication sheets did not show. These are the tests that the drop is
 * closed — that one layout feeds the picture, the cut list, the weights
 * and the sheet grouping from the same two fields.
 */

const DEPTH_IN = 15.5;
const HEIGHT_IN = 120;
const STANDARD_IN = 48;
const CORNER_IN = 15.5;

const footprint = buildRectangleFootprint(25.25, 22.75);
const LEAST_ACCESSIBLE = footprint.corners[0]!.id;

function bracedSlots(): Record<string, PanelSlot[]> {
  const plain = Object.fromEntries(
    footprint.walls.map((w) => [w.id, tileWall(w.lengthFt * 12, STANDARD_IN, CORNER_IN, "end").slots]),
  );
  return applyDrawTimeBracing(footprint, plain, LEAST_ACCESSIBLE, undefined, HEIGHT_IN);
}

describe("⚠ the pair pattern rides from the slot to the instance", () => {
  it("⚠ every standard instance carries a half, and nothing else carries one", () => {
    const slots = bracedSlots();
    const instances = allPanelInstances(footprint, slots, STANDARD_IN);
    expect(instances.length).toBeGreaterThan(0);

    let standardsSeen = 0;
    for (const inst of instances) {
      if (inst.panelType === "standard") {
        standardsSeen++;
        expect({ name: inst.name, pattern: inst.bracePairPattern }).toEqual({ name: inst.name, pattern: "superbrace" });
        expect(["left", "right"]).toContain(inst.bracePairHalf);
      } else {
        /* A corner, a column, a safety gap: no pattern, and no half
           without a pattern either. */
        expect({ name: inst.name, pattern: inst.bracePairPattern, half: inst.bracePairHalf }).toEqual({
          name: inst.name,
          pattern: undefined,
          half: undefined,
        });
      }
    }
    expect(standardsSeen).toBeGreaterThan(0);
  });

  it("⚠ the count of braced instances equals the count of braced slots", () => {
    /* The one number that says nothing was dropped in between. If
       `pushInstance` stopped carrying the fields again, this is the test
       that fails — not a member count, which a plain standard panel would
       still satisfy. */
    const slots = bracedSlots();
    const eligibleSlots = Object.values(slots)
      .flat()
      .filter((s) => isBraceEligible(s) && s.bracePairPattern !== undefined).length;
    const patternedInstances = allPanelInstances(footprint, slots, STANDARD_IN).filter(
      (i) => i.bracePairPattern !== undefined,
    ).length;
    expect(patternedInstances).toBe(eligibleSlots);
  });

  it("⚠ an instance builds REAL diagonals, and a left differs from a right", () => {
    /* `membersForPanelTypeId` in page.tsx now routes a standard panel
       through `standardPanelMembersFor(inst, ...)`, which is what the Shop
       Fabrication sheet, the fastener totals and the wood weight all read.
       This proves the instance is a sufficient source for that call. */
    const instances = allPanelInstances(footprint, bracedSlots(), STANDARD_IN).filter((i) => i.panelType === "standard");
    const left = instances.find((i) => i.bracePairHalf === "left");
    const right = instances.find((i) => i.bracePairHalf === "right" && i.widthIn === left?.widthIn);
    expect(left).toBeDefined();
    expect(right).toBeDefined();

    const plain = standardPanelMembersFor({}, left!.widthIn, DEPTH_IN, HEIGHT_IN, false, "web");
    const leftMembers = standardPanelMembersFor(left!, left!.widthIn, DEPTH_IN, HEIGHT_IN, false, "web");
    const rightMembers = standardPanelMembersFor(right!, right!.widthIn, DEPTH_IN, HEIGHT_IN, false, "web");

    expect(leftMembers.length).toBeGreaterThan(plain.length);
    /* Same width, same height, different parts — which is exactly why the
       Shop Fabrication group key had to grow the pattern and the half. Two
       of these must never merge onto one page. */
    expect(leftMembers).not.toEqual(rightMembers);
  });

  it("⚠ a brace diagonal takes the place of the centre nailer stud", () => {
    /* > *"Nailers can be replaced by diagonals. That's not a problem."*
       — Tommy, 2026-11-02, answering the flag this test used to carry as
       an open question. `buildPanelFromRecipe` already drops the centre
       studs when a diagonal is added; it is now a decision, not a
       side effect, so it is asserted rather than merely noted. */
    const inst = allPanelInstances(footprint, bracedSlots(), STANDARD_IN).find(
      (i) => i.panelType === "standard" && i.widthIn >= STANDARD_IN - 1e-6,
    );
    expect(inst).toBeDefined();
    const withNailer = standardPanelMembersFor({}, inst!.widthIn, DEPTH_IN, HEIGHT_IN, true, "web");
    expect(withNailer.some((m) => m.memberId.startsWith("stud_centre_"))).toBe(true);
    const braced = standardPanelMembersFor(inst!, inst!.widthIn, DEPTH_IN, HEIGHT_IN, true, "web");
    expect(braced.some((m) => m.memberId.startsWith("stud_centre_"))).toBe(false);
    expect(braced.some((m) => m.memberId.includes("carrot"))).toBe(true);
  });

  it("⚠ a patterned panel contributes REAL modelled shear, a plain one none", () => {
    /* The shear readout used to filter `panelType === "braced"`, which
       really was every panel with a diagonal in it until the overlay went
       on. A wall of patterned standards reading "no braced panels / 0 lb"
       would be a structural number contradicting its own cut list, so
       `summarizeBearingAndShear` now sums these too.

       ⚠ Nothing new is assumed to do it: `computeBracedPanelShearCapacityLb`
       filters `role: "brace"` and resolves each strut through its own
       `tiltDeg`. This is the test that a patterned panel's members really
       do satisfy that filter — if the recipe ever stopped tagging them
       `brace`, the number would silently fall back to zero. */
    const inst = allPanelInstances(footprint, bracedSlots(), STANDARD_IN).find(
      (i) => i.panelType === "standard" && i.bracePairPattern !== undefined,
    );
    expect(inst).toBeDefined();
    const plainLb = computeBracedPanelShearCapacityLb(
      standardPanelMembersFor({}, inst!.widthIn, DEPTH_IN, HEIGHT_IN, false, "web"),
    );
    const patternedLb = computeBracedPanelShearCapacityLb(
      standardPanelMembersFor(inst!, inst!.widthIn, DEPTH_IN, HEIGHT_IN, false, "web"),
    );
    expect(plainLb).toBe(0);
    expect(patternedLb).toBeGreaterThan(0);
  });

  it("⚠ the Panelizer's pattern choice reaches the members", () => {
    /* > *"Glad there is a super brace to brace to nailer toggle"*
       — Tommy, 2026-11-02. At that moment there was not; it was a constant
       in the source. This is the test that the control he now has actually
       changes the parts, rather than only the label.

       ⚠ `nailer` is the one that matters most here: it adds NO diagonal
       (*"It is indeed the same as a standard panel with nailer added"*), so a
       building set to it has no modelled shear anywhere — which is a real
       structural state, not a broken one, and the zero-bracing Review Log
       entry is what says so. */
    const plain = Object.fromEntries(
      footprint.walls.map((w) => [w.id, tileWall(w.lengthFt * 12, STANDARD_IN, CORNER_IN, "end").slots]),
    );
    for (const pattern of ["superbrace", "braced", "nailer"] as const) {
      const slots = applyDrawTimeBracing(footprint, plain, LEAST_ACCESSIBLE, pattern, HEIGHT_IN);
      const inst = allPanelInstances(footprint, slots, STANDARD_IN).find((i) => i.panelType === "standard");
      expect({ pattern, carried: inst?.bracePairPattern }).toEqual({ pattern, carried: pattern });
      const shearLb = computeBracedPanelShearCapacityLb(
        standardPanelMembersFor(inst!, inst!.widthIn, DEPTH_IN, HEIGHT_IN, false, "web"),
      );
      if (pattern === "nailer") expect({ pattern, shearLb }).toEqual({ pattern, shearLb: 0 });
      else expect(shearLb).toBeGreaterThan(0);
    }
  });
});
