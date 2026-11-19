import { describe, expect, it } from "vitest";
import { applyRoofPlanMitre, roofMitreKeptRangeAtXIn } from "./roofPlanMitre";
import { NO_FLOOR_ROOF_MITRE } from "./floorRoofPanelMitreTypes";
import { buildFloorRoofPanelMembers, type FloorRoofPanelOptions } from "./floorRoofPanelMembers";
import { memberIsOblique } from "./memberPrism";
import { memberLocalCornersIn } from "./panelMemberHelpers";
import type { PanelMember } from "./componentSchema";

/* ──────────────────────────────────────────────────────────────────────────
   CUTTING A ROOF PANEL WITH A PLUMB PLANE — his answer, 2026-11-18

   "i dont think there should be any wedges? ... i imagined roof panels to be
    cut plumb vertically when plan view looking down on the building. this
    would in reality make an elongated octagon roof."

   ⚠ The floor deck has been cut to the building since 2026-11-16 and the roof
   refused, because a roof panel's end cuts are in the Y-Z plane and a plan
   mitre varies with X. A PLUMB cut is a pure shift in Z across the width — the
   section keeps its shape and slides — so the two compose, and a roof joist's
   five-cornered eave section survives where no quad mechanism could carry it.
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

  it("⚠ a joist's FIVE-cornered eave section slides rather than reshaping", () => {
    const top = byId(cut.members, "joist-left-top")!;
    const before = byId(square, "joist-left-top")!;
    expect(top.position.sectionCornersIn).toHaveLength(5);
    /* The shape is identical — every corner moved by the SAME amount, because
       a vertical plane cuts a constant distance at one x. */
    /* ⚠ The ring is CLAMPED, not shifted: the corners below the cut land ON
       the cut line and the corners above it do not move at all. A uniform
       shift was the first version, and it carried the whole eave assembly
       inboard instead of cutting it off. */
    const line = Math.min(...top.position.sectionCornersIn!.map((c) => c.zIn));
    for (const [i, c] of top.position.sectionCornersIn!.entries()) {
      const was = before.position.sectionCornersIn![i]!.zIn;
      expect(c.zIn).toBeCloseTo(Math.max(was, line), 9);
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

  it("the shop can read the cut off the member's own note", () => {
    const joist = byId(cut.members, "joist-left-bottom")!;
    expect(joist.notes).toContain("plan mitre");
    expect(joist.notes).toContain("dual bevel");
  });

  it("a square panel comes back byte for byte", () => {
    const none = applyRoofPlanMitre(square, { widthIn: 48, lengthIn: 192, mitreIn: NO_FLOOR_ROOF_MITRE });
    expect(none.members).toEqual(square);
    expect(none.droppedMemberIds).toEqual([]);
  });
});
