import { describe, expect, it } from "vitest";
import {
  buildOctagonFootprint,
  buildRectangleFootprint,
  retile,
  wallCompassDirection,
  wallPlanMitreForPanelsIn,
  type Footprint,
  type Point,
  type Wall,
} from "@building-integrity/geometry";
import {
  COLUMN_TOTAL_WIDTH_IN,
  NO_PANEL_PLAN_MITRE,
  buildCornerPanelMembers,
  cornerPanelPlanMitre,
  memberLocalCornersIn,
  panelPlanMitreXRangeIn,
  type PanelPlanMitre,
} from "@building-integrity/panel-catalog";

/**
 * ⚠ **THE GROUND STORY'S OWN CORNERS, end to end.**
 *
 * The gable row was cut to each corner's bisector earlier on 2026-11-16. This
 * is the story below it, which had the identical defect and had had it for
 * longer: the 2D plan has drawn a corner slot as a trapezoid since 2026-09
 * (`computeSlotRects` recedes its interior edge by `thickness × tan(turn/2)`)
 * and the MEMBERS never followed. The drawing was right and the part was not.
 *
 * ⚠ Both halves are measured. The "after" alone would pass against a mitre
 * that did nothing, so every case here also reports what the SQUARE panels do
 * at the same corner — the number this change exists to drive to zero.
 */

const THICK_IN = 15.5;
const HEIGHT_IN = 120;
/** The tiler rounds a panel width to eighths, so a row does not land exactly
 *  on its wall's length — measured at 0.050in on the 16ft Octagon's diagonal
 *  facets. Pre-existing and not this change's doing. */
const TILER_QUANTUM_IN = 0.125;

function wallFrame(fp: Footprint, wall: Wall) {
  const byId = new Map(fp.corners.map((c) => [c.id, c.point]));
  const a = byId.get(wall.startCorner)!;
  const b = byId.get(wall.endCorner)!;
  const lengthFt = Math.hypot(b.x - a.x, b.y - a.y);
  const dir = { x: (b.x - a.x) / lengthFt, y: (b.y - a.y) / lengthFt };
  return { a, b, lengthFt, dir, inward: { x: -dir.y, y: dir.x } };
}

/** How far outside the wall's MITRED band a world point stands, in inches. */
function outsideBandByIn(fp: Footprint, wall: Wall, mitre: PanelPlanMitre, p: Point): number {
  const f = wallFrame(fp, wall);
  const dx = p.x - f.a.x;
  const dy = p.y - f.a.y;
  const alongIn = (dx * f.dir.x + dy * f.dir.y) * 12;
  const depthIn = (dx * f.inward.x + dy * f.inward.y) * 12;
  const span = panelPlanMitreXRangeIn(mitre, f.lengthFt * 12, THICK_IN, depthIn);
  return Math.max(0, span.startIn - alongIn, alongIn - span.endIn, -depthIn, depthIn - THICK_IN);
}

/** Shared plan area between two adjacent walls' bands at the corner between
 *  them, sampled over a 4ft box. */
function sharedPlanAreaSqIn(
  fp: Footprint,
  a: Wall,
  b: Wall,
  mitreA: PanelPlanMitre,
  mitreB: PanelPlanMitre,
  cornerId: string,
  n = 400,
): number {
  const corner = fp.corners.find((c) => c.id === cornerId)!.point;
  const boxFt = 4;
  let both = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const p = {
        x: corner.x - boxFt / 2 + (boxFt * (i + 0.5)) / n,
        y: corner.y - boxFt / 2 + (boxFt * (j + 0.5)) / n,
      };
      if (outsideBandByIn(fp, a, mitreA, p) === 0 && outsideBandByIn(fp, b, mitreB, p) === 0) both++;
    }
  return both * ((boxFt / n) * 12) ** 2;
}

/** One wall's corner panels, built the way page.tsx composes them, as world
 *  plan points. */
function cornerPanelPlanPoints(fp: Footprint, wall: Wall, slots: { type: string; widthIn: number }[], mitred: boolean) {
  const f = wallFrame(fp, wall);
  const wallMitre = mitred ? wallPlanMitreForPanelsIn(fp, wall, THICK_IN) : NO_PANEL_PLAN_MITRE;
  const out: Point[] = [];
  let atIn = 0;
  slots.forEach((slot, slotIndex) => {
    const startIn = atIn;
    atIn += slot.widthIn;
    if (slot.type !== "corner" && slot.type !== "safety-oct-corner") return;
    const members = buildCornerPanelMembers(
      THICK_IN,
      HEIGHT_IN,
      false,
      slot.widthIn,
      undefined,
      cornerPanelPlanMitre(wallMitre, slotIndex),
    );
    for (const member of members)
      for (const [xIn, , depthIn] of memberLocalCornersIn(member)) {
        const alongFt = (startIn + xIn) / 12;
        const inFt = depthIn / 12;
        out.push({
          x: f.a.x + f.dir.x * alongFt + f.inward.x * inFt,
          y: f.a.y + f.dir.y * alongFt + f.inward.y * inFt,
        });
      }
  });
  return out;
}

for (const acrossFt of [16, 32]) {
  describe(`⚠ the ${acrossFt}ft Octagon — the ground story stops at each corner's bisector`, () => {
    const fp = buildOctagonFootprint(acrossFt, acrossFt);
    const primary = new Set(fp.corners.map((c) => c.id));
    const least = fp.corners[0]!.id;
    const slotsByWall = retile(fp, least, primary, 48, COLUMN_TOTAL_WIDTH_IN, THICK_IN);

    it("every wall carries a corner panel at BOTH ends", () => {
      /* The premise `cornerPanelPlanMitre` rests on: a corner-typed slot
         exists only at a wall end, so the slot index alone says which. */
      for (const wall of fp.walls) {
        const row = slotsByWall[wall.id]!;
        expect(row[0]!.type, wallCompassDirection(wall, fp)).toBe("corner");
        expect(row[row.length - 1]!.type, wallCompassDirection(wall, fp)).toBe("safety-oct-corner");
        /* And nowhere else, or "index 0 is the start corner" would be wrong. */
        expect(row.slice(1, -1).some((s) => s.type === "corner" || s.type === "safety-oct-corner")).toBe(false);
      }
    });

    it("⚠ no wood crosses a corner's bisector — and 99.5 in² per corner did before", () => {
      const mitres = new Map(fp.walls.map((w) => [w.id, wallPlanMitreForPanelsIn(fp, w, THICK_IN)]));
      let pairs = 0;
      for (const a of fp.walls) {
        const b = fp.walls.find((w) => w.startCorner === a.endCorner);
        if (!b) continue;
        pairs++;
        const label = `${wallCompassDirection(a, fp)} / ${wallCompassDirection(b, fp)}`;
        expect(
          sharedPlanAreaSqIn(fp, a, b, mitres.get(a.id)!, mitres.get(b.id)!, a.endCorner),
          `${label} mitred`,
        ).toBeLessThan(0.5);
        const sharedSqIn = sharedPlanAreaSqIn(fp, a, b, NO_PANEL_PLAN_MITRE, NO_PANEL_PLAN_MITRE, a.endCorner);
        expect(sharedSqIn, `${label} square`).toBeGreaterThan(96);
        expect(sharedSqIn, `${label} square`).toBeLessThan(104);
      }
      expect(pairs).toBe(8);
    });

    for (const wall of fp.walls) {
      it(`⚠ the ${wallCompassDirection(wall, fp)} wall's corner panels stay inside its mitred band`, () => {
        const mitre = wallPlanMitreForPanelsIn(fp, wall, THICK_IN);
        const row = slotsByWall[wall.id]!;
        const worstIn = Math.max(
          0,
          ...cornerPanelPlanPoints(fp, wall, row, true).map((p) => outsideBandByIn(fp, wall, mitre, p)),
        );
        expect(worstIn, `worst ${worstIn.toFixed(4)}in outside`).toBeLessThan(TILER_QUANTUM_IN);

        /* ⚠ And the SQUARE panels stand a long way outside it, or the
           assertion above would pass against a mitre that did nothing. */
        const squareWorstIn = Math.max(
          0,
          ...cornerPanelPlanPoints(fp, wall, row, false).map((p) => outsideBandByIn(fp, wall, mitre, p)),
        );
        expect(squareWorstIn).toBeGreaterThan(THICK_IN * Math.tan(Math.PI / 8) - TILER_QUANTUM_IN);
      });
    }
  });
}

describe("a right-angled building is untouched end to end", () => {
  it("every wall's mitre is all zeros, so every corner panel is the one it always was", () => {
    const fp = buildRectangleFootprint(24, 16);
    for (const wall of fp.walls) {
      expect(wallPlanMitreForPanelsIn(fp, wall, THICK_IN)).toEqual(NO_PANEL_PLAN_MITRE);
    }
    expect(
      buildCornerPanelMembers(THICK_IN, HEIGHT_IN, true, COLUMN_TOTAL_WIDTH_IN, undefined, NO_PANEL_PLAN_MITRE),
    ).toEqual(buildCornerPanelMembers(THICK_IN, HEIGHT_IN, true, COLUMN_TOTAL_WIDTH_IN));
  });
});
