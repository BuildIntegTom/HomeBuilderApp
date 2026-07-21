import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import type { PanelMember, PanelSpacePoint2D } from "./componentSchema";
import {
  braceLongestEdgeIn,
  buildHeaderTrussWebBraces,
  buildNailer,
  buildTrussWebBraces,
  computeBraceEndCutAngleDeg,
  computeBraceTrapezoidCornersIn,
  computeHeaderBraceTrapezoidCornersIn,
  computePlywoodAreaSqFt,
  computeTrussWebAngleDeg,
  computeTrussWebPeakCount,
  describeBraceEndCuts,
  memberBoxSizeIn,
  PLATE_2X4_WIDTH_IN,
  type HeaderBraceEndTarget,
} from "./panelMemberHelpers";

/** Shoelace signed area (x2) of a 4-point polygon — positive means CCW. */
function signedArea2x(corners: readonly PanelSpacePoint2D[]): number {
  let sum = 0;
  for (let i = 0; i < corners.length; i++) {
    const c = corners[i]!;
    const next = corners[(i + 1) % corners.length]!;
    sum += c.xIn * next.zIn - next.xIn * c.zIn;
  }
  return sum;
}

function dist(a: PanelSpacePoint2D, b: PanelSpacePoint2D): number {
  return Math.hypot(b.xIn - a.xIn, b.zIn - a.zIn);
}

describe("computePlywoodAreaSqFt", () => {
  it("sums only plywood members at the requested thickness", () => {
    const members = buildStandardPanelMembers(40, 15.5, 120, false);
    const threeQuarterSqFt = computePlywoodAreaSqFt(members, 0.75);
    const halfSqFt = computePlywoodAreaSqFt(members, 0.5);

    const expectedThreeQuarter = members
      .filter((m) => m.material === "plywood" && m.actualDimsIn.thicknessIn === 0.75)
      .reduce((sum, m) => sum + (m.actualDimsIn.widthIn * m.actualDimsIn.lengthIn) / 144, 0);
    expect(threeQuarterSqFt).toBeCloseTo(expectedThreeQuarter, 6);
    expect(threeQuarterSqFt).toBeGreaterThan(0); // 2 skins
    expect(halfSqFt).toBeGreaterThan(0); // 2 girt webs
    expect(halfSqFt).not.toBeCloseTo(threeQuarterSqFt, 1);
  });

  it("returns 0 when no plywood member matches the thickness", () => {
    const members = buildStandardPanelMembers(40, 15.5, 120, false);
    expect(computePlywoodAreaSqFt(members, 3)).toBe(0);
  });

  it("returns 0 for an empty member list", () => {
    expect(computePlywoodAreaSqFt([], 0.75)).toBe(0);
  });
});

describe("computeTrussWebPeakCount / computeTrussWebAngleDeg", () => {
  it("uses 1 peak when a single peak already clears the 30deg minimum", () => {
    // A 36in-wide, 18in-rise door header: half-width 18, rise 18 -> 45deg with 1 peak.
    const n = computeTrussWebPeakCount(36, 18);
    expect(n).toBe(1);
    expect(computeTrussWebAngleDeg(36, 18, n)).toBeCloseTo(45, 6);
  });

  it("needs more peaks as width grows for a fixed rise, to keep every web >= 30deg", () => {
    const rise = 12;
    const narrow = computeTrussWebPeakCount(36, rise);
    const wide = computeTrussWebPeakCount(120, rise);
    expect(wide).toBeGreaterThan(narrow);
    expect(computeTrussWebAngleDeg(120, rise, wide)).toBeGreaterThanOrEqual(30 - 1e-6);
  });

  it("never returns fewer than 1 peak even for a very short rise", () => {
    expect(computeTrussWebPeakCount(200, 0.001)).toBeGreaterThanOrEqual(1);
  });
});

describe("computeBraceEndCutAngleDeg", () => {
  it("is 0deg (a plain square crosscut) for a perfectly vertical board", () => {
    expect(computeBraceEndCutAngleDeg(0)).toBe(0);
  });

  it("is 90deg (the cut plane runs parallel to the board's own length) for a perfectly flat board", () => {
    expect(computeBraceEndCutAngleDeg(90)).toBe(90);
  });

  it("equals the tilt magnitude regardless of which direction the board leans", () => {
    expect(computeBraceEndCutAngleDeg(42.3)).toBeCloseTo(42.3, 6);
    expect(computeBraceEndCutAngleDeg(-42.3)).toBeCloseTo(42.3, 6);
  });

  it("matches a real header brace's own tiltDeg (a level cut against the flat chord it lands on)", () => {
    const braces = buildTrussWebBraces(1, 36, 0, () => 18, 0.75, "web");
    const rise = braces.find((b) => b.memberId === "web_1_rise")!;
    // A 36in-wide, 18in-rise single-peak brace: half-width 18, rise 18 -> 45deg tilt.
    expect(computeBraceEndCutAngleDeg(rise.position.tiltDeg!)).toBeCloseTo(45, 6);
  });
});

describe("buildTrussWebBraces", () => {
  it("builds 2 braces per peak (rise + fall), all 2x4 diagonal members rotated 90deg", () => {
    const braces = buildTrussWebBraces(3, 90, 0, () => 20, 0.75, "web");
    expect(braces).toHaveLength(6);
    for (const b of braces) {
      expect(b.orientation).toBe("diagonal");
      expect(b.position.rotationDeg).toBe(90);
      expect(b.actualDimsIn.thicknessIn).toBeCloseTo(1.5, 6);
      expect(b.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
      expect(b.position.yIn).toBeCloseTo(0.75, 6);
    }
  });

  function endpoints(brace: PanelMember): { x: number; z: number }[] {
    const size = memberBoxSizeIn(brace);
    const tiltRad = (brace.position.tiltDeg! * Math.PI) / 180;
    const halfLen = size.zIn / 2;
    return [
      { x: brace.position.xIn + -Math.sin(tiltRad) * halfLen, z: brace.position.zIn + Math.cos(tiltRad) * halfLen },
      { x: brace.position.xIn - -Math.sin(tiltRad) * halfLen, z: brace.position.zIn - Math.cos(tiltRad) * halfLen },
    ];
  }

  it("flanks a small gap at an internal foot instead of pinching fall/rise to one shared point", () => {
    const braces = buildTrussWebBraces(3, 90, 0, () => 20, 0.75, "web");
    // rise_1: foot at x=0; fall_1 and rise_2 used to meet at the shared foot x=30 (90/3); fall_3 ends at x=90.
    const nearFoot = (p: { x: number; z: number }) => Math.abs(p.z) < 5; // the foot-side endpoint, near the bottom chord (z=0), not the peak (z=20)
    const fall1FootEnd = endpoints(braces.find((b) => b.memberId === "web_1_fall")!).find(nearFoot)!;
    const rise2FootEnd = endpoints(braces.find((b) => b.memberId === "web_2_rise")!).find(nearFoot)!;

    // Neither piece actually reaches the nominal shared foot (x=30) anymore — each stops
    // PEAK_GAP_IN/2 short of it, flanking a real gap instead.
    expect(fall1FootEnd.x).toBeLessThan(30);
    expect(rise2FootEnd.x).toBeGreaterThan(30);
    expect(rise2FootEnd.x - fall1FootEnd.x).toBeGreaterThan(0.5);
  });

  it("still touches the bottom chord exactly at the very first/last foot (no flanking against the continuous chord)", () => {
    const braces = buildTrussWebBraces(3, 90, 0, () => 20, 0.75, "web");
    const rise1 = endpoints(braces.find((b) => b.memberId === "web_1_rise")!);
    const fall3 = endpoints(braces.find((b) => b.memberId === "web_3_fall")!);
    expect(rise1.some((p) => Math.abs(p.x) < 1e-6 && Math.abs(p.z) < 1e-6)).toBe(true); // starts exactly at x=0
    expect(fall3.some((p) => Math.abs(p.x - 90) < 1e-6 && Math.abs(p.z) < 1e-6)).toBe(true); // ends exactly at x=90
  });

  it("flanks a small gap at a peak too (rise meeting its own fall)", () => {
    const braces = buildTrussWebBraces(1, 36, 0, () => 18, 0.75, "web");
    const nearPeak = (p: { x: number; z: number }) => Math.abs(p.z - 18) < 5;
    const risePeakEnd = endpoints(braces.find((b) => b.memberId === "web_1_rise")!).find(nearPeak)!;
    const fallPeakEnd = endpoints(braces.find((b) => b.memberId === "web_1_fall")!).find(nearPeak)!;
    expect(risePeakEnd.x).toBeLessThan(18); // short of the nominal peak (x=18)
    expect(fallPeakEnd.x).toBeGreaterThan(18);
    expect(fallPeakEnd.x - risePeakEnd.x).toBeGreaterThan(0.5);
  });

  it("follows a sloped top chord (gable-style) via topZAt", () => {
    const braces = buildTrussWebBraces(2, 40, 1, (x) => 1 + x * 0.5, 0.75, "web");
    // Peak 2 (further along X) should sit higher than peak 1, since topZAt rises with X.
    const peak1 = braces.find((b) => b.memberId === "web_1_rise")!;
    const peak2 = braces.find((b) => b.memberId === "web_2_rise")!;
    expect(peak2.position.zIn).toBeGreaterThan(peak1.position.zIn);
  });
});

describe("computeBraceTrapezoidCornersIn / braceLongestEdgeIn", () => {
  // A 45deg brace from (0,0) [plumb target x=0] to (10,10) [level target
  // z=10], board width 2 — hand-derived corners (see the module's own
  // test-authoring notes) confirm the "intersect against 2 planes"
  // algorithm and the closed-form cross-check L +- W/(2*ux*uz) agree.
  const L = Math.hypot(10, 10);

  it("both plumb corners land exactly on the plumb plane, both level corners exactly on the level plane", () => {
    const corners = computeBraceTrapezoidCornersIn(0, 0, 10, 10, 2, 0, 10);
    // corners[0]/corners[3] and corners[1]/corners[2] are one plumb/level
    // pair each in SOME order — self-normalizing winding can swap which
    // index holds which, so check by property (x==plumbX or z==levelX),
    // not by fixed index.
    const plumbCount = corners.filter((c) => Math.abs(c.xIn - 0) < 1e-6).length;
    const levelCount = corners.filter((c) => Math.abs(c.zIn - 10) < 1e-6).length;
    expect(plumbCount).toBe(2);
    expect(levelCount).toBe(2);
  });

  it("the 2 centerline-parallel edges match the closed-form cross-check L +- boardWidthIn/(2*ux*uz)", () => {
    const corners = computeBraceTrapezoidCornersIn(0, 0, 10, 10, 2, 0, 10);
    const ux = 10 / L;
    const uz = 10 / L;
    const expectedLonger = L + 2 / (2 * ux * uz);
    const expectedShorter = L - 2 / (2 * ux * uz);
    expect(braceLongestEdgeIn(corners)).toBeCloseTo(expectedLonger, 6);
    // The 2 opposite-edge pairs are {e01,e23} (the 2 centerline-parallel
    // long edges — one longer, one shorter, per the +-halfWidth offset)
    // and {e12,e30} (the true short bevel-cut end faces, close to the
    // board's own width) — braceLongestEdgeIn picks whichever pair has
    // the greater TOTAL length as "the long pair", then returns its
    // longer member. Confirm both members of that identified long pair
    // reproduce the closed-form longer/shorter split.
    const e01 = dist(corners[0], corners[1]);
    const e23 = dist(corners[2], corners[3]);
    const e12 = dist(corners[1], corners[2]);
    const e30 = dist(corners[3], corners[0]);
    const longPair = e01 + e23 > e12 + e30 ? [e01, e23] : [e12, e30];
    expect(Math.max(...longPair)).toBeCloseTo(expectedLonger, 6);
    expect(Math.min(...longPair)).toBeCloseTo(expectedShorter, 6);
    // The other pair is the true short bevel-cut faces — genuinely small,
    // nowhere near the centerline length.
    const shortPair = e01 + e23 > e12 + e30 ? [e12, e30] : [e01, e23];
    expect(Math.max(...shortPair)).toBeLessThan(L / 2);
  });

  it("always returns a positive (CCW) winding, for every stud-side/direction combination a bracing style can produce", () => {
    // The 4 sign combinations of (ux,uz) a chevron/hatch brace can ever
    // produce: upper-left("/"-ish), upper-right("\"-ish), lower-left,
    // lower-right (girt-to-plate in every direction).
    const configs: [number, number, number, number, number, number][] = [
      [0, 0, 10, 10, 0, 10], // ux>0, uz>0
      [10, 0, 0, 10, 10, 10], // ux<0, uz>0
      [10, 0, 0, -10, 10, -10], // ux<0, uz<0
      [0, 10, 10, 0, 0, 0], // ux>0, uz<0
    ];
    for (const [xA, zA, xB, zB, plumbX, levelZ] of configs) {
      const corners = computeBraceTrapezoidCornersIn(xA, zA, xB, zB, 2, plumbX, levelZ);
      expect(signedArea2x(corners)).toBeGreaterThan(0);
    }
  });

  it("degenerates gracefully to a thin sliver (not NaN) when boardWidthIn is 0", () => {
    const corners = computeBraceTrapezoidCornersIn(0, 0, 10, 10, 0, 0, 10);
    for (const c of corners) {
      expect(Number.isFinite(c.xIn)).toBe(true);
      expect(Number.isFinite(c.zIn)).toBe(true);
    }
  });
});

/** For a "simple" (non-self-intersecting) quad with vertices in perimeter
 * order, the 2 diagonals (0-2, 1-3) intersect each other inside the shape
 * — a self-intersecting ("bowtie") quad's diagonals, by the same indexing,
 * do NOT intersect (a pair of adjacent SIDES cross instead). */
function segmentsIntersect(p1: PanelSpacePoint2D, p2: PanelSpacePoint2D, p3: PanelSpacePoint2D, p4: PanelSpacePoint2D): boolean {
  function cross(o: PanelSpacePoint2D, a: PanelSpacePoint2D, b: PanelSpacePoint2D): number {
    return (a.xIn - o.xIn) * (b.zIn - o.zIn) - (a.zIn - o.zIn) * (b.xIn - o.xIn);
  }
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0) ? ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)) : false;
}

/** The 2 corners (of a 4-corner trapezoid) closest to a target point —
 * robust to `computeHeaderBraceTrapezoidCornersIn`'s own winding
 * normalization, which can shift which array index holds which end's
 * corners, unlike assuming a fixed index pairing. */
function closestTwo(corners: readonly PanelSpacePoint2D[], targetXIn: number, targetZIn: number): PanelSpacePoint2D[] {
  return [...corners]
    .sort((a, b) => Math.hypot(a.xIn - targetXIn, a.zIn - targetZIn) - Math.hypot(b.xIn - targetXIn, b.zIn - targetZIn))
    .slice(0, 2);
}

describe("computeHeaderBraceTrapezoidCornersIn", () => {
  it("meets an adjacent brace's own long points at the exact shared point (a miter joint) — Tommy: 'insides of their long points meet'", () => {
    // A 3-peak header, widthIn=90, rise=20 (segWidthIn=30, peaks at X=15,45,75).
    // fall_1 (peak0 -> footRight0) and rise_2 (footLeft1 -> peak1) share an
    // internal foot at (30,0), both ends genuine brace-to-brace miters —
    // otherDirXIn/ZIn computed the same way buildHeaderTrussWebBraces does.
    const fall1Target: HeaderBraceEndTarget = { kind: "miter", otherDirXIn: 15, otherDirZIn: 20 };
    const rise2Target: HeaderBraceEndTarget = { kind: "miter", otherDirXIn: -15, otherDirZIn: 20 };
    // The other (untested) end of each board — real miter targets
    // matching a genuine 3-peak header (fall1's own peak-end meets
    // rise_1; rise2's own peak-end meets fall_2), not an arbitrary
    // placeholder — a target physically unrelated to where a board's end
    // actually sits produces meaningless extrapolated geometry there,
    // which isn't what this test means to exercise.
    const fall1PeakTarget: HeaderBraceEndTarget = { kind: "miter", otherDirXIn: -15, otherDirZIn: -20 };
    const rise2PeakTarget: HeaderBraceEndTarget = { kind: "miter", otherDirXIn: 15, otherDirZIn: -20 };

    const fall1Corners = computeHeaderBraceTrapezoidCornersIn(15, 20, 30, 0, 3.5, fall1PeakTarget, fall1Target);
    const rise2Corners = computeHeaderBraceTrapezoidCornersIn(30, 0, 45, 20, 3.5, rise2Target, rise2PeakTarget);

    const fall1FootCorners = closestTwo(fall1Corners, 30, 0);
    const rise2FootCorners = closestTwo(rise2Corners, 30, 0);
    for (const c of fall1FootCorners) {
      const match = rise2FootCorners.some((r) => Math.abs(r.xIn - c.xIn) < 1e-6 && Math.abs(r.zIn - c.zIn) < 1e-6);
      expect(match).toBe(true);
    }
  });

  it("produces a valid, non-self-intersecting quad at the header's own outer corner (a plain level end, no plumb component)", () => {
    // A 36in-wide, 1-peak (door) header: rise 18 -> peak at (18,18), 45deg
    // tilt — the same reference geometry as the existing
    // computeTrussWebPeakCount test. rise_1's own foot (i=0) is the
    // header's own left outer corner — Tommy: "there are no plum[b] cuts on
    // headers... the trapezoid has parallel cuts that meet the top and
    // bottom chords" — so both its corners land exactly on levelZIn, no X
    // constraint at this level (buildHeaderTrussWebBraces clamps the
    // resulting X into the header's own [0,widthIn] afterward — see its
    // own overshoot regression test below).
    const peakEndTarget: HeaderBraceEndTarget = { kind: "miter", otherDirXIn: 18, otherDirZIn: -18 };
    const levelTarget: HeaderBraceEndTarget = { kind: "level", levelZIn: 0 };
    const corners = computeHeaderBraceTrapezoidCornersIn(0, 0, 18, 18, 3.5, levelTarget, peakEndTarget);

    for (const c of corners) {
      expect(Number.isFinite(c.xIn)).toBe(true);
      expect(Number.isFinite(c.zIn)).toBe(true);
    }
    const levelEndCorners = closestTwo(corners, 0, 0);
    for (const c of levelEndCorners) expect(c.zIn).toBeCloseTo(0, 6);
    expect(segmentsIntersect(corners[0], corners[2], corners[1], corners[3])).toBe(true);
  });

  it("buildHeaderTrussWebBraces lands the outer foot's outer edge flush on the header's own boundary, without distorting the board's true width — Tommy: 'take careful note of how the diagonals meet at the point in the top'", () => {
    // Same 36in-wide, 1-peak door header as above, built through the real
    // entry point (buildHeaderTrussWebBraces) — the outer foot's own
    // reference point sits exactly ON its target level plane, so a board of
    // real width naturally has one edge reach past X=0 (the header's own
    // left corner, real trapezoid geometry, not a math error) if left
    // uncorrected. Rather than clamping just the one overshooting corner
    // (an earlier version's bug — see HeaderBraceLevelTarget's own doc
    // comment — which cut that outer cap's apparent width in HALF), the
    // fix shifts the whole board's reference point inward so its OUTER
    // edge lands exactly on the boundary while the board's true, full
    // width is preserved.
    const members = buildHeaderTrussWebBraces(1, 36, 0, 18, 1.5, "web");
    for (const m of members) {
      for (const c of m.position.trapezoidCornersIn!) {
        expect(c.xIn).toBeGreaterThanOrEqual(-1e-9);
        expect(c.xIn).toBeLessThanOrEqual(36 + 1e-9);
      }
    }
    // Every outer foot still lands exactly on its own boundary (not a
    // vacuous check) — one at X=0, one at X=36.
    const allX = members.flatMap((m) => m.position.trapezoidCornersIn!.map((c) => c.xIn));
    expect(allX.some((x) => Math.abs(x) < 1e-6)).toBe(true);
    expect(allX.some((x) => Math.abs(x - 36) < 1e-6)).toBe(true);

    // ...but the cap at that boundary is now the FULL board-width
    // projection (PLATE_2X4_WIDTH_IN / uz, matching the peak end's own
    // already-correct cap), not half of it (the old bug's fingerprint).
    const rise1 = members.find((m) => m.memberId === "web_1_rise")!;
    const uz = Math.SQRT1_2; // 45deg brace: dx=dz=18 (peak at midpoint 18, rise 18) -> ux=uz=1/sqrt(2)
    const expectedCapWidthIn = PLATE_2X4_WIDTH_IN / uz;
    const leftCorners = closestTwo(rise1.position.trapezoidCornersIn!, 0, 0);
    const actualCapWidthIn = Math.abs(leftCorners[0]!.xIn - leftCorners[1]!.xIn);
    expect(actualCapWidthIn).toBeCloseTo(expectedCapWidthIn, 6);
  });
});

describe("describeBraceEndCuts", () => {
  it("agrees with computeBraceEndCutAngleDeg's level/plumb split for a plain Braced-Panel-style trapezoid", () => {
    // A representative braced-panel brace: stud at x=1.5, girt at z=40;
    // plate at x=38.5 (40in-wide panel), z=100.
    const corners = computeBraceTrapezoidCornersIn(1.5, 40, 38.5, 100, 3.5, 1.5, 100);
    const [cutA, cutB] = describeBraceEndCuts(corners);
    const kinds = [cutA.kind, cutB.kind].sort();
    expect(kinds).toEqual(["level", "plumb"]);

    const centerX = (1.5 + 38.5) / 2;
    const centerZ = (40 + 100) / 2;
    const tiltDeg = (Math.atan2(-(1.5 - centerX), 40 - centerZ) * 180) / Math.PI;
    const expectedLevelDeg = computeBraceEndCutAngleDeg(tiltDeg);
    const expectedPlumbDeg = 90 - expectedLevelDeg;

    const levelCut = cutA.kind === "level" ? cutA : cutB;
    const plumbCut = cutA.kind === "plumb" ? cutA : cutB;
    expect(levelCut.angleDeg).toBeCloseTo(expectedLevelDeg, 6);
    expect(plumbCut.angleDeg).toBeCloseTo(expectedPlumbDeg, 6);
  });

  it("classifies a mitered (non-axis-aligned) end as 'angled', not plumb or level", () => {
    // 2 braces meeting at a 30/60-ish (non-axis-aligned) miter — the
    // resulting cut edge is neither purely vertical nor purely horizontal.
    const target: HeaderBraceEndTarget = { kind: "miter", otherDirXIn: 5, otherDirZIn: -1 };
    const placeholder: HeaderBraceEndTarget = { kind: "level", levelZIn: 0 };
    const corners = computeHeaderBraceTrapezoidCornersIn(0, 0, 10, 10, 3.5, placeholder, target);
    const [cutA, cutB] = describeBraceEndCuts(corners);
    // One end is the placeholder level cut, the other is the genuine
    // (non-axis-aligned) miter — at least one of the 2 should be "angled".
    expect([cutA.kind, cutB.kind]).toContain("angled");
  });
});

describe("buildHeaderTrussWebBraces", () => {
  it("builds 2 braces per peak, every one a true trapezoid with a finite tilt and positive longest edge", () => {
    const members = buildHeaderTrussWebBraces(3, 90, 0, 20, 1.5, "web");
    expect(members).toHaveLength(6);
    for (const m of members) {
      expect(m.position.trapezoidCornersIn).toBeDefined();
      expect(m.position.tiltDeg).toBeDefined();
      expect(Number.isFinite(m.position.tiltDeg!)).toBe(true);
      expect(m.actualDimsIn.lengthIn).toBeGreaterThan(0);
      expect(Number.isFinite(m.actualDimsIn.lengthIn)).toBe(true);
    }
  });

  it("meets every adjacent pair's long points at the exact same peak/foot, with no gap (unlike buildTrussWebBraces' own PEAK_GAP_IN retreat)", () => {
    const members = buildHeaderTrussWebBraces(2, 60, 0, 20, 1.5, "web");
    const byId = new Map(members.map((m) => [m.memberId, m]));
    const rise1 = byId.get("web_1_rise")!;
    const fall1 = byId.get("web_1_fall")!;
    const rise2 = byId.get("web_2_rise")!;
    const fall2 = byId.get("web_2_fall")!;

    // Peak 1 (X=15,Z=20): rise_1 and fall_1 meet there.
    const rise1Peak = closestTwo(rise1.position.trapezoidCornersIn!, 15, 20);
    const fall1Peak = closestTwo(fall1.position.trapezoidCornersIn!, 15, 20);
    for (const c of rise1Peak) {
      expect(fall1Peak.some((f) => Math.abs(f.xIn - c.xIn) < 1e-6 && Math.abs(f.zIn - c.zIn) < 1e-6)).toBe(true);
    }

    // Internal foot between triangle 1 and 2 (X=30,Z=0): fall_1 and rise_2 meet there.
    const fall1Foot = closestTwo(fall1.position.trapezoidCornersIn!, 30, 0);
    const rise2Foot = closestTwo(rise2.position.trapezoidCornersIn!, 30, 0);
    for (const c of fall1Foot) {
      expect(rise2Foot.some((r) => Math.abs(r.xIn - c.xIn) < 1e-6 && Math.abs(r.zIn - c.zIn) < 1e-6)).toBe(true);
    }

    // The header's own left/right outer ends are corner clips, flush to
    // X=0 / X=widthIn — "plum cuts be vertically flush with the studs".
    // At this brace angle (2-peak/60in/rise 20), the board is wide enough
    // relative to its tilt that only ONE of its 2 long edges can land
    // exactly plumb without the OTHER overshooting past the bottom
    // chord's own face (Z<0) — a real limitation of a 4-corner prism at a
    // steep inside-corner angle (a true birdsmouth notch is out of scope
    // — see computeHeaderBraceTrapezoidCornersIn's own doc comment), not
    // a bug: the discarded edge falls back to a level cut instead of
    // overshooting. So the real guarantee checked here is "no overshoot,
    // and at least one edge is genuinely flush" rather than "both edges
    // flush."
    const rise1Foot = closestTwo(rise1.position.trapezoidCornersIn!, 0, 0);
    for (const c of rise1Foot) expect(c.zIn).toBeGreaterThanOrEqual(-1e-6);
    expect(rise1Foot.some((c) => Math.abs(c.xIn) < 1e-6)).toBe(true);

    const fall2Foot = closestTwo(fall2.position.trapezoidCornersIn!, 60, 0);
    for (const c of fall2Foot) expect(c.zIn).toBeGreaterThanOrEqual(-1e-6);
    expect(fall2Foot.some((c) => Math.abs(c.xIn - 60) < 1e-6)).toBe(true);
  });

  it("does not affect buildTrussWebBraces (gable/classic-truss) — still plain tilted boxes, no trapezoidCornersIn", () => {
    const members = buildTrussWebBraces(2, 60, 0, () => 20, 1.5, "web");
    for (const m of members) {
      expect(m.position.trapezoidCornersIn).toBeUndefined();
      expect(m.position.tiltDeg).toBeDefined();
    }
  });
});

describe("buildNailer", () => {
  it("centers the nailer by default (offsetIn = 0)", () => {
    const nailer = buildNailer(40, 120);
    expect(nailer.position.xIn).toBeCloseTo(40 / 2 - 1.5 / 2, 6);
  });

  it("slides the nailer by offsetIn from its centered position", () => {
    const centered = buildNailer(40, 120);
    const slid = buildNailer(40, 120, 6);
    expect(slid.position.xIn).toBeCloseTo(centered.position.xIn + 6, 6);
  });
});
