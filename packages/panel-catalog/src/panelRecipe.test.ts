import { describe, expect, it } from "vitest";
import {
  buildPanelFromRecipe,
  recipeClearHeightIn,
  recipeConflicts,
  recipeFingerprint,
  wytheInsetYIn,
} from "./panelRecipe";
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
    /* ⚠ The prefix is `big_carrot_`/`little_carrot_` since 2026-11-02, not
       `superbrace_`. Filtering on the old one left this loop running ZERO
       times and the test passing on nothing, so the count is asserted first. */
    const carrots = members.filter((x) => x.memberId.startsWith("big_carrot_") || x.memberId.startsWith("little_carrot_"));
    expect(carrots).toHaveLength(4);
    for (const m of carrots) {
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

  it("⚠ a Big Carrot is TWO legs on this panel — four pieces to the pair's X", () => {
    /* "The x in the super brace is 4 smaller pieces, each one leg of the x,
       on two different panels." Two legs here, two on the partner. */
    const left = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", figure: "big-carrot", wythes: ["exterior"] });
    expect(left).toHaveLength(2);
    expect(left.every((s) => s.kind === "diagonal")).toBe(true);
  });

  it("a Little Carrot is the two short load-path diagonals, and a Super Carrot is all four", () => {
    /* His arithmetic, 2026-11-02: *"Super braced pattern was 8844, is now
       really more like 4422 since I don't think the interior needs to be
       braced."* Per panel, exterior only: a Super Carrot is 4 and a Little
       Carrot is 2. */
    const little = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", figure: "little-carrot", wythes: ["exterior"] });
    expect(little).toHaveLength(2);
    expect(little.map((s) => s.id)).toEqual(["little_carrot_exterior_left_top", "little_carrot_exterior_left_bottom"]);

    const sup = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", figure: "super-carrot", wythes: ["exterior"] });
    expect(sup).toHaveLength(4);
    // And the default figure is the full one, so every pre-existing caller
    // keeps the densest panel rather than quietly losing half of it.
    expect(bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", wythes: ["exterior"] })).toEqual(sup);
  });

  it("⚠ a Little Carrot starts at the panel's own top/bottom plate CENTRE, where the roof and floor seams land", () => {
    /* 48in walls, 24in floor and roof panels, so a seam lands dead centre on
       every wall panel's top plate and under its bottom plate. That is the
       load this figure exists to spread. */
    const little = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", figure: "little-carrot", wythes: ["exterior"] });
    for (const spec of little) expect(spec.kind === "diagonal" && spec.fromXIn).toBe(W / 2);
    // One off the top plate and one off the bottom, not two off the same end.
    const fromZs = little.map((spec) => (spec.kind === "diagonal" ? spec.fromZIn : 0)).sort((a, b) => a - b);
    expect(fromZs[0]).toBeLessThan(H / 2);
    expect(fromZs[1]).toBeGreaterThan(H / 2);
    /* ⚠ And it runs toward the SEAM, which is NOT the direction he sketched
       — see `littleCarrotSpecs` for the whole of why. Outward it crosses the
       Big Carrot's upper leg, and two 2x4s cannot share a groove. */
    for (const spec of little) expect(spec.kind === "diagonal" && spec.toXIn).toBe(W - 1.5);
  });

  it("⚠ every X leg starts at the seam-side POST, which is what lines the X up across it", () => {
    const left = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", figure: "big-carrot", wythes: ["exterior"] });
    const right = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "right", figure: "big-carrot", wythes: ["exterior"] });
    /* ⚠ The seam-side POST's inner face, not the seam itself. Tommy,
       2026-10-25: "Braces should be flush with the post, not the edge of the
       panel." So the two panels' legs stop 3in apart across the seam — two
       post thicknesses — which is exactly the material in the way. */
    for (const s of left) expect(s.kind === "diagonal" && s.fromXIn).toBe(W - 1.5);
    for (const s of right) expect(s.kind === "diagonal" && s.fromXIn).toBe(1.5);
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

  it("⚠ Nailer adds no board AT HIS 24in SPACING, and that is a decision — B21", () => {
    /* It used to add nothing because nobody had written the rule: it was the
       standard panel with its single centre nailer flag on, so the button
       changed a label and not one member. B21 wrote the rule. His 2026-11-04
       answer then set it to the number his shop builds to:

       > *"The way I want to build these is 24\" spacing, which works well
       > enough for lumber and sheet goods. We can drop 16\" being meaningful."*

       ...which `MAX_STUD_SPACING_IN` already guarantees, so the list is empty
       again — for a written reason now rather than for the want of one. The
       subdivision rule is held in verticalNailerOverlay.test.ts at a spacing
       that bites. */
    expect(bracePairAddedMembers({ pattern: "nailer", widthIn: W, heightIn: H, half: "left" })).toEqual([]);
    /* ⚠ But NOT the same as having no pattern: a nailer panel keeps its centre
       nailer studs, where the Carrot Pattern deletes them for its legs. */
    const nailered = buildPanelFromRecipe({ name: "n", widthIn: W, depthIn: D, heightIn: H, added: [] });
    expect(nailered.filter((m) => m.memberId.startsWith("stud_centre_"))).toHaveLength(2);
  });

  it("⚠ the Carrot Pattern is EXTERIOR ONLY, while the Braced Pair still takes both wythes", () => {
    /* > *"I guess these super brace patterns could just be for the outside
       > actually, exterior only. Standard panel style for inside, perhaps
       > ready to receive edits and nailers somehow."* — Tommy, 2026-11-02.
       He said nothing about the Braced Pair, so it is untouched. */
    const carrot = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" });
    expect(new Set(carrot.map((s) => s.wythe))).toEqual(new Set(["exterior"]));
    expect(carrot).toHaveLength(4);

    const braced = bracePairAddedMembers({ pattern: "braced", widthIn: W, heightIn: H, half: "left" });
    expect(new Set(braced.map((s) => s.wythe))).toEqual(new Set(["exterior", "interior"]));

    // An explicit list still overrides either default.
    const forced = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", wythes: ["exterior", "interior"] });
    expect(new Set(forced.map((s) => s.wythe))).toEqual(new Set(["exterior", "interior"]));
  });
});

describe("what the shop gets", () => {
  it("⚠ a leg's cut length is its LONGEST tip, which is his rule", () => {
    // "For 2x4 length counts just count the longest tips' length."
    const added = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", wythes: ["exterior"] });
    const members = buildPanelFromRecipe({ name: "x", widthIn: W, depthIn: D, heightIn: H, added });
    const leg = members.find((m) => m.memberId.startsWith("big_carrot_"))!;
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

describe("⚠ a vertical nailer and diagonals are alternatives, not companions", () => {
  const diagonals = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" });

  it("asking for both is reported as a conflict, in building terms", () => {
    /* *"it doesn't make sense structurally to have vertical nailers and
       diagonals, they interfere with each other's jobs if either one is
       notched."* A UI should disable the option rather than honour it
       silently, which is why this returns words and not a boolean. */
    const conflicts = recipeConflicts({ name: "both", widthIn: W, depthIn: D, heightIn: H, includeNailer: true, added: diagonals });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toContain("CDX");
    expect(recipeConflicts({ name: "braced", widthIn: W, depthIn: D, heightIn: H, added: diagonals })).toEqual([]);
    expect(recipeConflicts({ name: "nailer", widthIn: W, depthIn: D, heightIn: H, includeNailer: true, added: [] })).toEqual([]);
  });

  it("and the nailer loses, because the diagonals are the ones doing the bracing", () => {
    const members = buildPanelFromRecipe({ name: "both", widthIn: W, depthIn: D, heightIn: H, includeNailer: true, added: diagonals });
    expect(members.some((m) => m.memberId === "nailer")).toBe(false);
  });

  it("⚠ diagonals also clear the intermediate studs, and that leaves a known gap", () => {
    /* A diagonal crossing any vertical has the same notching problem. So a
       braced panel has no intermediate stud — which braced panels never had
       — and a 2ft floor seam over a 4ft braced panel therefore lands on top
       plate rather than on a stud. Consistent with what the app already did,
       and still an open question. */
    const braced = buildPanelFromRecipe({ name: "braced", widthIn: 48, depthIn: D, heightIn: H, added: diagonals });
    expect(braced.some((m) => m.memberId.startsWith("stud_centre_"))).toBe(false);
    const plain = buildPanelFromRecipe({ name: "plain", widthIn: 48, depthIn: D, heightIn: H, added: [] });
    expect(plain.some((m) => m.memberId.startsWith("stud_centre_"))).toBe(true);
  });

  it("⚠ and with them gone, a braced recipe panel is finally solid", () => {
    const members = buildPanelFromRecipe({ name: "braced", widthIn: 48, depthIn: D, heightIn: H, added: diagonals });
    expect(overlappingPairsIn(members)).toEqual([]);
  });
});

describe("what makes two panels the same panel", () => {
  const base = { widthIn: W, depthIn: D, heightIn: H };

  it("⚠ uniqueness falls out of being different, it is not a flag somebody sets", () => {
    /* *"only exact copies of panels should be grouped together."* So two
       panels hand-edited into the same shape ARE exact copies and share a
       sheet, and a panel edited back to where it started rejoins its group
       on its own. A `handEdited` boolean would get both of those wrong. */
    const a = recipeFingerprint({ name: "from a pattern", ...base, added: [] });
    const b = recipeFingerprint({ name: "hand built, identical", ...base, added: [] });
    expect(a).toBe(b);
  });

  it("any change to the members changes it immediately", () => {
    const plain = recipeFingerprint({ name: "p", ...base, added: [] });
    const braced = recipeFingerprint({
      name: "p",
      ...base,
      added: bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" }),
    });
    expect(braced).not.toBe(plain);
  });

  it("the order members were added in does not make a different panel", () => {
    const added = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" });
    const forwards = recipeFingerprint({ name: "p", ...base, added });
    const backwards = recipeFingerprint({ name: "p", ...base, added: [...added].reverse() });
    expect(forwards).toBe(backwards);
  });

  it("neither does what the user called it", () => {
    expect(recipeFingerprint({ name: "Tommy's panel", ...base, added: [] })).toBe(
      recipeFingerprint({ name: "something else entirely", ...base, added: [] }),
    );
  });

  it("⚠ the two halves of a pair are NOT the same panel", () => {
    // Their legs run opposite ways, so they need separate sheets.
    const left = recipeFingerprint({ name: "l", ...base, added: bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" }) });
    const right = recipeFingerprint({ name: "r", ...base, added: bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "right" }) });
    expect(left).not.toBe(right);
  });

  it("a different size is a different panel", () => {
    expect(recipeFingerprint({ name: "p", ...base, added: [] })).not.toBe(
      recipeFingerprint({ name: "p", ...base, widthIn: 24, added: [] }),
    );
  });
});
