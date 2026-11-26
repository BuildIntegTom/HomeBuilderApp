import { describe, expect, it } from "vitest";
import { applyRoofPlanMitre, roofMitreKeptRangeAtXIn } from "./roofPlanMitre";
import { NO_FLOOR_ROOF_MITRE } from "./floorRoofPanelMitreTypes";
import { buildFloorRoofPanelMembers, type FloorRoofPanelOptions } from "./floorRoofPanelMembers";
import { memberIsOblique } from "./memberPrism";
import { boxXExtentFieldOf, memberBoxSizeIn, memberLocalCornersIn } from "./panelMemberHelpers";
import type { PanelMember, SectionSpacePoint2D } from "./componentSchema";

/** Twice the area of a (Y,Z) ring, unsigned — the shoelace sum. */
const ringArea = (ring: SectionSpacePoint2D[]): number =>
  Math.abs(
    ring.reduce((sum, a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      return sum + (a.yIn * b.zIn - b.yIn * a.zIn);
    }, 0),
  ) / 2;

/**
 * An INDEPENDENT Sutherland-Hodgman clip of a ring to `zIn >= limitIn`,
 * written here rather than imported so that the test re-derives the answer
 * instead of re-stating the implementation's.
 */
const clipAbove = (ring: SectionSpacePoint2D[], limitIn: number): SectionSpacePoint2D[] => {
  const out: SectionSpacePoint2D[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const aIn = a.zIn >= limitIn - 1e-12;
    const bIn = b.zIn >= limitIn - 1e-12;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      const t = (limitIn - a.zIn) / (b.zIn - a.zIn);
      out.push({ yIn: a.yIn + t * (b.yIn - a.yIn), zIn: limitIn });
    }
  }
  return out;
};

/* ──────────────────────────────────────────────────────────────────────────
   CUTTING A ROOF PANEL WITH A PLUMB PLANE — his answer, 2026-11-18

   "i dont think there should be any wedges? ... i imagined roof panels to be
    cut plumb vertically when plan view looking down on the building. this
    would in reality make an elongated octagon roof."

   ⚠ The floor deck has been cut to the building since 2026-11-16 and the roof
   refused, because a roof panel's end cuts are in the Y-Z plane and a plan
   mitre varies with X.

   ⚠ **AND THE FIRST VERSION'S READING OF "PLUMB" WAS WRONG, CORRECTED
   2026-11-25.** It said: *"A PLUMB cut is a pure shift in Z across the width
   — the section keeps its shape and slides."* Both halves are false on a
   roof panel, and the tests below used to pin them:

   - **It is not a bound on Z.** Panel Z runs up the slope and panel Y runs
     perpendicular to the roof, so a plane vertical in the WORLD is
     `zIn + yIn * (pitch/12) = constant` in the panel's own axes. At 4:12
     across 15 1/2in that is **5.17in of span** between a plumb cut and one
     square to the roof surface. Every other end cut in the builder already
     does this — `eaveCut.fasciaAtYIn` is literally `-yIn * tan`.
   - **The section does not keep its shape.** Clipping a polygon with a
     half-plane ADDS a vertex. Moving the outside corners onto the line
     instead is the same region only where the crossing edges run at constant
     depth, which the eave joist's taper kink and every plain box ring break.

   Measured cost of the two together, on the 16ft Octagon's own mitred roof
   panel: **21 pairs of members in the same volume**, among them the eave lid
   skin inside both left joists and an anti-twist web inside its own flanges.
   ────────────────────────────────────────────────────────────────────────── */

const ROOF: FloorRoofPanelOptions = {
  kind: "roof",
  widthIn: 48,
  depthIn: 15.5,
  lengthIn: 192,
  structuralGirtEnds: [],
  pitchIn12: 4,
  bearingSeatDepthIn: 15.5,
};

/** A 45° chamfer taking the eave end back across the panel's width. */
const CHAMFER = { startNearIn: 0, startFarIn: 48, endNearIn: 0, endFarIn: 0 };

describe("⚠ the span the cut keeps at one position across the width", () => {
  it("interpolates between the two corners it was measured at", () => {
    expect(roofMitreKeptRangeAtXIn(CHAMFER, 48, 192, 24).startIn).toBe(24);
    expect(roofMitreKeptRangeAtXIn(CHAMFER, 48, 192, 48).startIn).toBe(48);
  });

  it("⚠ AN UNCUT END IS UNBOUNDED, not bounded at the panel's nominal end", () => {
    /* The eave fascia hangs to NEGATIVE z by the depth times the pitch — it is
       the rafter tail. A square end bounded at 0 would saw it off on every
       panel in the building, which is exactly what the byte-for-byte test
       below caught when this returned 0. */
    expect(roofMitreKeptRangeAtXIn(CHAMFER, 48, 192, 0)).toEqual({
      startIn: Number.NEGATIVE_INFINITY,
      endIn: Number.POSITIVE_INFINITY,
    });
    expect(roofMitreKeptRangeAtXIn(NO_FLOOR_ROOF_MITRE, 48, 192, 24)).toEqual({
      startIn: Number.NEGATIVE_INFINITY,
      endIn: Number.POSITIVE_INFINITY,
    });
  });

  it("⚠ and the position CLAMPS, because a member can overhang its panel by float noise", () => {
    /* Unclamped, a board sitting a thousandth past the corner would be cut
       past the line the corner was measured at. */
    expect(roofMitreKeptRangeAtXIn(CHAMFER, 48, 192, 60).startIn).toBe(48);
    expect(roofMitreKeptRangeAtXIn(CHAMFER, 48, 192, -5).startIn).toBe(Number.NEGATIVE_INFINITY);
  });

  it("the tall end is measured BACK from the panel's far end", () => {
    const tall = { startNearIn: 0, startFarIn: 0, endNearIn: 12, endFarIn: 36 };
    expect(roofMitreKeptRangeAtXIn(tall, 48, 192, 0).endIn).toBe(180);
    expect(roofMitreKeptRangeAtXIn(tall, 48, 192, 48).endIn).toBe(156);
  });
});

describe("⚠ what the cut does to a roof panel's members", () => {
  const square = buildFloorRoofPanelMembers(ROOF);
  const cut = applyRoofPlanMitre(square, { widthIn: 48, lengthIn: 192, mitreIn: CHAMFER });
  const byId = (members: PanelMember[], id: string) => members.find((m) => m.memberId === id);

  it("⚠ every member is still a prism the audit can measure — nothing is left uncut", () => {
    /* `uncutMemberIds` is the one refusal left after the old
       `floorRoofMitreUnsupportedReason` went: a member whose shape runs
       through an axis a plumb cut cannot touch. No roof member does today,
       and this is what makes adding one a visible failure. */
    expect(cut.uncutMemberIds).toEqual([]);
  });

  it("⚠ a joist's FIVE-cornered eave section is CLIPPED, and the clip is exact — 2026-11-25", () => {
    /* ⚠ **This test used to assert the defect.** It read *"the shape is
       identical — every corner moved by the SAME amount"*, then
       *"the ring is CLAMPED"*, and checked `max(was, line)` corner by corner.
       Clamping a corner moves it along Z at a FIXED DEPTH, which is the true
       clip only where the crossing edge runs at constant depth. This ring is
       the one `clampIsApproximate` has always named as the exception: its
       taper kink sits at its own depth, so an edge crosses the cut line
       diagonally and the clamp keeps area the saw removed.

       So the assertion is now the honest one — the ring equals an
       INDEPENDENT Sutherland-Hodgman clip, re-derived here rather than
       re-stated from the implementation. Area, because the two agree as
       REGIONS: the production ring carries corners duplicated onto the cut
       line so that it can pair up with the far ring corner for corner, and
       those have no area. */
    /* ⚠ **A cut that lands INSIDE the taper**, which `CHAMFER` does not: its
       near face is at x = 0 where this mitre cuts nothing at all, so reading
       `joist-left-top` off it would have passed while measuring no cut. The
       top chord's eave corners sit at 2.372in of span and its seat corner at
       16.339in, so 6in lands between them — diagonally across the edge that
       joins them, which is the whole point. */
    const taper = applyRoofPlanMitre(square, {
      widthIn: 48,
      lengthIn: 192,
      mitreIn: { startNearIn: 6, startFarIn: 9, endNearIn: 0, endFarIn: 0 },
    });
    const top = byId(taper.members, "joist-left-top")!;
    const before = byId(square, "joist-left-top")!;
    const line = 6;

    const clipped = clipAbove(before.position.sectionCornersIn!, line);
    expect(ringArea(top.position.sectionCornersIn!)).toBeCloseTo(ringArea(clipped), 9);

    /* And it is a real difference, not a tidier spelling of the same region:
       the clamp this replaces is out by **6.38 sq in** of chord section here.

       ⚠ **And it errs in BOTH directions, which is worth knowing.** On this
       ring it UNDER-states the chord: clamping drags the outside corner
       straight up to the cut line at its own depth (y = 11.31in), where the
       true cut face reaches y = 13.78in. On a plain box ring — an anti-twist
       girt's web — it over-states instead, keeping the member's whole 15 1/2in
       depth where the cut leaves 0.72in. So the clamp is not conservative; it
       is simply a different solid. */
    const clamped = before.position.sectionCornersIn!.map((c) => ({ ...c, zIn: Math.max(c.zIn, line) }));
    expect(Math.abs(ringArea(clamped) - ringArea(clipped))).toBeCloseTo(6.377, 3);

    /* Nothing is left on the cut side of the line. */
    for (const c of top.position.sectionCornersIn!) expect(c.zIn).toBeGreaterThanOrEqual(line - 1e-9);
  });

  it("⚠ the two rings still pair up corner for corner, however differently the planes fall", () => {
    /* The constraint that makes the clip awkward and the augmented vertex
       list necessary: a prism's corner `i` is joined to its corner `i + n`,
       so a near ring clipped to a triangle and a far ring left a quad would
       not be a solid at all. */
    for (const m of cut.members) {
      if (!m.position.sectionFarCornersIn) continue;
      expect(m.position.sectionCornersIn, m.memberId).toHaveLength(m.position.sectionFarCornersIn.length);
      expect(m.position.sectionCornersIn!.length, m.memberId).toBeGreaterThanOrEqual(3);
    }
  });

  it("⚠ the two X faces differ, which is what makes it an OBLIQUE prism", () => {
    const joist = byId(cut.members, "joist-left-bottom")!;
    expect(joist.position.sectionFarCornersIn).toBeDefined();
    expect(memberIsOblique(joist)).toBe(true);
    /* And the audit sees a solid with 2 rings of corners, not one. */
    expect(memberLocalCornersIn(joist)).toHaveLength(
      joist.position.sectionCornersIn!.length + joist.position.sectionFarCornersIn!.length,
    );
  });

  it("⚠ the EAVE end moves and the TALL end does not, on a chamfer that only cuts one", () => {
    /* ⚠ The RIGHT joist, because this chamfer starts at x = 0: the left
       joist's own near face is at the uncut corner and is supposed not to
       move. Reading it would have passed for the wrong reason. */
    const joist = byId(cut.members, "joist-right-bottom")!;
    const before = byId(square, "joist-right-bottom")!;
    const lowZ = (m: PanelMember) => Math.min(...m.position.sectionCornersIn!.map((c) => c.zIn));
    const highZ = (m: PanelMember) => Math.max(...m.position.sectionCornersIn!.map((c) => c.zIn));
    expect(lowZ(joist)).toBeGreaterThan(lowZ(before));
    expect(highZ(joist)).toBeCloseTo(highZ(before), 9);
  });

  it("⚠ a piece whose stated LENGTH is its span gets a new long point; one whose length is not, does not", () => {
    const joist = byId(cut.members, "joist-right-bottom")!;
    const beforeJoist = byId(square, "joist-right-bottom")!;
    expect(joist.actualDimsIn.lengthIn).toBeLessThan(beforeJoist.actualDimsIn.lengthIn);
    /* A lid face board's stated length is its PLUMB EDGE HEIGHT, across the
       panel's depth — the mitre changes its shape, not that number, and
       rewriting it would put a figure on a cut list the part does not have. */
    const face = byId(cut.members, "lid-start-face-0");
    if (face) expect(face.actualDimsIn.lengthIn).toBe(byId(square, "lid-start-face-0")!.actualDimsIn.lengthIn);
  });

  it("⚠ a member the cut consumed is DROPPED and named, never silently absent", () => {
    /* A cut deep enough to pass the whole eave assembly: on a panel at an
       octagon's corner this is a real case, and a cut list that quietly loses
       a board is how a drawing and a shop part company.

       ⚠ This is also the test that caught the first version, which SHIFTED
       instead of clamping: it carried the eave lid 190in inboard and produced
       a full eave assembly at the new end, as though the panel had been
       redesigned rather than cut. Nothing was dropped and nothing looked
       wrong in a count. */
    const deep = applyRoofPlanMitre(square, {
      widthIn: 48,
      lengthIn: 192,
      mitreIn: { startNearIn: 190, startFarIn: 190, endNearIn: 0, endFarIn: 0 },
    });
    expect(deep.droppedMemberIds.length).toBeGreaterThan(0);
    expect(deep.members.length + deep.droppedMemberIds.length).toBe(square.length);
    for (const id of deep.droppedMemberIds) expect(byId(deep.members, id)).toBeUndefined();
    /* And every lid board at the eave is one of them. */
    expect(deep.droppedMemberIds).toContain("lid-start-skin");
  });

  it("⚠ a member consumed at ONE face and not the other SURVIVES — it is a triangle, not a gap", () => {
    /* The cut that distinguishes "gone" from "tapered to nothing at one end".
       A shallow chamfer reaches past the eave lid at the far corner and not at
       the near one, so the lid is still a real board: it runs out to a point.
       Dropping it there would take a board off the cut list that the shop has
       to make, and nothing on a count would look wrong. */
    const shallow = applyRoofPlanMitre(square, {
      widthIn: 48,
      lengthIn: 192,
      mitreIn: { startNearIn: 0, startFarIn: 5, endNearIn: 0, endFarIn: 0 },
    });
    expect(shallow.droppedMemberIds).not.toContain("lid-start-skin");
    const skin = byId(shallow.members, "lid-start-skin")!;
    /* One face has run out and the other has not, which is what makes it
       oblique rather than absent. */
    const spanOf = (ring: { zIn: number }[]) =>
      Math.max(...ring.map((c) => c.zIn)) - Math.min(...ring.map((c) => c.zIn));
    expect(spanOf(skin.position.sectionFarCornersIn!)).toBeCloseTo(0, 9);
    expect(spanOf(skin.position.sectionCornersIn!)).toBeGreaterThan(0);
  });

  it("⚠ no member's stated LENGTH is both its span and its extent across the width", () => {
    /* The one case where the span long point and the X trim would want to
       write the same `actualDimsIn` field, and `applyRoofPlanMitre` says so
       in a comment rather than letting one quietly win. Pinned here so that a
       member which ever becomes that shape fails a test instead of losing a
       number. */
    for (const m of square) {
      const lengthIsSpan = Math.abs(memberBoxSizeIn(m).zIn - m.actualDimsIn.lengthIn) <= 1e-9;
      if (lengthIsSpan) expect(boxXExtentFieldOf(m), m.memberId).not.toBe("lengthIn");
    }
  });

  it("the shop can read the cut off the member's own note", () => {
    const joist = byId(cut.members, "joist-left-bottom")!;
    expect(joist.notes).toContain("plan mitre");
    expect(joist.notes).toContain("dual bevel");
  });

  it("⚠ THE CUT SHORTENS A BOARD ACROSS THE WIDTH, not only along the span — 2026-11-25", () => {
    /* ⚠ **The defect: a board consumed at one X face and whole at the other
       was left spanning the full width.** Its near ring collapsed to a line
       and its far ring stayed, and a prism between those two is a long wedge
       sweeping the panel — material the saw took away, sitting where the
       joists are. On the 16ft Octagon the eave lid skin is 3/4in of plywood
       in a 21.5in-deep cut, so it survives over 0.755in of the panel's
       20.375in width and was claiming all of it.

       A 45deg chamfer here reaches past the eave lid at x = 48 and not at
       x = 0, so the lid skin is exactly that case. */
    const skin = byId(cut.members, "lid-start-skin")!;
    const beforeSkin = byId(square, "lid-start-skin")!;
    expect(memberBoxSizeIn(beforeSkin).xIn).toBeCloseTo(48, 9);
    /* 3/4in of plywood in a cut that deepens by a full inch per inch of
       width: it is gone over all but the first 0.79in. */
    expect(memberBoxSizeIn(skin).xIn).toBeCloseTo(0.75 / (12 / Math.hypot(12, 4)), 6);
    expect(skin.position.xIn).toBe(0);

    /* ⚠ **And the surviving piece MOVES when the cut runs the other way**,
       which is the half a width alone would not catch: mirror the chamfer and
       the sliver is at the far corner instead, not at x = 0 with a new size. */
    const mirrored = applyRoofPlanMitre(square, {
      widthIn: 48,
      lengthIn: 192,
      mitreIn: { startNearIn: 48, startFarIn: 0, endNearIn: 0, endFarIn: 0 },
    });
    const mirroredSkin = byId(mirrored.members, "lid-start-skin")!;
    expect(mirroredSkin.position.xIn).toBeGreaterThan(47);
    expect(mirroredSkin.position.xIn + memberBoxSizeIn(mirroredSkin).xIn).toBeCloseTo(48, 6);
    /* ⚠ And it is the sheet's OWN X field that shrank. A flat sheet's X is
       its `lengthIn`; reading that off by hand would have resized a lid face
       board through its depth instead — see `boxXExtentFieldOf`. */
    expect(boxXExtentFieldOf(skin)).toBe("lengthIn");
    expect(skin.actualDimsIn.widthIn).toBe(beforeSkin.actualDimsIn.widthIn);
  });

  it("a square panel comes back byte for byte", () => {
    const none = applyRoofPlanMitre(square, { widthIn: 48, lengthIn: 192, mitreIn: NO_FLOOR_ROOF_MITRE });
    expect(none.members).toEqual(square);
    expect(none.droppedMemberIds).toEqual([]);
  });

  it("⚠ and byte for byte WITH a pitch too — the plumb slope must not touch an uncut panel", () => {
    const none = applyRoofPlanMitre(square, {
      widthIn: 48,
      lengthIn: 192,
      mitreIn: NO_FLOOR_ROOF_MITRE,
      pitchIn12: 4,
    });
    expect(none.members).toEqual(square);
  });
});

describe("⚠ THE CUT IS PLUMB, AND A ROOF PANEL IS TILTED — 2026-11-25", () => {
  const square = buildFloorRoofPanelMembers(ROOF);
  const byId = (members: PanelMember[], id: string) => members.find((m) => m.memberId === id);
  /** Where a corner sits along the PLUMB span: vertical in the world. */
  const plumbW = (c: { yIn: number; zIn: number }) => c.zIn + c.yIn * (4 / 12);

  const plumb = applyRoofPlanMitre(square, { widthIn: 48, lengthIn: 192, mitreIn: CHAMFER, pitchIn12: 4 });
  const square_to_panel = applyRoofPlanMitre(square, { widthIn: 48, lengthIn: 192, mitreIn: CHAMFER });

  it("⚠ a cut face has CONSTANT plumb span — it is one vertical plane", () => {
    /* The joist at the DEEP end of the chamfer, so the cut really reaches it.
       Every corner the cut touched lies on `kept.startIn` measured in the
       plumb span, and nothing is left on the far side of that plane. */
    const joist = byId(plumb.members, "joist-right-bottom")!;
    const keptIn = roofMitreKeptRangeAtXIn(CHAMFER, 48, 192, joist.position.xIn).startIn;
    const ws = joist.position.sectionCornersIn!.map(plumbW);
    for (const w of ws) expect(w).toBeGreaterThanOrEqual(keptIn - 1e-9);
    expect(Math.min(...ws)).toBeCloseTo(keptIn, 9);
  });

  it("⚠ and bounding Z instead SAWED THROUGH the panel at an angle, deepest at the underside", () => {
    /* The size and the DIRECTION of the old defect, in the units a shop would
       notice. Bounding Z cuts square to the roof SURFACE, so the further in
       through the panel's depth, the further up the slope the cut lands — it
       takes span a vertical plane leaves standing, by `depth * pitch/12`.
       On this 2x6 chord's own 5 1/2in that is 1.833in; across the panel's
       15 1/2in it is **5.17in**, which is the figure that matters, because the
       mitre is what makes the roof match the building's plan outline and a
       cut leaning 5in through the panel does not.
       ⚠ It also explains why this defect was invisible: the error is ZERO at
       the panel's own top face, which is where every number on a drawing or a
       sheet is measured. */
    const lowZ = (m: PanelMember) => Math.min(...m.position.sectionCornersIn!.map((c) => c.zIn));
    const zBound = byId(square_to_panel.members, "joist-right-bottom")!;
    const vertical = byId(plumb.members, "joist-right-bottom")!;
    expect(lowZ(zBound) - lowZ(vertical)).toBeCloseTo(5.5 * (4 / 12), 6);

    /* The top face of the panel agrees under both readings, exactly. */
    const topFaceZ = (m: PanelMember) =>
      Math.min(...m.position.sectionCornersIn!.filter((c) => c.yIn <= 1e-9).map((c) => c.zIn));
    expect(topFaceZ(zBound)).toBeCloseTo(topFaceZ(vertical), 9);
  });

  it("⚠ it is the same slope every OTHER end cut in this builder already uses", () => {
    /* Not a reading: the eave fascia and the plumb tall-end plate were built
       plumb from the start, so their rings have a constant plumb span on each
       face while their Z spans 5.17in. If this ever stops holding, the mitre
       is no longer cutting on the same plane as the panel's own ends. */
    const fascia = byId(square, "lid-start-skin")!;
    const ws = fascia.position.sectionCornersIn!.map(plumbW);
    const faces = [...new Set(ws.map((w) => Number(w.toFixed(6))))];
    expect(faces).toHaveLength(2);
    expect(Math.abs(faces[0]! - faces[1]!)).toBeCloseTo(0.75 / (12 / Math.hypot(12, 4)), 6);
  });

  it("⚠ THE CLIP IS EXACT for every member of the panel the app really builds", () => {
    /* `approximateMemberIds` is the module's own confession that a face was
       clamped rather than clipped, and before 2026-11-25 the 16ft Octagon's
       mitred roof panel had **6 of its 23 members** in it: both right joists,
       three tall-end lid boards and a wedge cheek. The clip takes it to zero,
       and `clipRingToKept` refusing its own answer would put a member back —
       so this is the one assertion that covers both the clip and its guard.

       The real panel: a 20.375in-wide, 202.386in-long roof panel at the 16ft
       Octagon's corner, cut 21.477in at one edge and nothing at the other. */
    const real = buildFloorRoofPanelMembers({ ...ROOF, widthIn: 20.375, lengthIn: 202.386 });
    const cutReal = applyRoofPlanMitre(real, {
      widthIn: 20.375,
      lengthIn: 202.386,
      mitreIn: { startNearIn: 21.477, startFarIn: 0, endNearIn: 21.477, endFarIn: 0 },
      pitchIn12: 4,
    });
    expect(cutReal.approximateMemberIds).toEqual([]);
    expect(cutReal.uncutMemberIds).toEqual([]);
    /* And it really is cutting: a third of the panel's boards are consumed. */
    expect(cutReal.droppedMemberIds.length).toBeGreaterThan(10);
  });

  it("⚠ a flat deck is the one case where plumb and square-to-the-panel agree", () => {
    /* Which is why no pitch means slope 0 — a correct answer for the floor,
       not a fallback. */
    const flat = applyRoofPlanMitre(square, { widthIn: 48, lengthIn: 192, mitreIn: CHAMFER, pitchIn12: 0 });
    expect(flat.members).toEqual(square_to_panel.members);
  });
});
