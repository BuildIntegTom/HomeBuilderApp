import { describe, expect, it } from "vitest";
import { vaporOpenBothSidesThresholdPerm, wallAssemblyLayers } from "@building-integrity/panel-catalog";
import {
  computeAssemblyPerm,
  resistanceInSeries,
  validateVaporOpenness,
  vaporOpennessDisplay,
} from "./permeability";

const intello = wallAssemblyLayers.find((l) => l.id === "intello-plus")!;
const mento = wallAssemblyLayers.find((l) => l.id === "mento")!;
const clayPlaster = wallAssemblyLayers.find((l) => l.id === "clay-plaster")!;
const limePlaster = wallAssemblyLayers.find((l) => l.id === "lime-plaster")!;
/* ⚠ The stand-in for "a layer with no numeric perm rating" USED TO BE
   clay-plaster, which stopped working the day clay got a measured number
   (2026-11-26). Timber board is still genuinely unrated, so the unrated
   branch is still exercised — but the branch matters a great deal less now,
   because clay and lime are the app's DEFAULT interior and exterior layers
   (`DEFAULT_WALL_INTERIOR_LAYER_ID` / `..._EXTERIOR_...` in page.tsx) and
   every project was therefore printing "not computable" until they were
   filled in. */
const timberBoard = wallAssemblyLayers.find((l) => l.id === "timber-board")!;

describe("resistanceInSeries", () => {
  it("combines two perms into a single lower-than-either total", () => {
    // 1/x = 1/10 + 1/10 => x = 5
    expect(resistanceInSeries([10, 10])).toBeCloseTo(5, 6);
  });
});

describe("computeAssemblyPerm — spec's own worked example (Intello + Mento)", () => {
  it("matches spec's ~0.13 perm winter figure", () => {
    const result = computeAssemblyPerm(intello, mento, "winter");
    expect(result.computable).toBe(true);
    expect(result.permTotal).toBeCloseTo(0.13, 2);
  });

  it("matches spec's ~9.8 perm summer figure", () => {
    const result = computeAssemblyPerm(intello, mento, "summer");
    expect(result.computable).toBe(true);
    expect(result.permTotal).toBeCloseTo(9.8, 1);
  });

  it("flags as not computable when a layer has no numeric perm rating", () => {
    const result = computeAssemblyPerm(clayPlaster, timberBoard, "winter");
    expect(result.computable).toBe(false);
    expect(result.permTotal).toBeNull();
    expect(result.unratedLayers).toHaveLength(1);
    expect(result.unratedLayers[0]?.id).toBe("timber-board");
  });
});

describe("the DEFAULT wall — clay inside, lime outside", () => {
  /* ⚠ This is the pairing every project gets before anyone touches a
     checkbox, and until 2026-11-26 it printed "not computable" on the
     Project Summary, the proposal and the engineer's sheet. A reader has no
     way to tell that apart from "this wall has no vapour performance", which
     is the opposite of the truth: it is one of the most vapour-open walls you
     can build. */
  it("is computable at all, which is the whole point of filling the two values in", () => {
    for (const season of ["winter", "summer"] as const) {
      const result = computeAssemblyPerm(clayPlaster, limePlaster, season);
      expect(result.computable).toBe(true);
      expect(result.unratedLayers).toHaveLength(0);
    }
  });

  it("clears the code floors — but PER LAYER, which is how the code states them", () => {
    /* ⚠ Written the other way round first, asserting the ASSEMBLY total
       beats 5 perms, and this test failed at 4.51. That was my error, not a
       data problem: IRC Appendix S states both floors per material — 3 US
       perms for a finish on a bale wall, 5 for a water-resistive barrier
       placed behind an exterior finish (§105.6.1). Neither is a limit on the
       series total, and the series total of two compliant layers can sit
       below the per-layer figure without anything being wrong. Keeping the
       mistake recorded because the same confusion would be easy to make on
       the printed sheet, where the assembly total is the number in big
       type. */
    for (const layer of [clayPlaster, limePlaster]) {
      expect(layer.permWinter!).toBeGreaterThan(3);
      expect(layer.permWinter!).toBeGreaterThan(5);
    }
    const { permTotal } = computeAssemblyPerm(clayPlaster, limePlaster, "winter");
    expect(permTotal).not.toBeNull();
    // The assembly total still clears the 3-perm figure, for what it's worth.
    expect(permTotal!).toBeGreaterThan(3);
  });

  it("totals ~4.5 perms in series — BELOW either layer alone, as series resistance requires", () => {
    // 1/x = 1/10.7 + 1/7.8  =>  x ≈ 4.51
    const { permTotal } = computeAssemblyPerm(clayPlaster, limePlaster, "winter");
    expect(permTotal).toBeCloseTo(4.51, 2);
    // ⚠ Stated explicitly because it is the counter-intuitive part and a
    // reader of the printed figure deserves to know: two layers each well
    // above the floor combine to a total that is NOT above the 5-perm WRB
    // figure. The 3-perm plaster floor is per-plaster, not per-assembly, so
    // nothing here fails — but do not let the assembly total get compared
    // against a per-layer limit somewhere down the line.
    expect(permTotal!).toBeLessThan(Math.min(clayPlaster.permWinter!, limePlaster.permWinter!));
  });

  it("does not vary by season, because a plaster is not a smart membrane", () => {
    const winter = computeAssemblyPerm(clayPlaster, limePlaster, "winter");
    const summer = computeAssemblyPerm(clayPlaster, limePlaster, "summer");
    expect(winter.permTotal).toBe(summer.permTotal);
  });
});

describe("validateVaporOpenness", () => {
  it("passes for Intello (interior) + Mento (exterior) in both seasons", () => {
    expect(validateVaporOpenness(intello, mento, "winter").passes).toBe(true);
    expect(validateVaporOpenness(intello, mento, "summer").passes).toBe(true);
  });

  it("fails when the interior layer is more vapor-open than the exterior layer", () => {
    // swapped: exterior=intello (low/variable perm), interior=mento (38, fixed)
    const result = validateVaporOpenness(mento, intello, "winter");
    expect(result.computable).toBe(true);
    expect(result.passes).toBe(false);
  });

  it("reports not computable when a layer lacks a perm rating", () => {
    const result = validateVaporOpenness(clayPlaster, timberBoard, "winter");
    expect(result.computable).toBe(false);
    expect(result.passes).toBeNull();
  });

  /* ⚠⚠ **THE DEFAULT WALL FAILS THIS RULE, AND THE RULE IS THE PROBLEM —
     NOT THE WALL.** Pinned here so nobody "fixes" it by quietly reordering
     the layers or nudging a measured number.

     Lime measures LESS vapour-open than clay in both independent sources
     (Minke 445 vs 612 ng/(Pa·s·m²); Straube/EBNet's own tests 804 vs
     1,073–1,259). So clay inside + lime outside — the app's default, and
     Tommy's actual building practice — has a tighter exterior than interior,
     and a rule that asks only "is exterior > interior?" returns false.

     That rule exists for the case it was written for: a Class-I/II interior
     membrane against a vapour-open exterior, where getting it backwards
     traps water in the straw. Both of these layers are 7.8 and 10.7 perms —
     an order of magnitude above vapour-retarder territory (Class III starts
     at 10 perms counting DOWN; a vapour barrier is below 1). A wall that
     breathes freely in both directions is not the failure this rule is
     looking for, and reporting it as one would teach a reader to ignore the
     check.

     ⚠ So the pass/fail is the wrong SHAPE here, and this is a real queue
     item, not a test quirk: the check needs a third outcome for "both sides
     far above retarder territory, direction immaterial" before this result
     is shown to anyone. Until then the app must not print a bare FAIL for
     the default wall. See docs/plaster-perm-and-shear-research-2026-11-26.md
     §1 and Tommy's 2026-11-26 decision that the disclaimer goes on the page. */
  it("FAILS for the default clay-interior + lime-exterior wall, because lime is tighter than clay", () => {
    const result = validateVaporOpenness(clayPlaster, limePlaster, "winter");
    expect(result.computable).toBe(true);
    expect(result.passes).toBe(false);
    expect(result.interiorPerm).toBe(10.7);
    expect(result.exteriorPerm).toBe(7.8);
  });

  it("and both sides are nonetheless far above vapor-retarder territory, which is why that FAIL misleads", () => {
    const result = validateVaporOpenness(clayPlaster, limePlaster, "winter");
    // Class III vapor retarder is 1–10 perms; anything over 10 is "vapor
    // open". Both layers are at or above the open end of that scale.
    expect(result.interiorPerm!).toBeGreaterThanOrEqual(10);
    expect(result.exteriorPerm!).toBeGreaterThan(5);
  });

  it("so it reports bothSidesOpen, which is the outcome callers must branch on first", () => {
    const result = validateVaporOpenness(clayPlaster, limePlaster, "winter");
    expect(result.bothSidesOpen).toBe(true);
    // ⚠ `passes` is STILL false and that is intentional — the raw rule is
    // unchanged and still readable. What changed is that nothing prints it
    // when `bothSidesOpen` is set.
    expect(result.passes).toBe(false);
  });

  it("does not report bothSidesOpen when one side really is a retarder", () => {
    // Intello at 0.13 perm in winter is a genuine interior vapour retarder,
    // which is the case the rule was written for.
    const result = validateVaporOpenness(intello, mento, "winter");
    expect(result.bothSidesOpen).toBe(false);
    expect(result.passes).toBe(true);
  });

  it("is never bothSidesOpen when the result is not computable", () => {
    expect(validateVaporOpenness(clayPlaster, timberBoard, "winter").bothSidesOpen).toBe(false);
  });
});

describe("vaporOpennessDisplay — the three-way verdict, in one place", () => {
  /* ⚠ These assertions are the reason this function exists. page.tsx printed
     this row on three surfaces with three hand-copied branches; the
     bothSidesOpen outcome would have had to be copied into all three, and
     the red-cell test (`vaporCheck.passes === false`) would have gone on
     reddening the default wall in any surface that was missed. */
  it("reddens a real failure, and ONLY a real failure", () => {
    // mento (38) interior + intello (0.13) exterior — genuinely backwards.
    const bad = vaporOpennessDisplay(validateVaporOpenness(mento, intello, "winter"));
    expect(bad.isFailure).toBe(true);
    expect(bad.label).toContain("FAIL");
  });

  it("does NOT redden the default clay + lime wall, and does not call it a FAIL", () => {
    const shown = vaporOpennessDisplay(validateVaporOpenness(clayPlaster, limePlaster, "winter"));
    expect(shown.isFailure).toBe(false);
    expect(shown.label).not.toContain("FAIL");
    expect(shown.label).toContain("open both ways");
    // The threshold is named in the text, so a reader can see what the claim
    // rests on rather than taking "the rule does not apply" on trust.
    expect(shown.label).toContain(`${vaporOpenBothSidesThresholdPerm.value} perm`);
  });

  it("does not redden a merely-unrated assembly either", () => {
    const shown = vaporOpennessDisplay(validateVaporOpenness(clayPlaster, timberBoard, "winter"));
    expect(shown.isFailure).toBe(false);
    expect(shown.label).toContain("not computable");
  });

  it("still says PASS for the case the rule was actually written for", () => {
    const shown = vaporOpennessDisplay(validateVaporOpenness(intello, mento, "winter"));
    expect(shown.isFailure).toBe(false);
    expect(shown.label).toContain("PASS");
  });

  it("carries pending-BI-confirmation on the threshold, because Claude chose it and not Tommy", () => {
    expect(vaporOpenBothSidesThresholdPerm.status).toBe("pending-BI-confirmation");
    expect(vaporOpenBothSidesThresholdPerm.note).toContain("Claude's judgment");
  });
});
