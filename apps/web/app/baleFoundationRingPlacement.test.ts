import { describe, expect, it } from "vitest";
import {
  buildOctagonFootprint,
  buildRectangleFootprint,
  computeFieldFramingLayout,
  computeInsetPerimeterRing,
  insertBumpOut,
  wallBoxes3D,
  type Footprint,
} from "@building-integrity/geometry";
import {
  BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
  BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN,
  BALE_FOUNDATION_GAP_DEFAULT_IN,
  BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
  baleFoundationRingPlan,
  buildBuildingObj,
  buildDoubledStackPair,
  looseDensePackThicknessOptionsIn,
  type WorldPlacedPanel,
} from "@building-integrity/panel-catalog";

/**
 * WHERE THE BALE FOUNDATION'S RINGS ACTUALLY END UP, measured in world
 * space — never by re-reading the `insetIn` the builder just wrote. An
 * `insetIn` reads identically whichever side of the wall it lands on and
 * whichever direction it was applied in, and BOTH of those were real bugs
 * here (Ring A entirely inboard of the interior face; Ring B offset by a
 * panel WIDTH used as a depth). Only the resulting position tells them
 * apart — the same reason the floor-band depth-axis bug survived ~900
 * tests while its own test asserted the field the builder wrote.
 *
 * The world positions come out of `buildBuildingObj`, the production OBJ
 * exporter — the actual bytes Tommy downloads — driven with exactly the
 * anchor/rotation Building3DView's `baleFoundationRenderData` gives each
 * ring group. Depths are measured from the wall's own exterior face, whose
 * definition is pinned to `wallBoxes3D`'s real solid wall box by the first
 * test below rather than assumed.
 */

const IN_PER_FT = 12;
/** Read from the catalog, not restated: the option set is provisional
 * (pending Building Integrity), and a hardcoded copy would stop covering
 * the real thicknesses the moment it changes. */
const THICKNESS_OPTIONS_IN = looseDensePackThicknessOptionsIn;
/** The OBJ exporter writes coordinates at 4 decimal places, so world
 * measurements are quantized to 1e-4in. 1e-3in is comfortably below any
 * real geometric feature here (the smallest is a 1.5in board) and safely
 * above that quantization. */
const TOL_IN = 1e-3;

const allPrimary = (fp: Footprint) => new Set(fp.corners.map((c) => c.id));

/**
 * One wall's exterior face: a point on it, plus the unit normal pointing
 * INWARD (through the wall and on into the building). The footprint's own
 * corner points ARE the exterior face — the convention `wallBoxes3D`
 * documents and the "wall occupies [0, thicknessIn]" measuring stick this
 * whole file uses — and inward is the winding-based perpendicular
 * `computeInsetPerimeterRing` was fixed to use unconditionally in Stage 1.
 *
 * Deliberately NOT taken from `wallBoxes3D`'s box center: that function
 * still picks its own inward side from a vertex-averaged centroid, and on a
 * NOTCHED footprint it puts the two return walls' boxes on the WRONG side.
 * Verified: a 30x20 rect with `insertBumpOut("AB", 5, 20, -6)` — negative
 * depth, corners landing inside — gives walls "12"/"34" offset outward. The
 * positive (true bump-out) case is correct on all eight walls, so do not try
 * to reproduce it with `+6`. That is a real defect in the wall boxes, out of
 * scope here and reported separately — but it would silently corrupt this
 * file's ground truth if the faces were read off the boxes, which is exactly
 * how a latent bug becomes a live one.
 */
function wallExteriorFace(fp: Footprint, wallId: string) {
  const wall = fp.walls.find((w) => w.id === wallId)!;
  const start = fp.corners.find((c) => c.id === wall.startCorner)!.point;
  const end = fp.corners.find((c) => c.id === wall.endCorner)!.point;
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const len = Math.hypot(dx, dz) || 1;
  return {
    exterior: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    inward: { x: -dz / len, y: dx / len },
  };
}

/** How far INWARD, in inches, a world point sits from a wall's exterior
 * face: 0 on the exterior face, `thicknessIn` on the interior face. */
function inwardDepthIn(worldXIn: number, worldZIn: number, face: ReturnType<typeof wallExteriorFace>): number {
  const dxFt = worldXIn / IN_PER_FT - face.exterior.x;
  const dzFt = worldZIn / IN_PER_FT - face.exterior.y;
  return (dxFt * face.inward.x + dzFt * face.inward.y) * IN_PER_FT;
}

/** Every vertex the OBJ exporter writes, in world inches, grouped by the
 * `g` line it was written under (`<panel label>_<memberId>`). */
function worldVerticesByGroup(panels: WorldPlacedPanel[]): Map<string, [number, number, number][]> {
  const byGroup = new Map<string, [number, number, number][]>();
  let current = "";
  for (const line of buildBuildingObj(panels, "test").split("\n")) {
    if (line.startsWith("g ")) {
      current = line.slice(2).trim();
      if (!byGroup.has(current)) byGroup.set(current, []);
    } else if (line.startsWith("v ")) {
      const [x, y, z] = line.slice(2).trim().split(/\s+/).map(Number) as [number, number, number];
      byGroup.get(current)!.push([x, y, z]);
    }
  }
  return byGroup;
}

/** The ring groups exactly as Building3DView's `baleFoundationRenderData`
 * emits them into the OBJ export: anchored at each ring segment's own start
 * point, rotated by that segment's own rotation. */
function ringPanels(fp: Footprint, thicknessIn: number): WorldPlacedPanel[] {
  const panels: WorldPlacedPanel[] = [];
  for (const { name, insetIn } of baleFoundationRingPlan(thicknessIn).rings) {
    for (const seg of computeInsetPerimeterRing(fp, insetIn, allPrimary(fp))) {
      panels.push({
        label: `balefoundation_ring-${name}-${seg.wallId}`,
        worldXIn: seg.startPoint.x * IN_PER_FT,
        worldZIn: seg.startPoint.y * IN_PER_FT,
        worldYIn: -20,
        rotationRad: seg.rotationRad,
        members: buildDoubledStackPair(
          `ring_${name}_${seg.wallId}`,
          seg.lengthFt * IN_PER_FT,
          BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
          BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
          BALE_FOUNDATION_GAP_DEFAULT_IN,
        ),
      });
    }
  }
  return panels;
}

/** Every world vertex of one ring on one wall, as inward depths from that
 * wall's own exterior face. */
function ringDepthsIn(fp: Footprint, thicknessIn: number, ring: string, wallId: string): number[] {
  const face = wallExteriorFace(fp, wallId);
  const prefix = `balefoundation_ring-${ring}-${wallId}_`;
  const depths: number[] = [];
  for (const [group, vertices] of worldVerticesByGroup(ringPanels(fp, thicknessIn))) {
    if (!group.startsWith(prefix)) continue;
    for (const [x, , z] of vertices) depths.push(inwardDepthIn(x, z, face));
  }
  return depths;
}

describe("bale foundation ring placement (world space)", () => {
  const rect = buildRectangleFootprint(30, 20);
  const oct = buildOctagonFootprint(40, 30);

  it("measures from the same exterior face wallBoxes3D builds the solid wall on", () => {
    // Pins this file's ground truth to the real wall geometry: the box the
    // 3D preview draws spans exactly [0, thicknessIn] on the depth scale
    // every assertion below uses. Convex footprints only — see
    // wallExteriorFace's doc comment for why the bumped-out case can't ask
    // wallBoxes3D this question yet.
    for (const fp of [rect, oct]) {
      for (const thicknessIn of THICKNESS_OPTIONS_IN) {
        for (const box of wallBoxes3D(fp, thicknessIn, 10, allPrimary(fp))) {
          const face = wallExteriorFace(fp, box.wallId);
          const centerDepthIn = inwardDepthIn(box.centerX * IN_PER_FT, box.centerZ * IN_PER_FT, face);
          expect(centerDepthIn).toBeCloseTo(thicknessIn / 2, 6);
          expect(box.thicknessFt * IN_PER_FT).toBeCloseTo(thicknessIn, 6);
        }
      }
    }
  });

  it("puts Ring A's outboard face ON the wall's exterior face, under the exterior wythe", () => {
    for (const thicknessIn of THICKNESS_OPTIONS_IN) {
      const plan = baleFoundationRingPlan(thicknessIn);
      for (const wall of rect.walls) {
        const depths = ringDepthsIn(rect, thicknessIn, "a", wall.id);
        expect(depths.length).toBeGreaterThan(0);
        expect(Math.min(...depths)).toBeCloseTo(0, 3); // flush with the exterior face
        expect(Math.max(...depths)).toBeCloseTo(plan.ringWidthIn, 3);
      }
    }
  });

  it("puts Ring B's inboard face ON the wall's interior face", () => {
    for (const thicknessIn of THICKNESS_OPTIONS_IN) {
      const plan = baleFoundationRingPlan(thicknessIn);
      for (const wall of rect.walls) {
        const depths = ringDepthsIn(rect, thicknessIn, "b", wall.id);
        expect(depths.length).toBeGreaterThan(0);
        expect(Math.max(...depths)).toBeCloseTo(thicknessIn, 3); // flush with the interior face
        expect(Math.min(...depths)).toBeCloseTo(thicknessIn - plan.ringWidthIn, 3);
      }
    }
  });

  it("keeps both rings inside the wall's own depth, with a real clear span between them", () => {
    const thicknessIn = 15.5;
    const plan = baleFoundationRingPlan(thicknessIn);
    for (const wall of rect.walls) {
      const a = ringDepthsIn(rect, thicknessIn, "a", wall.id);
      const b = ringDepthsIn(rect, thicknessIn, "b", wall.id);
      expect(Math.min(...a, ...b)).toBeGreaterThanOrEqual(-TOL_IN); // nothing outside the building
      expect(Math.max(...a, ...b)).toBeLessThanOrEqual(thicknessIn + TOL_IN); // nothing past the interior face
      expect(Math.min(...b) - Math.max(...a)).toBeCloseTo(thicknessIn - 2 * plan.ringWidthIn, 3);
    }
    // 9.5in at the default thickness — the gap Tommy should see between the
    // two rings in 3D Framed view.
    expect(thicknessIn - 2 * plan.ringWidthIn).toBe(9.5);
  });

  it("regression: nothing sits ~4.6ft inboard, and the exterior wythe is not left bare", () => {
    // The two defects Tommy reported, restated as measurements. With the old
    // `thicknessIn + standardWidthIn` inset, Ring B's boards were 55.5-57in
    // inboard and NOTHING lay within the exterior wythe's own depth.
    const thicknessIn = 15.5;
    const plan = baleFoundationRingPlan(thicknessIn);
    for (const wall of rect.walls) {
      const all = [...ringDepthsIn(rect, thicknessIn, "a", wall.id), ...ringDepthsIn(rect, thicknessIn, "b", wall.id)];
      expect(Math.max(...all)).toBeLessThan(thicknessIn + TOL_IN); // was 57in
      expect(Math.min(...all)).toBeLessThan(plan.ringWidthIn); // real lumber under the exterior wythe
    }
  });

  it("stays flush per wall on an octagon's mitered walls too", () => {
    const thicknessIn = 15.5;
    const plan = baleFoundationRingPlan(thicknessIn);
    for (const wall of oct.walls) {
      const a = ringDepthsIn(oct, thicknessIn, "a", wall.id);
      const b = ringDepthsIn(oct, thicknessIn, "b", wall.id);
      // Mitered corners are left unextended by design (see
      // computeInsetPerimeterRing), which shortens or gaps a segment's END —
      // it never moves the segment ACROSS its own wall, so the flush rule
      // still reads correctly here.
      expect(Math.min(...a)).toBeCloseTo(0, 3);
      expect(Math.max(...a)).toBeCloseTo(plan.ringWidthIn, 3);
      expect(Math.min(...b)).toBeCloseTo(thicknessIn - plan.ringWidthIn, 3);
      expect(Math.max(...b)).toBeCloseTo(thicknessIn, 3);
    }
  });

  // Both signs, deliberately. Tommy's report was about bump-outs, but the
  // -6 (notch) case is the one that exposed the wallBoxes3D defect, so
  // dropping either would lose coverage of a distinct shape class.
  it.each([
    ["notch (negative depth, corners inside)", -6],
    ["bump-out (positive depth, corners outside)", 6],
  ])("stays flush on every wall of a %s footprint, including the returns", (_label, depthFt) => {
    const { footprint } = insertBumpOut(rect, "AB", 5, 20, depthFt, allPrimary(rect));
    const thicknessIn = 15.5;
    const plan = baleFoundationRingPlan(thicknessIn);
    for (const wall of footprint.walls) {
      const a = ringDepthsIn(footprint, thicknessIn, "a", wall.id);
      const b = ringDepthsIn(footprint, thicknessIn, "b", wall.id);
      expect(Math.min(...a)).toBeCloseTo(0, 3);
      expect(Math.max(...a)).toBeCloseTo(plan.ringWidthIn, 3);
      expect(Math.min(...b)).toBeCloseTo(thicknessIn - plan.ringWidthIn, 3);
      expect(Math.max(...b)).toBeCloseTo(thicknessIn, 3);
    }
  });

  it("agrees with the 2D canvas: each drawn sub-line is a real stack's outboard face", () => {
    // FloorCanvas draws 4 lines per wall (2 rings x outer/inner sub-line) at
    // the plan's own insets, while the 3D preview builds solid stacks. This
    // asserts the two describe the same lumber — the whole point of both
    // consumers reading one shared derivation.
    const thicknessIn = 15.5;
    const plan = baleFoundationRingPlan(thicknessIn);
    for (const ring of plan.rings) {
      for (const subInsetIn of [ring.insetIn, ring.innerInsetIn]) {
        for (const seg of computeInsetPerimeterRing(rect, subInsetIn, allPrimary(rect))) {
          const face = wallExteriorFace(rect, seg.wallId);
          const drawnDepthIn = inwardDepthIn(seg.centerX * IN_PER_FT, seg.centerZ * IN_PER_FT, face);
          const stackDepths = ringDepthsIn(rect, thicknessIn, ring.name, seg.wallId).filter(
            (d) => d >= subInsetIn - TOL_IN && d <= subInsetIn + plan.boardThicknessIn + TOL_IN,
          );
          expect(stackDepths.length).toBeGreaterThan(0);
          expect(drawnDepthIn).toBeCloseTo(Math.min(...stackDepths), 3);
        }
      }
    }
  });

  it("starts field framing inboard of Ring B's inner face, on every wall", () => {
    for (const thicknessIn of THICKNESS_OPTIONS_IN) {
      const plan = baleFoundationRingPlan(thicknessIn);
      const lines = computeFieldFramingLayout(rect, plan.fieldInsetIn, BALE_FOUNDATION_FIELD_SPACING_DEFAULT_IN);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        for (const point of [
          { x: line.x1, y: line.y1 },
          { x: line.x2, y: line.y2 },
        ]) {
          for (const wall of rect.walls) {
            const depthIn = inwardDepthIn(point.x * IN_PER_FT, point.y * IN_PER_FT, wallExteriorFace(rect, wall.id));
            expect(depthIn).toBeGreaterThanOrEqual(thicknessIn - TOL_IN);
          }
        }
      }
      // ...and the ~40in unframed band the old inset left all round the
      // interior is gone: the first line is one wall thickness in, not a
      // wall thickness plus a panel WIDTH.
      expect(plan.fieldInsetIn).toBeLessThan(thicknessIn + 1);
    }
  });
});
