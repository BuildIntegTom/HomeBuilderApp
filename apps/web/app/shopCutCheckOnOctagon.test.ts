import { describe, expect, it } from "vitest";
import {
  buildOctagonFootprint,
  roofHeightFtAt,
  shedTallWallId,
  simpleRoofPlanes,
  wallCompassDirection,
  wallRoofCrossRiseIn,
  type Footprint,
  type Point,
  type SimpleRoofOptions,
  type Wall,
} from "@building-integrity/geometry";
import {
  buildGablePanelMembers,
  computePanelCutList,
  faceAcrossFieldOf,
  memberLocalCornersIn,
  type PanelCutListRow,
  type PanelMember,
} from "@building-integrity/panel-catalog";

/**
 * ⚠ **THE JIG CHECK, COUNTED ON A REAL BUILDING.**
 *
 * `describeEndCutForShop` puts *"CHECK: the modelled board is N off this stock
 * width"* on a row when the board the app modelled is not the stock a shop
 * would cut the jig from. Tommy's rule for it is in `JIG_MODEL_TOLERANCE_IN`:
 * **it is a threshold to be reviewed, not a tolerance to hide behind.** A
 * warning that fires on parts which are provably right is worse than no
 * warning at all, because a shop learns to scroll past it.
 *
 * It was firing on **60 of the 112 rows** of the 16ft Octagon's gable row, and
 * both reasons were in the reading, not in the parts:
 *
 * 1. the stock dimension compared against was `widthIn` for every member, but
 *    a cut list draws a board in ELEVATION and a stud, a plate and a skin are
 *    all drawn on their narrow face — see `faceAcrossFieldOf`;
 * 2. `cutEdgeLengthIn * cos(angle)` is the across-extent of that drawn FACE,
 *    and a board leaning out of the elevation plane is drawn as a raked
 *    section of itself — see `faceShearAcrossIn`.
 *
 * ## What this file asserts, and why it is not just a number
 *
 * The count alone would pass by loosening the threshold. So every row that
 * does **not** carry the CHECK has its own solid measured here — the real
 * 8-corner prism out of `memberLocalCornersIn`, along the normal of the
 * board's own long face, with no reference to the arithmetic under test. A row
 * goes quiet only if the board really is its stock.
 */

const THICK_IN = 15.5;
const PITCH = 4;
const EAVE_FT = 8;
const SHED: SimpleRoofOptions = { form: "shed", pitchIn12: PITCH, eaveHeightFt: EAVE_FT };

function wallFrame(fp: Footprint, wall: Wall) {
  const byId = new Map(fp.corners.map((c) => [c.id, c.point]));
  const a = byId.get(wall.startCorner)!;
  const b = byId.get(wall.endCorner)!;
  const lengthFt = Math.hypot(b.x - a.x, b.y - a.y);
  const dir = { x: (b.x - a.x) / lengthFt, y: (b.y - a.y) / lengthFt };
  return { a, b, lengthFt, inward: { x: -dir.y, y: dir.x } };
}

/**
 * The board's own across-the-cut dimension, **measured off the 8-corner solid**
 * rather than computed from an angle: the extent of the prism along the unit
 * normal of its own long face.
 *
 * ⚠ Deliberately written the long way round. `missingTriangleFor` reaches this
 * number through a trig identity and a shear factor; a check that reused
 * either could not catch it being wrong. `memberLocalCornersIn` returns view
 * space `[x, up, depth]`, the near ring then the far ring, corner `i` paired
 * with `i + 4`.
 */
function solidAcrossIn(member: PanelMember): number | null {
  const corners = memberLocalCornersIn(member);
  if (corners.length !== 8) return null;
  const near = corners.slice(0, 4);
  /* The near ring's long edge: the longer of the two opposite pairs, the same
     robust split `describeBraceEndCuts` makes and for the same reason — the
     winding can put either pair in either array slot. */
  const seg = (i: number, j: number): [number, number] => [
    near[j]![0] - near[i]![0],
    near[j]![1] - near[i]![1],
  ];
  const len = (e: [number, number]) => Math.hypot(e[0], e[1]);
  const e01 = seg(0, 1);
  const e12 = seg(1, 2);
  const e23 = seg(2, 3);
  const e30 = seg(3, 0);
  const longIs0123 = len(e01) + len(e23) > len(e12) + len(e30);
  const longEdge = longIs0123 ? e01 : e12;
  const atCorner = longIs0123 ? 0 : 1;
  if (!(len(longEdge) > 0)) return null;
  /* That long edge, swept to the far ring, spans one long FACE of the board.
     Its normal is the direction the board's across-dimension runs in. */
  const along: [number, number, number] = [longEdge[0], longEdge[1], 0];
  const base = near[atCorner]!;
  const far = corners[atCorner + 4]!;
  const sweep: [number, number, number] = [far[0] - base[0], far[1] - base[1], far[2] - base[2]];
  const normal: [number, number, number] = [
    along[1] * sweep[2] - along[2] * sweep[1],
    along[2] * sweep[0] - along[0] * sweep[2],
    along[0] * sweep[1] - along[1] * sweep[0],
  ];
  const mag = Math.hypot(normal[0], normal[1], normal[2]);
  if (!(mag > 0)) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of corners) {
    const d = (p[0] * normal[0] + p[1] * normal[1] + p[2] * normal[2]) / mag;
    lo = Math.min(lo, d);
    hi = Math.max(hi, d);
  }
  return hi - lo;
}

/** Every cut-list row of the 16ft Octagon's whole gable row, built the way
 *  `page.tsx` composes it: roof planes, cross rise, tiles of at most 48in. */
function octagonGableRows(): { label: string; row: PanelCutListRow }[] {
  const fp = buildOctagonFootprint(16, 16);
  const roof = simpleRoofPlanes(fp, SHED);
  const tallWallId = shedTallWallId(fp, SHED);
  const carrying = fp.walls.filter((w) => {
    if (w.id === tallWallId) return false;
    const f = wallFrame(fp, w);
    const top = Math.max(
      (roofHeightFtAt(f.a, roof) ?? 0) - EAVE_FT,
      (roofHeightFtAt(f.b, roof) ?? 0) - EAVE_FT,
    );
    return top * 12 > 1.5;
  });
  const out: { label: string; row: PanelCutListRow }[] = [];
  for (const wall of carrying) {
    const f = wallFrame(fp, wall);
    const widthIn = f.lengthFt * 12;
    const tiles = Math.max(1, Math.ceil(widthIn / 48));
    const tileWidthIn = widthIn / tiles;
    const along = (t: number): Point => ({
      x: f.a.x + ((f.b.x - f.a.x) * t) / widthIn,
      y: f.a.y + ((f.b.y - f.a.y) * t) / widthIn,
    });
    const roofAt = (p: Point) => Math.max(0, ((roofHeightFtAt(p, roof) ?? 0) - EAVE_FT) * 12);
    const cross = wallRoofCrossRiseIn(fp, wall, roof, THICK_IN)!;
    const crossIn = cross.planar ? (cross.startIn + cross.endIn) / 2 : 0;
    for (let i = 0; i < tiles; i++) {
      const leftIn = roofAt(along(i * tileWidthIn));
      const rightIn = roofAt(along((i + 1) * tileWidthIn));
      if (Math.max(leftIn, rightIn) < 1.5) continue;
      const members = buildGablePanelMembers(
        tileWidthIn,
        THICK_IN,
        leftIn,
        rightIn,
        false,
        undefined,
        crossIn,
      );
      for (const row of computePanelCutList(members)) {
        out.push({ label: `${wallCompassDirection(wall, fp)} tile ${i} ${row.letter} ${row.role}`, row });
      }
    }
  }
  return out;
}

describe("the 16ft Octagon's gable row — the jig CHECK, counted", () => {
  const rows = octagonGableRows();

  it("the row is the shape it has always been: 112 cut-list rows", () => {
    /* Pinned so a drop in the CHECK count can never be a drop in the parts. */
    expect(rows.length).toBe(112);
  });

  it("⚠ TWO rows carry the CHECK, down from 60 — and they are the SLIVER PLATES", () => {
    const flagged = rows.filter((r) => r.row.cutNote.includes("CHECK:"));
    expect(flagged.length).toBe(2);
    /* Both are the gable plate that runs out at a shed's low corner — see
       `gable_sliver_one_board`. Their faces are TRIANGLES: the long edges are
       not parallel, so there is no one across-dimension to build a jig to, and
       one of the two ends is a point rather than an edge. */
    for (const { row } of flagged) expect(row.role).toBe("plate");
  });

  it("⚠ and the rows that went quiet are boards whose SOLIDS measure their stock", () => {
    /* The assertion that makes the count mean something. */
    const quiet = rows.filter((r) => !r.row.cutNote.includes("CHECK:"));
    expect(quiet.length).toBe(110);
    let measured = 0;
    for (const { label, row } of quiet) {
      const member = row.members[0]!;
      if (member.position.trapezoidCornersIn === undefined) continue; // no angled end to jig
      const field = faceAcrossFieldOf(member);
      expect(field, `${label}: no honest across-face reading`).not.toBeNull();
      const stockIn = member.actualDimsIn[field!];
      const solid = solidAcrossIn(member);
      expect(solid, `${label}: no solid`).not.toBeNull();
      /* 1/32in is the threshold the note itself uses; a quiet row must sit
         inside it against a measurement that knows nothing of that note. */
      expect(
        Math.abs(solid! - stockIn),
        `${label}: solid ${solid} vs stock ${stockIn}`,
      ).toBeLessThan(1 / 32);
      measured += 1;
    }
    /* Not vacuous: most of these rows really do carry a trapezoid. */
    expect(measured).toBeGreaterThan(60);
  });

  it("⚠ no sheet on this building prints NaN", () => {
    /* It did. The SW facet's run-out plate has a zero-length end edge, and
       dividing by it reached the shop as "~NaN deg off square" with a waste
       triangle "~NaN" along the length" — and no CHECK at all. */
    for (const { label, row } of rows) {
      expect(row.cutNote, label).not.toContain("NaN");
      expect(row.angleLabel, label).not.toContain("NaN");
      expect(row.lengthLabel, label).not.toContain("NaN");
    }
  });

  it("⚠ the waste triangle's own leg IS the board, on every row that prints one", () => {
    /* The same wrong dimension drove both the CHECK and the printed jig, so
       this is the other half of the fix and it is asserted against the SOLID
       rather than against a figure typed in here.

       ⚠ **A gable row carries studs in BOTH orientations**, which is why the
       leg cannot be pinned to one number: a frame stud stands ON EDGE (its
       3½in runs through the wall, so the saw crosses 1½in) while a nailer lies
       FLAT against the face (the saw crosses its full 3½in). Pinning 1½in here
       failed on the first nailer, and the nailer was right. */
    const withJig = rows.filter((r) => r.row.cutNote.includes("Waste triangle"));
    expect(withJig.length).toBeGreaterThan(40);
    /* Every distinct leg the row prints, against the stock dimension behind
       it — the mapping has to be one-to-one or the leg is not the board. */
    const stockByLeg = new Map<string, Set<number>>();
    for (const { label, row } of withJig) {
      const member = row.members[0]!;
      const solid = solidAcrossIn(member);
      expect(solid, `${label}: no solid`).not.toBeNull();
      const stockIn = member.actualDimsIn[faceAcrossFieldOf(member)!];
      /* ⚠ Only on the rows that went QUIET. The two sliver plates print a
         leg off the same stock — that is right, a jig is cut from stock — but
         their SOLIDS are 2.96in and 0in on 1½in boards, which is exactly the
         disagreement they carry the CHECK for. */
      if (!row.cutNote.includes("CHECK:")) {
        expect(Math.abs(solid! - stockIn), `${label}: solid ${solid} vs ${stockIn}`).toBeLessThan(1 / 32);
      }
      /* The leg the sheet prints, pulled back out of the sentence. */
      const printed = /Waste triangle ~?([^x]+) across the face/.exec(row.cutNote)?.[1]?.trim();
      expect(printed, `${label}: no leg printed`).toBeTruthy();
      const seen = stockByLeg.get(printed!) ?? new Set<number>();
      seen.add(stockIn);
      stockByLeg.set(printed!, seen);
    }
    for (const [leg, stocks] of stockByLeg) {
      expect([...stocks], `leg ${leg} came from more than one stock`).toHaveLength(1);
    }
    /* Not vacuous, and the point of the whole fix: the row prints MORE THAN
       ONE leg, where before it printed the member's width every time. */
    expect([...stockByLeg.keys()].sort()).toEqual(['1½"', '3½"', '¾"']);
  });
});
