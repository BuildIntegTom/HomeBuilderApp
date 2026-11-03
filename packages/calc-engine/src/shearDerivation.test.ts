import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRACE_PAIR_PATTERN,
  bracePairAddedMembers,
  buildPanelFromRecipe,
  buildStandardPanelMembers,
} from "@building-integrity/panel-catalog";
import { computeBracedPanelShearCapacityLb } from "./panelStructuralEstimates";
import {
  derivationMatchesCapacity,
  deriveBrace,
  deriveBuildingShear,
  derivePanelShear,
  deriveWallShear,
  shearDerivationInputs,
} from "./shearDerivation";

const W = 48;
const D = 15.5;
const H = 120;

/** A real Super Carrot panel, built the way the app builds one. */
const carrotPanel = (half: "left" | "right" = "left") =>
  buildPanelFromRecipe({
    name: `carrot ${half}`,
    widthIn: W,
    depthIn: D,
    heightIn: H,
    added: bracePairAddedMembers({ pattern: DEFAULT_BRACE_PAIR_PATTERN, widthIn: W, heightIn: H, half }),
  });

describe("the derivation sheet", () => {
  it("⚠ lands on EXACTLY the number the app's own capacity function reports", () => {
    /* The one property that matters. A sheet that explains a figure it does
       not reproduce is worse than no sheet: an engineer checking the arithmetic
       would find it correct and still be checking the wrong number. Asserted
       over a real panel, not a hand-built fixture. */
    const members = carrotPanel();
    const derived = derivePanelShear("AB:3", members);
    expect(derived.totalHorizontalLb).toBeCloseTo(computeBracedPanelShearCapacityLb(members), 9);
    expect(derivationMatchesCapacity(members)).toBe(true);
  });

  it("shows every step between a cut length and the pounds", () => {
    const members = carrotPanel();
    const { braces } = derivePanelShear("AB:3", members);
    expect(braces.length).toBeGreaterThan(0);
    for (const b of braces) {
      // Each step is really derived from the one before it, not stored twice.
      expect(b.slendernessRatio).toBeCloseTo(b.lengthIn / b.weakAxisDimIn, 9);
      expect(b.fcPrimePsi).toBeCloseTo(b.fcStarPsi * b.cp, 9);
      expect(b.axialCapacityLb).toBeCloseTo(b.fcPrimePsi * b.areaIn2, 9);
      expect(b.horizontalLb).toBeCloseTo(b.axialCapacityLb * Math.sin(Math.abs((b.tiltDeg * Math.PI) / 180)), 9);
      // CP is a stability factor: it reduces capacity, never raises it.
      expect(b.cp).toBeGreaterThan(0);
      expect(b.cp).toBeLessThanOrEqual(1);
      // A diagonal resists less horizontally than it carries axially.
      expect(b.horizontalLb).toBeLessThan(b.axialCapacityLb);
    }
  });

  it("⚠ a longer brace is a weaker one, which is the whole reason CP is in here", () => {
    /* Slenderness is the point of the NDS column check. If this ever stopped
       holding, the sheet would be printing arithmetic that is not buckling
       math at all. */
    const base = carrotPanel().find((m) => m.role === "brace")!;
    const longer = { ...base, actualDimsIn: { ...base.actualDimsIn, lengthIn: base.actualDimsIn.lengthIn * 2 } };
    const a = deriveBrace(base);
    const b = deriveBrace(longer);
    expect(b.slendernessRatio).toBeCloseTo(a.slendernessRatio * 2, 9);
    expect(b.cp).toBeLessThan(a.cp);
    expect(b.axialCapacityLb).toBeLessThan(a.axialCapacityLb);
  });

  it("⚠ a plain panel derives to nothing at all, and so does a Nailer", () => {
    /* `role === "brace"` is the same filter the capacity function uses, and it
       is what keeps a Nailer Pair off the sheet — it sets a pattern field and
       adds no diagonal, so it must produce no rows rather than a row of
       zeroes that reads like modelled resistance. */
    const plain = buildStandardPanelMembers(W, D, H, false);
    expect(derivePanelShear("plain", plain).braces).toEqual([]);
    expect(derivePanelShear("plain", plain).totalHorizontalLb).toBe(0);

    const nailer = buildPanelFromRecipe({
      name: "nailer",
      widthIn: W,
      depthIn: D,
      heightIn: H,
      includeNailer: true,
      added: bracePairAddedMembers({ pattern: "nailer", widthIn: W, heightIn: H, half: "left" }),
    });
    expect(derivePanelShear("nailer", nailer).braces).toEqual([]);
  });

  it("rolls panels up a wall line and reports lb per running foot", () => {
    const wall = deriveWallShear({
      wallId: "AB",
      wallLengthFt: 32,
      panels: [
        { panelId: "AB:1", members: carrotPanel("left") },
        { panelId: "AB:2", members: carrotPanel("right") },
      ],
    });
    expect(wall.panels).toHaveLength(2);
    expect(wall.totalHorizontalLb).toBeCloseTo(wall.panels.reduce((s, p) => s + p.totalHorizontalLb, 0), 9);
    // The unit an engineer's own demand check is usually in.
    expect(wall.lbPerFt).toBeCloseTo(wall.totalHorizontalLb / 32, 9);
  });

  it("leaves lb per foot ABSENT when the wall length is not known, rather than guessing one", () => {
    const wall = deriveWallShear({ wallId: "AB", panels: [{ panelId: "AB:1", members: carrotPanel() }] });
    expect(wall.lbPerFt).toBeUndefined();
    expect(wall.wallLengthFt).toBeUndefined();
    expect(wall.totalHorizontalLb).toBeGreaterThan(0);
  });

  it("totals the building and counts the braces behind the total", () => {
    const b = deriveBuildingShear([
      { wallId: "AB", wallLengthFt: 32, panels: [{ panelId: "AB:1", members: carrotPanel() }] },
      { wallId: "BC", wallLengthFt: 24, panels: [{ panelId: "BC:1", members: carrotPanel("right") }] },
    ]);
    expect(b.walls).toHaveLength(2);
    expect(b.totalHorizontalLb).toBeCloseTo(b.walls.reduce((s, w) => s + w.totalHorizontalLb, 0), 9);
    expect(b.braceCount).toBe(b.walls.reduce((n, w) => n + w.panels.reduce((m, p) => m + p.braces.length, 0), 0));
    expect(b.braceCount).toBeGreaterThan(0);
  });

  it("⚠ every shared input is labelled with where it came from, and the SPF figures stay pending", () => {
    /* The flags rule. Fc and Emin are approximate published figures that
       Building Integrity has not confirmed for the species and grade actually
       bought, and a derivation sheet that printed them bare would read as
       authority they do not have. */
    const inputs = shearDerivationInputs();
    const byLabel = new Map(inputs.map((i) => [i.label, i]));
    expect(byLabel.get("Fc — compression parallel to grain")!.status).toBe("pending-BI-confirmation");
    expect(byLabel.get("Emin — modulus for stability")!.status).toBe("pending-BI-confirmation");
    expect(byLabel.get("c — column stability coefficient")!.status).toBe("code-constant");
    // Every one of them says something, and says where it stands.
    for (const i of inputs) {
      expect(i.note.length, i.label).toBeGreaterThan(20);
      expect(i.status, i.label).toBeTruthy();
    }
  });

  it("⚠ names no seismic zone, anywhere in what it produces", () => {
    /* > *"Id rather have a pattern be described to an engineer with estimated
       > values rather than prescribe an engineer seismic zone thing."*

       The sheet reports CAPACITY. A rating is capacity against DEMAND, and this
       app has no demand numbers — site class, spectral accelerations, building
       weight. Producing one would be inventing the reassuring half. */
    const json = JSON.stringify(
      deriveBuildingShear([{ wallId: "AB", wallLengthFt: 32, panels: [{ panelId: "AB:1", members: carrotPanel() }] }]),
    );
    for (const word of ["seismic", "zone", "SDC", "demand", "base shear"]) {
      expect(json.toLowerCase(), word).not.toContain(word.toLowerCase());
    }
  });
});
