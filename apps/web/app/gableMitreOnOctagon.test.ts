import { describe, expect, it } from "vitest";
import {
  buildOctagonFootprint,
  buildRectangleFootprint,
  computeGableTiledRow,
  roofHeightFtAt,
  shedTallWallId,
  simpleRoofPlanes,
  wallCompassDirection,
  wallPlanMitreForPanelsIn,
  wallRoofCrossRiseIn,
  type Footprint,
  type Point,
  type SimpleRoofOptions,
  type Wall,
} from "@building-integrity/geometry";
import {
  GABLE_PANEL_MAX_HEIGHT_IN,
  NO_PANEL_PLAN_MITRE,
  buildGablePanelMembers,
  memberLocalCornersIn,
  panelPlanMitreForSpan,
  panelPlanMitreXRangeIn,
  type PanelPlanMitre,
} from "@building-integrity/panel-catalog";

/**
 * ⚠ **THE WHOLE POINT, END TO END: two walls meeting at an octagon corner
 * stop occupying the same wood.**
 *
 * > *"The octagon Gable pieces need to be cut like octagon corners."* —
 * > Tommy, 2026-11-16
 *
 * The mitre's own arithmetic is tested in the geometry package and the part
 * in the catalogue. What neither can show is that the two COMPOSE: that a
 * footprint's corner angle becomes a cut on a real panel, on the right tile,
 * at the right face, and that nothing is left over.
 *
 * ⚠ **Both halves are measured, before and after.** The "after" on its own
 * would pass against a mitre that did nothing, so every case here also
 * reports what the UNMITRED row does at that corner — the number this change
 * exists to drive to zero.
 */

const THICK_IN = 15.5;
const PITCH = 4;
const EAVE_FT = 8;
const TILE_IN = 48;
const SHED: SimpleRoofOptions = { form: "shed", pitchIn12: PITCH, eaveHeightFt: EAVE_FT };

/**
 * ⚠ **The tiler's own quantum, and the tolerance every band test here
 * carries.**
 *
 * A gable row's panel widths are rounded to eighths of an inch, so a row does
 * not land exactly on its wall's length. Measured on the octagon tiles, and
 * pinned by its own test below: the 16ft octagon's diagonal facet is 79.550in
 * and its row is **79.500in** (0.050in short); the 32ft octagon's is 159.099in
 * and its row is **159.125in** (0.026in long). Pre-existing, nothing to do
 * with the mitre, and not fixed here.
 */
const TILER_QUANTUM_IN = 0.125;

function wallFrame(fp: Footprint, wall: Wall) {
  const byId = new Map(fp.corners.map((c) => [c.id, c.point]));
  const a = byId.get(wall.startCorner)!;
  const b = byId.get(wall.endCorner)!;
  const lengthFt = Math.hypot(b.x - a.x, b.y - a.y);
  const dir = { x: (b.x - a.x) / lengthFt, y: (b.y - a.y) / lengthFt };
  /* Inward from the footprint's global winding, restated here so the test
     reads the plan independently of the code under test. */
  return { a, b, lengthFt, dir, inward: { x: -dir.y, y: dir.x } };
}

/** A world point in a wall's own plan frame: inches along the wall from its
 *  start corner, inches inward from its exterior face. */
function toWallFrameIn(fp: Footprint, wall: Wall, p: Point) {
  const f = wallFrame(fp, wall);
  const dx = p.x - f.a.x;
  const dy = p.y - f.a.y;
  return {
    alongIn: (dx * f.dir.x + dy * f.dir.y) * 12,
    depthIn: (dx * f.inward.x + dy * f.inward.y) * 12,
  };
}

/** How far outside the wall's MITRED band this world point stands, in inches
 *  (0 when inside). The band is the wall's own rectangle, cut back at each end
 *  by that corner's mitre. */
function outsideMitredBandByIn(fp: Footprint, wall: Wall, mitre: PanelPlanMitre, p: Point): number {
  const { alongIn, depthIn } = toWallFrameIn(fp, wall, p);
  const widthIn = wallFrame(fp, wall).lengthFt * 12;
  const span = panelPlanMitreXRangeIn(mitre, widthIn, THICK_IN, depthIn);
  return Math.max(0, span.startIn - alongIn, alongIn - span.endIn, -depthIn, depthIn - THICK_IN);
}

/**
 * How much plan area two adjacent walls' bands SHARE at the corner between
 * them, in square inches, by sampling a 4ft box around the shared corner.
 *
 * ⚠ Sampled rather than solved on purpose: the exact answer is
 * `t^2 x tan(half the turn)`, which is the formula the mitre itself is built
 * from, so an exact test would be the code marking its own homework.
 */
function sharedPlanAreaSqIn(
  fp: Footprint,
  a: Wall,
  b: Wall,
  mitreA: PanelPlanMitre,
  mitreB: PanelPlanMitre,
  cornerId: string,
  /* 400 keeps this whole file under ~4s; the grid's boundary error is then
     about 1 1/2 sq in on a 99.5 sq in answer, which the bounds below allow. */
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
      if (
        outsideMitredBandByIn(fp, a, mitreA, p) === 0 &&
        outsideMitredBandByIn(fp, b, mitreB, p) === 0
      )
        both++;
    }
  return both * ((boxFt / n) * 12) ** 2;
}

/** One carrying facet's gable row, built the way `page.tsx` composes it: roof
 *  planes, then the cross rise, then each tile's own plan mitre. */
function facetRow(fp: Footprint, wall: Wall, roof: ReturnType<typeof simpleRoofPlanes>, mitred: boolean) {
  const frame = wallFrame(fp, wall);
  const aboveEaveIn = (p: Point) => Math.max(0, ((roofHeightFtAt(p, roof) ?? 0) - EAVE_FT) * 12);
  const widthIn = frame.lengthFt * 12;
  const cross = wallRoofCrossRiseIn(fp, wall, roof, THICK_IN)!;
  const crossIn = cross.planar ? (cross.startIn + cross.endIn) / 2 : 0;
  const wallMitre = mitred ? wallPlanMitreForPanelsIn(fp, wall, THICK_IN) : NO_PANEL_PLAN_MITRE;
  const eaveIn = EAVE_FT * 12;
  const tiles = computeGableTiledRow(
    widthIn,
    eaveIn,
    [
      { xIn: 0, heightIn: eaveIn + aboveEaveIn(frame.a), isExplicitPosition: true },
      { xIn: widthIn, heightIn: eaveIn + aboveEaveIn(frame.b), isExplicitPosition: true },
    ],
    TILE_IN,
    0,
    false,
  );
  const built = tiles.map((tile) => {
    /* ⚠ Capped at the fabrication ceiling, exactly as `page.tsx` caps it
       before building: the 32ft Octagon's tallest facet reaches 128in above
       the eave and `buildGablePanelMembers` answers a panel over 120in by
       THROWING. A height cap cannot move anything this test measures, which
       is all in PLAN. */
    const capIn = GABLE_PANEL_MAX_HEIGHT_IN;
    const leftIn = Math.min(capIn, Math.max(0, tile.leftHeightIn - eaveIn));
    const rightIn = Math.min(capIn, Math.max(0, tile.rightHeightIn - eaveIn));
    const mitre = panelPlanMitreForSpan(wallMitre, tile.xStartIn, tile.xEndIn, widthIn);
    const members =
      Math.max(leftIn, rightIn) < 1.5
        ? []
        : buildGablePanelMembers(tile.widthIn, THICK_IN, leftIn, rightIn, false, undefined, crossIn, mitre);
    return { startIn: tile.xStartIn, endIn: tile.xEndIn, widthIn: tile.widthIn, mitre, members };
  });
  return { frame, widthIn, wallMitre, tiles: built };
}

/** Every member corner of every tile in a row, as a world plan point. */
function rowPlanPoints(fp: Footprint, wall: Wall, row: ReturnType<typeof facetRow>): Point[] {
  const f = wallFrame(fp, wall);
  const out: Point[] = [];
  for (const tile of row.tiles)
    for (const member of tile.members)
      for (const [xIn, , depthIn] of memberLocalCornersIn(member)) {
        const alongFt = (tile.startIn + xIn) / 12;
        const inFt = depthIn / 12;
        out.push({
          x: f.a.x + f.dir.x * alongFt + f.inward.x * inFt,
          y: f.a.y + f.dir.y * alongFt + f.inward.y * inFt,
        });
      }
  return out;
}

for (const acrossFt of [16, 32]) {
  describe(`⚠ the ${acrossFt}ft Octagon shed — the gable row stops at each corner's bisector`, () => {
    const fp = buildOctagonFootprint(acrossFt, acrossFt);
    const roof = simpleRoofPlanes(fp, SHED);
    const tallWallId = shedTallWallId(fp, SHED);
    const carrying = fp.walls.filter((w) => {
      if (w.id === tallWallId) return false;
      const frame = wallFrame(fp, w);
      const top = Math.max(
        (roofHeightFtAt(frame.a, roof) ?? 0) - EAVE_FT,
        (roofHeightFtAt(frame.b, roof) ?? 0) - EAVE_FT,
      );
      return top * 12 > 1.5;
    });

    it("every corner rakes 22.50deg and pulls the interior face back 6.4203in", () => {
      for (const wall of fp.walls) {
        const m = wallPlanMitreForPanelsIn(fp, wall, THICK_IN);
        const where = wallCompassDirection(wall, fp);
        /* A convex corner leaves the EXTERIOR face long. */
        expect(m.startExtIn, where).toBe(0);
        expect(m.endExtIn, where).toBe(0);
        expect(m.startIntIn, where).toBeCloseTo(THICK_IN * Math.tan(Math.PI / 8), 9);
        expect(m.endIntIn, where).toBeCloseTo(THICK_IN * Math.tan(Math.PI / 8), 9);
      }
    });

    it("⚠ no wood crosses a corner's bisector — and 99.5 in^2 per corner did before", () => {
      const mitres = new Map(fp.walls.map((w) => [w.id, wallPlanMitreForPanelsIn(fp, w, THICK_IN)]));
      let pairs = 0;
      for (const a of carrying) {
        const b = fp.walls.find((w) => w.startCorner === a.endCorner);
        if (!b || !carrying.includes(b)) continue;
        pairs++;
        const label = `${wallCompassDirection(a, fp)} / ${wallCompassDirection(b, fp)}`;
        expect(
          sharedPlanAreaSqIn(fp, a, b, mitres.get(a.id)!, mitres.get(b.id)!, a.endCorner),
          `${label} mitred`,
        ).toBeLessThan(0.5);
        /* The same measurement with no mitre: the two triangles nobody was
           cutting, `t^2 x tan(22.5deg)` = 99.51 in^2. Within a couple of
           square inches, which is this grid's own boundary error. */
        const sharedSqIn = sharedPlanAreaSqIn(fp, a, b, NO_PANEL_PLAN_MITRE, NO_PANEL_PLAN_MITRE, a.endCorner);
        expect(sharedSqIn, `${label} unmitred`).toBeGreaterThan(96);
        expect(sharedSqIn, `${label} unmitred`).toBeLessThan(104);
      }
      expect(pairs, "adjacent carrying pairs").toBeGreaterThan(2);
    });

    it("⚠ the row's own length misses its wall's by less than the tiler's 1/8in", () => {
      /* Pinned because the band tests below carry it as a tolerance, and a
         tolerance with no measurement behind it is just a loose test. This is
         pre-existing and is NOT the mitre's doing. */
      for (const wall of carrying) {
        const row = facetRow(fp, wall, roof, true);
        const rowEndIn = Math.max(...row.tiles.map((t) => t.endIn));
        const missIn = rowEndIn - row.widthIn;
        expect(Math.abs(missIn), `${wallCompassDirection(wall, fp)} off by ${missIn.toFixed(3)}in`).toBeLessThan(
          TILER_QUANTUM_IN,
        );
      }
    });

    it("⚠ only the CORNER tiles are cut — the row's interior joints stay tight", () => {
      /* Without this, mitring every tile instead of only the two at the
         corners passes every other test in this file: the material is still
         inside the band, just with a 6.420in gap at the interior face of
         every joint. Measured per joint, at the interior face, where a plan
         mitre shows. */
      for (const wall of carrying) {
        const row = facetRow(fp, wall, roof, true);
        const where = wallCompassDirection(wall, fp);
        const envelope = (tile: (typeof row.tiles)[number], atDepthIn: number) => {
          const span = panelPlanMitreXRangeIn(tile.mitre, tile.widthIn, THICK_IN, atDepthIn);
          return { startIn: tile.startIn + span.startIn, endIn: tile.startIn + span.endIn };
        };
        for (let i = 1; i < row.tiles.length; i++) {
          const before = envelope(row.tiles[i - 1]!, THICK_IN);
          const after = envelope(row.tiles[i]!, THICK_IN);
          expect(after.startIn - before.endIn, `${where} joint ${i} at the interior face`).toBeCloseTo(0, 9);
        }
        /* And the two ENDS really are cut, or "tight joints" would be
           satisfied by a row with no mitre at all. */
        expect(envelope(row.tiles[0]!, THICK_IN).startIn, `${where} start`).toBeCloseTo(
          THICK_IN * Math.tan(Math.PI / 8),
          9,
        );
      }
    });

    for (const wall of carrying) {
      it(`⚠ every member of the ${wallCompassDirection(wall, fp)} facet's row is inside that wall's mitred band`, () => {
        const mitre = wallPlanMitreForPanelsIn(fp, wall, THICK_IN);
        const row = facetRow(fp, wall, roof, true);
        const worstIn = Math.max(
          0,
          ...rowPlanPoints(fp, wall, row).map((p) => outsideMitredBandByIn(fp, wall, mitre, p)),
        );
        expect(worstIn, `worst ${worstIn.toFixed(4)}in outside`).toBeLessThan(TILER_QUANTUM_IN);

        /* ⚠ And the SAME row built square stands a long way outside it, or the
           assertion above would pass against a mitre that did nothing. The
           gap between the two numbers is the whole change: hundredths of an
           inch of tiler rounding against the full 6.420in pull-back. */
        const square = facetRow(fp, wall, roof, false);
        const squareWorstIn = Math.max(
          0,
          ...rowPlanPoints(fp, wall, square).map((p) => outsideMitredBandByIn(fp, wall, mitre, p)),
        );
        expect(squareWorstIn).toBeGreaterThan(THICK_IN * Math.tan(Math.PI / 8) - TILER_QUANTUM_IN);
      });
    }
  });
}

describe("a box building is untouched end to end", () => {
  it("every wall's mitre is all zeros, so every panel is the one it always was", () => {
    const fp = buildRectangleFootprint(24, 16);
    for (const wall of fp.walls) {
      expect(wallPlanMitreForPanelsIn(fp, wall, THICK_IN)).toEqual({
        startExtIn: 0,
        startIntIn: 0,
        endExtIn: 0,
        endIntIn: 0,
      });
    }
  });
});
