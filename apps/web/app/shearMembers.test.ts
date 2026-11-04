import { describe, expect, it } from "vitest";
import { computeBracedPanelShearCapacityLb } from "@building-integrity/calc-engine";
import { shearMembersFor, type ShearMemberContext } from "./shearMembers";
import type { PanelInstance } from "./panelInstances";

/**
 * **The members a panel's shear is read from — and the height they are read at.**
 *
 * ⚠ **B22, 2026-11-04: this module had no tests, and it had a defect.** It
 * built every panel at `ctx.wallHeightIn`, the whole storey, including a panel
 * that is one short band of a tall wall. Every other reader of the same
 * instance already passed `heightOverrideIn` — the weight, the wood weight,
 * the fastener count, the 3D view and the Shop Fabrication sheet all built the
 * short panel. So a tall wall's upper row was CUT at its real height and
 * COUNTED at three times it.
 *
 * It ran in the unsafe direction, and by more than the length: a brace's
 * capacity is resolved through its own tilt, so a panel measured at the wrong
 * height is measured at the wrong ANGLE as well.
 */

const CTX: ShearMemberContext = {
  thicknessIn: 15.5,
  wallHeightIn: 120,
  includeNailer: false,
  girtStyle: "web",
  defaultBracePattern: "chevron",
  defaultBracedMirrored: false,
};

const inst = (over: Partial<PanelInstance>): PanelInstance =>
  ({
    panelType: "standard",
    widthIn: 48,
    ...over,
  }) as PanelInstance;

describe("shearMembersFor", () => {
  it("a panel with no pattern and no diagonal is not counted at all", () => {
    expect(shearMembersFor(inst({}), CTX)).toBeNull();
  });

  it("⚠ builds a BAND at its own height, not at the wall's", () => {
    const band = shearMembersFor(
      inst({ bracePairPattern: "superbrace", bracePairHalf: "left", heightOverrideIn: 40 }),
      CTX,
    )!;
    const full = shearMembersFor(inst({ bracePairPattern: "superbrace", bracePairHalf: "left" }), CTX)!;
    const longest = (ms: typeof band) => Math.max(...ms.filter((m) => m.role === "brace").map((m) => m.actualDimsIn.lengthIn));
    expect(longest(band)).toBeLessThan(longest(full));
    /* And the capacity moves with it — the whole reason this matters. */
    expect(computeBracedPanelShearCapacityLb(band)).not.toBeCloseTo(computeBracedPanelShearCapacityLb(full), 3);
  });

  it("⚠ the same for a dedicated Braced Panel's own band", () => {
    const band = shearMembersFor(inst({ panelType: "braced", heightOverrideIn: 40 }), CTX)!;
    const full = shearMembersFor(inst({ panelType: "braced" }), CTX)!;
    const longest = (ms: typeof band) => Math.max(...ms.filter((m) => m.role === "brace").map((m) => m.actualDimsIn.lengthIn));
    expect(longest(band)).toBeLessThan(longest(full));
  });

  it("falls back to the wall height when a panel is not a band, which is most of them", () => {
    const a = shearMembersFor(inst({ bracePairPattern: "superbrace", bracePairHalf: "left" }), CTX)!;
    const b = shearMembersFor(
      inst({ bracePairPattern: "superbrace", bracePairHalf: "left", heightOverrideIn: CTX.wallHeightIn }),
      CTX,
    )!;
    expect(a).toEqual(b);
  });

  it("⚠ a Vertical Nailer panel is built, and still yields nothing", () => {
    /* Since B21 it carries real members, so it does not come back null — it
       comes back with no brace in it, which is the honest zero. */
    const members = shearMembersFor(inst({ bracePairPattern: "nailer", bracePairHalf: "left" }), CTX)!;
    expect(members).not.toBeNull();
    expect(computeBracedPanelShearCapacityLb(members)).toBe(0);
  });
});
