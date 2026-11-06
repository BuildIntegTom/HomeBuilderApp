import { describe, expect, it } from "vitest";
import {
  EDITOR_GRID_IN,
  SNAP_TOLERANCE_IN,
  editorClearArea,
  moveSpecEnd,
  newDiagonalSpec,
  newHorizontalSpec,
  newVerticalSpec,
  rotateSpec,
  snapTargetsIn,
  snapValueIn,
  specAnchorLengthIn,
  specAngleDeg,
  translateSpec,
} from "./panelEditorOps";
import { buildPanelFromRecipe, recipeClearHeightIn } from "./panelRecipe";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";
import { overlappingMemberPairs } from "./memberPrism";

/** A 48in wall panel at the app's own defaults — his 4ft module, 15.5in wall. */
const PANEL = { widthIn: 48, depthIn: 15.5, heightIn: 120 };

const inArea = (spec: { fromXIn: number; fromZIn: number; toXIn: number; toZIn: number }) => {
  const area = editorClearArea(PANEL);
  const eps = 0.001;
  return (
    spec.fromXIn >= area.minXIn - eps &&
    spec.fromXIn <= area.maxXIn + eps &&
    spec.toXIn >= area.minXIn - eps &&
    spec.toXIn <= area.maxXIn + eps &&
    spec.fromZIn >= area.minZIn - eps &&
    spec.fromZIn <= area.maxZIn + eps &&
    spec.toZIn >= area.minZIn - eps &&
    spec.toZIn <= area.maxZIn + eps
  );
};

describe("editorClearArea", () => {
  it("stops a member at the post faces, not the panel edges", () => {
    const area = editorClearArea(PANEL);
    expect(area.minXIn).toBe(1.5);
    expect(area.maxXIn).toBe(46.5);
  });

  it("takes its height straight from recipeClearHeightIn", () => {
    const area = editorClearArea(PANEL);
    const { bottomZIn, topZIn } = recipeClearHeightIn(PANEL.heightIn);
    expect(area.minZIn).toBe(bottomZIn);
    expect(area.maxZIn).toBe(topZIn);
  });

  it("never inverts on a panel narrower than two posts", () => {
    const area = editorClearArea({ widthIn: 1, depthIn: 15.5, heightIn: 120 });
    expect(area.maxXIn).toBeGreaterThanOrEqual(area.minXIn);
  });
});

describe("the three new members", () => {
  it("a diagonal runs corner to corner of the clear area", () => {
    const spec = newDiagonalSpec(PANEL, { wythe: "exterior" });
    const area = editorClearArea(PANEL);
    expect(spec.kind).toBe("diagonal");
    expect([spec.fromXIn, spec.fromZIn]).toEqual([area.minXIn, area.minZIn]);
    expect([spec.toXIn, spec.toZIn]).toEqual([area.maxXIn, area.maxZIn]);
  });

  it("a vertical stands on the panel's centre LINE when the panel is empty", () => {
    const spec = newVerticalSpec(PANEL, { wythe: "exterior" });
    const area = editorClearArea(PANEL);
    /* ⚠ **22.25, not 23.25 — B30 moved this number and it is worth saying
       why.** A spec's x is the member's left FACE, and a new vertical now LIES
       FLAT (Tommy, 2026-11-05), so it is 3.5in across the panel's width rather
       than 1.5in: centred on a 48in panel it starts 1.75in before the middle.
       The old 23.25 happened to equal `buildCentreNailerStuds`' own number for
       the same panel, which this test used to check; the two no longer agree,
       because the panel's own centre stud is still a stud standing on edge and
       this is a nailer lying flat. What still holds — and is the claim worth
       keeping — is that the board's CENTRE is on the panel's centre line.

       His reason for wanting it there, per `panel_module_2ft_4ft`: the centre
       of a 48in wall panel is the seam between the two 24in deck panels below,
       so a member there carries load straight down. */
    expect(spec.fromXIn).toBe(22.25);
    expect(spec.fromXIn + 3.5 / 2).toBe(PANEL.widthIn / 2);
    expect(spec.toXIn).toBe(spec.fromXIn);
    expect(spec.fromZIn).toBe(area.minZIn);
    expect(spec.toZIn).toBe(area.maxZIn);
  });

  it("⚠ MOVES OFF the centre when his own standard panel already has a stud there", () => {
    /* The first version of this file asked for the centre unconditionally and
       the overlap test below caught it: a 48in standard panel already carries
       an intermediate stud at x=24, for the same load-path reason the editor
       wanted to put one there. Two boards in one place is his *no overlapping
       members* rule, so the default moves instead. */
    const base = buildStandardPanelMembers(PANEL.widthIn, PANEL.depthIn, PANEL.heightIn, false);
    const centreStud = base.find((m) => m.memberId.startsWith("stud_centre_"));
    expect(centreStud, "a 48in panel is expected to have an intermediate stud").toBeDefined();
    const spec = newVerticalSpec(PANEL, { wythe: "exterior", existing: base });
    expect(spec.fromXIn).not.toBe(24);
    expect(spec.fromXIn).toBeGreaterThan(editorClearArea(PANEL).minXIn);
  });

  it("⚠ an EXTERIOR member does not move an interior one — depth is not shared", () => {
    /* The wythes are 12in apart through a 15.5in panel, so a board on one face
       is no obstacle to a board on the other. Both of the interior verticals
       below land in the same bay, with an exterior board filling it or not. */
    const base = buildStandardPanelMembers(PANEL.widthIn, PANEL.depthIn, PANEL.heightIn, false);
    const bare = newVerticalSpec(PANEL, { wythe: "interior", existing: base });
    const exteriorFilled = buildPanelFromRecipe({
      name: "t",
      ...PANEL,
      added: [newVerticalSpec(PANEL, { wythe: "exterior", existing: base, id: "ext" })],
    });
    const shadowed = newVerticalSpec(PANEL, { wythe: "interior", existing: exteriorFilled });
    expect(shadowed.fromXIn).toBe(bare.fromXIn);
  });

  it("⚠ keeps clear of the girt BARS, which cross the whole depth", () => {
    /* A girt is two parts and they sit at different depths: the bars at the
       panel's ends run y 0..15.5, so they are in both wythes, while the web
       between them is y 3.5..12 and is in neither. A vertical that ignored the
       bars would be cut through at every girt row. */
    const base = buildStandardPanelMembers(PANEL.widthIn, PANEL.depthIn, PANEL.heightIn, false);
    const bars = base.filter((m) => m.memberId.includes("_bar_"));
    expect(bars.length).toBeGreaterThan(0);
    const spec = newVerticalSpec(PANEL, { wythe: "exterior", existing: base });
    for (const bar of bars) {
      const x0 = bar.position.xIn;
      const x1 = x0 + memberBoxSizeIn(bar).xIn;
      expect(spec.fromXIn + 1.5 <= x0 + 0.001 || spec.fromXIn >= x1 - 0.001, `clear of ${bar.memberId}`).toBe(true);
    }
  });

  it("all three are built, and none of them overlaps the base panel", () => {
    /* The real check: a member the editor offers must not land inside a plate,
       a skin or a post. `overlappingPairsIn` compares the true prisms. */
    const base = buildStandardPanelMembers(PANEL.widthIn, PANEL.depthIn, PANEL.heightIn, false);
    for (const make of [newDiagonalSpec, newVerticalSpec, newHorizontalSpec]) {
      for (const wythe of ["exterior", "interior"] as const) {
        const members = buildPanelFromRecipe({
          name: "t",
          ...PANEL,
          added: [make(PANEL, { wythe, existing: base, id: "m1" })],
        });
        expect(overlappingMemberPairs(members), `${make.name} ${wythe}`).toEqual([]);
      }
    }
  });

  it("puts an interior member on the far face, still inside the panel", () => {
    const members = buildPanelFromRecipe({ name: "t", ...PANEL, added: [newVerticalSpec(PANEL, { wythe: "interior", id: "m1" })] });
    const added = members.find((m) => m.memberId === "m1");
    expect(added).toBeDefined();
    expect(added!.position.yIn).toBeGreaterThan(0);
    expect(added!.position.yIn).toBeLessThan(PANEL.depthIn);
  });
});

describe("translateSpec", () => {
  const area = editorClearArea(PANEL);

  it("moves the whole board", () => {
    const spec = newVerticalSpec(PANEL, { wythe: "exterior", id: "m" });
    const moved = translateSpec(spec, -6, 0, area);
    expect(moved.fromXIn).toBe(spec.fromXIn - 6);
    expect(moved.toXIn).toBe(moved.fromXIn);
  });

  it("stops at the edge instead of changing the angle", () => {
    const spec = newDiagonalSpec(PANEL, { wythe: "exterior", id: "m" });
    const before = specAngleDeg(spec);
    const moved = translateSpec(spec, 500, 500, area);
    expect(inArea(moved)).toBe(true);
    /* ⚠ The whole reason the shift is clamped rather than the endpoints: a
       board shoved into a corner keeps the angle it was drawn at. */
    expect(specAngleDeg(moved)).toBeCloseTo(before, 6);
    expect(specAnchorLengthIn(moved)).toBeCloseTo(specAnchorLengthIn(spec), 6);
  });

  it("lands on the eighth-inch grid", () => {
    const moved = translateSpec(newVerticalSpec(PANEL, { wythe: "exterior", id: "m" }), 0.3, 0, area);
    expect((moved.fromXIn / EDITOR_GRID_IN) % 1).toBeCloseTo(0, 9);
  });
});

describe("moveSpecEnd", () => {
  const area = editorClearArea(PANEL);

  it("leaves the other end exactly where it was", () => {
    const spec = newVerticalSpec(PANEL, { wythe: "exterior", id: "m" });
    const moved = moveSpecEnd(spec, "to", 40, 60, area);
    expect(moved.fromXIn).toBe(spec.fromXIn);
    expect(moved.fromZIn).toBe(spec.fromZIn);
  });

  it("⚠ RETYPES a straight board that is no longer on an axis", () => {
    /* `buildStraightFromSpec` draws an axis-aligned box from the dominant run,
       so a `straight` spec with both runs non-zero renders somewhere its own
       numbers do not describe. Dragging one end off-axis has to change the
       kind. */
    const vertical = newVerticalSpec(PANEL, { wythe: "exterior", id: "m" });
    expect(vertical.kind).toBe("straight");
    const dragged = moveSpecEnd(vertical, "to", 40, area.maxZIn, area);
    expect(dragged.kind).toBe("diagonal");
  });

  it("leaves a straight board straight when it stays on an axis", () => {
    const vertical = newVerticalSpec(PANEL, { wythe: "exterior", id: "m" });
    const shortened = moveSpecEnd(vertical, "to", vertical.toXIn, 60, area);
    expect(shortened.kind).toBe("straight");
  });

  it("clamps into the clear area", () => {
    const moved = moveSpecEnd(newVerticalSpec(PANEL, { wythe: "exterior", id: "m" }), "to", 999, 999, area);
    expect(inArea(moved)).toBe(true);
  });
});

describe("rotateSpec", () => {
  const area = editorClearArea(PANEL);

  it("turns a horizontal tie into a vertical at 90 degrees", () => {
    const { spec } = rotateSpec(newHorizontalSpec(PANEL, { wythe: "exterior", id: "m" }), 90, area);
    expect(Math.abs(spec.toXIn - spec.fromXIn)).toBeCloseTo(0, 6);
    expect(spec.kind).toBe("straight");
  });

  it("⚠ keeps the ANGLE and gives up LENGTH when the board will not fit", () => {
    /* A corner-to-corner diagonal is 124in on this panel and the panel is only
       45in of clear width, so turning it across cannot keep its length. What it
       must not do is keep the length and come back at the wrong angle. */
    const diagonal = newDiagonalSpec(PANEL, { wythe: "exterior", id: "m" });
    const wanted = specAngleDeg(diagonal) + 90;
    const { spec, shortenedByIn } = rotateSpec(diagonal, 90, area);
    expect(specAnchorLengthIn(diagonal)).toBeGreaterThan(area.maxXIn - area.minXIn);
    expect(shortenedByIn).toBeGreaterThan(0);
    expect(specAngleDeg(spec)).toBeCloseTo(wanted > 180 ? wanted - 360 : wanted, 0);
    expect(inArea(spec)).toBe(true);
  });

  it("a 45in tie stood upright in a 115in panel does NOT shorten", () => {
    /* The first version of the test above assumed this one shortened, and it
       does not — the clear height is 115.5in against the tie's 45in. Worth its
       own case, because "it fit" is the common answer and a `shortenedByIn`
       that is always positive would be a bug nobody noticed. */
    const { spec, shortenedByIn } = rotateSpec(newHorizontalSpec(PANEL, { wythe: "exterior", id: "m" }), 90, area);
    expect(shortenedByIn).toBeCloseTo(0, 6);
    expect(specAnchorLengthIn(spec)).toBeCloseTo(area.maxXIn - area.minXIn, 6);
  });

  it("reports no shortening when the rotation fits", () => {
    const short = moveSpecEnd(newHorizontalSpec(PANEL, { wythe: "exterior", id: "m" }), "to", 12, 60, area);
    const { shortenedByIn } = rotateSpec({ ...short, kind: "straight" }, 90, area);
    expect(shortenedByIn).toBeCloseTo(0, 6);
  });

  it("rotates about the midpoint, so the member does not wander", () => {
    const spec = newDiagonalSpec(PANEL, { wythe: "exterior", id: "m" });
    const midBefore = [(spec.fromXIn + spec.toXIn) / 2, (spec.fromZIn + spec.toZIn) / 2];
    const { spec: turned } = rotateSpec(spec, 37, area);
    expect((turned.fromXIn + turned.toXIn) / 2).toBeCloseTo(midBefore[0]!, 1);
    expect((turned.fromZIn + turned.toZIn) / 2).toBeCloseTo(midBefore[1]!, 1);
  });

  it("⚠ a straight board rotated by an odd angle becomes a diagonal", () => {
    const { spec } = rotateSpec(newHorizontalSpec(PANEL, { wythe: "exterior", id: "m" }), 30, area);
    expect(spec.kind).toBe("diagonal");
  });

  it("stays inside the panel across a full sweep, from either kind", () => {
    for (const seed of [newDiagonalSpec(PANEL, { wythe: "exterior", id: "m" }), newHorizontalSpec(PANEL, { wythe: "exterior", id: "m" }), newVerticalSpec(PANEL, { wythe: "exterior", id: "m" })]) {
      for (let deg = -180; deg <= 180; deg += 7) {
        const { spec } = rotateSpec(seed, deg, area);
        expect(inArea(spec), `${seed.kind} by ${deg}`).toBe(true);
      }
    }
  });

  it("four 90-degree turns bring a fitting member back where it started", () => {
    const seed = moveSpecEnd(newHorizontalSpec(PANEL, { wythe: "exterior", id: "m" }), "to", 12, newHorizontalSpec(PANEL, { wythe: "exterior", id: "m" }).fromZIn, editorClearArea(PANEL));
    let spec = seed;
    for (let i = 0; i < 4; i++) spec = rotateSpec(spec, 90, area).spec;
    expect(specAnchorLengthIn(spec)).toBeCloseTo(specAnchorLengthIn(seed), 6);
    expect(Math.abs(spec.fromXIn - seed.fromXIn)).toBeLessThanOrEqual(EDITOR_GRID_IN);
    expect(Math.abs(spec.fromZIn - seed.fromZIn)).toBeLessThanOrEqual(EDITOR_GRID_IN);
  });
});

describe("snapTargetsIn", () => {
  const area = editorClearArea(PANEL);

  it("offers both faces and the centre of a real member", () => {
    const members = buildStandardPanelMembers(PANEL.widthIn, PANEL.depthIn, PANEL.heightIn, true);
    const nailer = members.find((m) => m.memberId.includes("nailer"));
    expect(nailer).toBeDefined();
    const { xIn } = snapTargetsIn(members, area);
    const x0 = nailer!.position.xIn;
    expect(xIn).toContain(x0);
    /* ⚠ "flush with either side ... and center" — his three words, all three
       present for one member. */
    /* 3.5in across, not 1.5in: B30 lays the nailer flat, so its far FACE and
       its CENTRE are both measured off its wide dimension. */
    expect(xIn.some((v) => Math.abs(v - (x0 + 3.5)) < 0.001)).toBe(true);
    expect(xIn.some((v) => Math.abs(v - (x0 + 1.75)) < 0.001)).toBe(true);
  });

  it("⚠ offers nothing off a diagonal, whose box faces are not on the board", () => {
    /* ⚠ The first version of this compared against a plain panel and failed for
       the wrong reason: a diagonal SUPPRESSES the intermediate studs, so the two
       member lists differed by those studs rather than by the brace. Compared
       against the same list with the brace taken out, which is what the claim
       actually is. */
    const withBrace = buildPanelFromRecipe({
      name: "t",
      ...PANEL,
      added: [newDiagonalSpec(PANEL, { wythe: "exterior", id: "d1" })],
    });
    expect(withBrace.some((m) => m.memberId === "d1")).toBe(true);
    const withoutBrace = withBrace.filter((m) => m.memberId !== "d1");
    expect(snapTargetsIn(withBrace, area)).toEqual(snapTargetsIn(withoutBrace, area));
  });

  it("never offers a target outside the clear area", () => {
    const members = buildStandardPanelMembers(PANEL.widthIn, PANEL.depthIn, PANEL.heightIn, true);
    const { xIn, zIn } = snapTargetsIn(members, area);
    for (const v of xIn) expect(v).toBeGreaterThanOrEqual(area.minXIn - 0.001);
    for (const v of xIn) expect(v).toBeLessThanOrEqual(area.maxXIn + 0.001);
    for (const v of zIn) expect(v).toBeGreaterThanOrEqual(area.minZIn - 0.001);
    for (const v of zIn) expect(v).toBeLessThanOrEqual(area.maxZIn + 0.001);
  });

  it("always offers the posts and the plates themselves", () => {
    const { xIn, zIn } = snapTargetsIn([], area);
    expect(xIn).toEqual([area.minXIn, area.maxXIn]);
    expect(zIn).toEqual([area.minZIn, area.maxZIn]);
  });
});

describe("snapValueIn", () => {
  it("takes the nearest target within reach", () => {
    expect(snapValueIn(23.6, [12, 24, 36])).toBe(24);
  });

  it("leaves a value alone when nothing is within reach", () => {
    expect(snapValueIn(30, [12, 48], 1)).toBe(30);
  });

  it("reaches exactly half a 2x4's width by default", () => {
    expect(SNAP_TOLERANCE_IN).toBe(1.75);
    expect(snapValueIn(24 + 1.7, [24])).toBe(24);
    expect(snapValueIn(24 + 1.8, [24])).toBe(24 + 1.8);
  });
});
