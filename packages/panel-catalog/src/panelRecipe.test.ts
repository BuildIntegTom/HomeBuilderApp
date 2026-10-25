import { describe, expect, it } from "vitest";
import { buildPanelFromRecipe, recipeClearHeightIn, wytheInsetYIn } from "./panelRecipe";
import {
  BRACE_PAIR_PATTERNS,
  BRACE_SCREWS_PER_DIAGONAL,
  BRACE_SCREW_LENGTH_IN,
  DEFAULT_BRACE_PAIR_PATTERN,
  bracePairAddedMembers,
} from "./bracePairPatterns";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";
import { overlappingPairsIn } from "./memberOverlap.test";

const W = 48;
const D = 15.5;
const H = 96;

describe("⚠ a recipe with nothing added IS the standard panel", () => {
  it("member for member, byte for byte", () => {
    /* The whole value of composition is that the base is untouched. If the
       recipe path drifted from the builder it is meant to wrap, every panel
       in every existing project would quietly change. */
    const recipe = buildPanelFromRecipe({ name: "plain", widthIn: W, depthIn: D, heightIn: H, added: [] });
    expect(recipe).toEqual(buildStandardPanelMembers(W, D, H, false));
  });

  it("and the nailer flag passes straight through", () => {
    const withNailer = buildPanelFromRecipe({ name: "nailer", widthIn: W, depthIn: D, heightIn: H, includeNailer: true, added: [] });
    expect(withNailer).toEqual(buildStandardPanelMembers(W, D, H, true));
    // "Plain standard panel shouldn't have the nailer."
    const plain = buildPanelFromRecipe({ name: "plain", widthIn: W, depthIn: D, heightIn: H, added: [] });
    expect(plain.some((m) => m.memberId === "nailer")).toBe(false);
  });
});

describe("⚠ added members are let INTO the straw, not stuck on the face", () => {
  it("they sit inside the panel's own depth", () => {
    /* Tommy, 2026-10-25: "Inside the panels depth - the straw router bit'ed
       out a little groove for a wooden member to sit where straw was." So an
       added member occupies space that was straw and never projects past a
       face. */
    const added = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" });
    const members = buildPanelFromRecipe({ name: "x", widthIn: W, depthIn: D, heightIn: H, added });
    for (const m of members.filter((x) => x.memberId.startsWith("superbrace_"))) {
      const size = memberBoxSizeIn(m);
      /* A diagonal records its CENTRE, so its extent is half the box either
         side. */
      const halfY = size.yIn / 2;
      expect({ id: m.memberId, inside: m.position.yIn - halfY >= -1e-9 && m.position.yIn + halfY <= D + 1e-9 }).toEqual({
        id: m.memberId,
        inside: true,
      });
    }
  });

  it("one wythe flush each side", () => {
    expect(wytheInsetYIn("exterior", D)).toBe(0.75);
    expect(wytheInsetYIn("interior", D)).toBe(D - 0.75);
  });

  it("the straw volume comes down by what they displace, with no extra plumbing", () => {
    /* Every straw calculation in the app subtracts member volume, so routing
       a groove is accounted for the moment the member exists. */
    const plain = buildPanelFromRecipe({ name: "plain", widthIn: W, depthIn: D, heightIn: H, added: [] });
    const braced = buildPanelFromRecipe({
      name: "x",
      widthIn: W,
      depthIn: D,
      heightIn: H,
      added: bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" }),
    });
    const vol = (ms: typeof plain) =>
      ms.reduce((sum, m) => {
        const s = memberBoxSizeIn(m);
        return sum + s.xIn * s.yIn * s.zIn;
      }, 0);
    expect(vol(braced)).toBeGreaterThan(vol(plain));
  });
});

describe("the three patterns from his sketch", () => {
  it("all three are named, and SuperBrace is the default", () => {
    expect(BRACE_PAIR_PATTERNS.map((p) => p.id)).toEqual(["superbrace", "braced", "nailer"]);
    expect(DEFAULT_BRACE_PAIR_PATTERN).toBe("superbrace");
  });

  it("⚠ SuperBrace puts TWO legs per wythe on each panel — four pieces to the X", () => {
    /* "The x in the super brace is 4 smaller pieces, each one leg of the x,
       on two different panels." Two legs here, two on the partner. */
    const left = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", wythes: ["exterior"] });
    expect(left).toHaveLength(2);
    expect(left.every((s) => s.kind === "diagonal")).toBe(true);
  });

  it("⚠ every leg starts at the SEAM, which is what lines the X up across it", () => {
    const left = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", wythes: ["exterior"] });
    const right = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "right", wythes: ["exterior"] });
    // Left panel's seam is its right edge; the right panel's is its left.
    for (const s of left) expect(s.kind === "diagonal" && s.fromXIn).toBe(W);
    for (const s of right) expect(s.kind === "diagonal" && s.fromXIn).toBe(0);
    // And they meet at the same height, or the X would be a zigzag.
    const leftMid = left.map((s) => (s.kind === "diagonal" ? s.fromZIn : 0));
    const rightMid = right.map((s) => (s.kind === "diagonal" ? s.fromZIn : 0));
    expect(new Set(leftMid)).toEqual(new Set(rightMid));
  });

  it("⚠ Braced adds a diagonal and a tie CUT IN SEGMENTS, not the existing girt", () => {
    /* The tie cannot be one board edge to edge: the corner posts are let
       into the same faces, and so is the centre nailer stud a 4ft panel
       carries. Measured, a full-width tie occupied the same space as all
       three. Segments between them are buildable and need no invented
       notching detail. */
    const specs = bracePairAddedMembers({ pattern: "braced", widthIn: W, heightIn: H, half: "left", wythes: ["exterior"] });
    expect(specs[0]!.kind).toBe("diagonal");
    const ties = specs.filter((s) => s.kind === "straight");
    // A 4ft panel has one centre stud, so the tie comes in two pieces.
    expect(ties).toHaveLength(2);
    expect(ties[0]!.notes).toContain("not the girt");
    // A 2ft panel has no centre stud, so it comes in one.
    const narrow = bracePairAddedMembers({ pattern: "braced", widthIn: 24, heightIn: H, half: "left", wythes: ["exterior"] });
    expect(narrow.filter((s) => s.kind === "straight")).toHaveLength(1);
  });

  it("⚠ Nailer adds no surgery member at all", () => {
    // It is the standard panel with its own nailer turned on, which is a
    // flag on the recipe rather than something routed in.
    expect(bracePairAddedMembers({ pattern: "nailer", widthIn: W, heightIn: H, half: "left" })).toEqual([]);
  });

  it("both wythes by default, the way the braced panel already does it", () => {
    const both = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" });
    expect(both).toHaveLength(4);
    expect(new Set(both.map((s) => s.wythe))).toEqual(new Set(["exterior", "interior"]));
  });
});

describe("what the shop gets", () => {
  it("⚠ a leg's cut length is its LONGEST tip, which is his rule", () => {
    // "For 2x4 length counts just count the longest tips' length."
    const added = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", wythes: ["exterior"] });
    const members = buildPanelFromRecipe({ name: "x", widthIn: W, depthIn: D, heightIn: H, added });
    const leg = members.find((m) => m.memberId.startsWith("superbrace_"))!;
    const corners = leg.position.trapezoidCornersIn!;
    const longest = Math.max(
      ...corners.map((a, i) => {
        const b = corners[(i + 1) % corners.length]!;
        return Math.hypot(a.xIn - b.xIn, a.zIn - b.zIn);
      }),
    );
    expect(leg.actualDimsIn.lengthIn).toBeCloseTo(longest, 9);
  });

  it("⚠ four 4in GRK screws to a leg, two at each end", () => {
    /* "Each end of each 2x4 on the diagonals has 2 5/16in GRKs 4in screws
       predrilled and driven." The app's existing fastener rule already counts
       four per brace, which agrees — but calls them 6in, which his number
       contradicts. Pinned here so the correction does not get lost. */
    expect(BRACE_SCREWS_PER_DIAGONAL).toBe(4);
    expect(BRACE_SCREW_LENGTH_IN).toBe(4);
  });

  it("every added member carries a note saying what it is", () => {
    for (const pattern of ["superbrace", "braced"] as const) {
      for (const s of bracePairAddedMembers({ pattern, widthIn: W, heightIn: H, half: "left" })) {
        expect({ pattern, id: s.id, noted: (s.notes ?? "").length > 0 }).toEqual({ pattern, id: s.id, noted: true });
      }
    }
  });
});

describe("⚠ what the overlap check can and cannot say about these", () => {
  it("the STRAIGHT added members share space with nothing", () => {
    /* A Braced tie is square-cut and axis-aligned, so the existing check
       covers it honestly. */
    const specs = bracePairAddedMembers({ pattern: "braced", widthIn: W, heightIn: H, half: "left", wythes: ["exterior"] });
    const ties = specs.filter((s) => s.kind === "straight");
    const members = buildPanelFromRecipe({ name: "tie only", widthIn: W, depthIn: D, heightIn: H, added: ties });
    expect(overlappingPairsIn(members)).toEqual([]);
  });

  it("⚠ the DIAGONALS still cannot be checked, and that is the gating problem", () => {
    /* An axis-aligned box round a tilted board claims space the board does
       not fill, so comparing boxes reports overlaps that are not real. The
       editor is about to make diagonals the common case rather than a
       special one, so real oriented-box intersection has to come before it
       lets people add arbitrary members. Asserted so the gap is visible
       rather than assumed away. */
    const added = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" });
    const members = buildPanelFromRecipe({ name: "x", widthIn: W, depthIn: D, heightIn: H, added });
    const tilted = members.filter((m) => m.position.tiltDeg !== undefined);
    expect(tilted.length).toBeGreaterThan(0);
  });
});

describe("the clear height a surgery member has to fit inside", () => {
  it("is measured between the plate faces", () => {
    const { bottomZIn, topZIn } = recipeClearHeightIn(H);
    expect(bottomZIn).toBe(2.25);
    expect(topZIn).toBe(H - 2.25);
  });

  it("and every pattern's members stay inside it", () => {
    const { bottomZIn, topZIn } = recipeClearHeightIn(H);
    for (const pattern of ["superbrace", "braced"] as const) {
      for (const s of bracePairAddedMembers({ pattern, widthIn: W, heightIn: H, half: "left" })) {
        for (const z of [s.fromZIn, s.toZIn]) {
          expect({ pattern, id: s.id, inside: z >= bottomZIn - 1e-9 && z <= topZIn + 1e-9 }).toEqual({
            pattern,
            id: s.id,
            inside: true,
          });
        }
      }
    }
  });
});
