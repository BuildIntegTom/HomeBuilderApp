import { describe, expect, it } from "vitest";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { buildBracedPanelMembers } from "./bracedPanelMembers";
import { buildPanelFromRecipe } from "./panelRecipe";
import { overlappingMemberPairs } from "./memberPrism";
import {
  RING_GIRT_ID_PREFIX,
  RING_GIRT_SCREWS_PER_RING,
  buildRingGirtRow,
  cutRingGirtsAroundVerticals,
  girtHalfHeightIn,
  memberBoxSizeIn,
} from "./panelMemberHelpers";
import type { PanelMember } from "./componentSchema";

/**
 * **RING GIRTS — B31, 2026-11-06.**
 *
 * > *"instead of two 2x4s with a 2x6 between them (wall blocking girt), there
 * > is a rectangle of 2x4s that make a "ring" that holds the straw in place.
 * > The four 2x4s that make the ring are on edge (when looking at an installed
 * > wall). For a 4' panel, ring girts have 4 2x4s; two 45" pieces and two
 * > 12.5" pieces"*
 *
 * > *"4 3.5" #10 screws hold each corner of the 4 pieces of the ring Girt.
 * > Each of the 4 places where the girt touches flush against the frame each
 * > get 3 of the same screws."*
 *
 * > *"When there is an overlap that ringer needs that overlap to be cut out and
 * > another piece added behind it. This applies to only anything perfectly
 * > vertical that overlaps each girt."* — 2026-11-06, generalising his
 * > two-nailer sketch of the day before.
 */

const W = 48;
const D = 15.5;
const H = 120;

/** A ring as the BUILDER lays it down: whole rails, nothing cut. Used only
 * where the question is the rectangle's own geometry. */
const rawRing = (widthIn = W, depthIn = D) => buildRingGirtRow(1, 1, 40, widthIn, depthIn);

/** A ring as it reaches anything that reads a panel: built, then cut around
 * the panel's verticals. This is the real state of a ring girt. */
const panelRing = (widthIn = W, includeNailer = false, depthIn = D) =>
  buildStandardPanelMembers(widthIn, depthIn, H, includeNailer, "ring").filter((m) =>
    m.memberId.startsWith(RING_GIRT_ID_PREFIX),
  );

/** Just the first row's pieces, which is where every cut question is asked. */
const row1 = (ms: PanelMember[]) => ms.filter((m) => m.memberId.startsWith(`${RING_GIRT_ID_PREFIX}1_`));

const idsOf = (ms: PanelMember[]) => ms.map((m) => m.memberId);
const lengthsOf = (ms: PanelMember[]) => ms.map((m) => m.actualDimsIn.lengthIn).sort((a, b) => a - b);

describe("⚠ the ring is a rectangle of four 2x4s ON EDGE", () => {
  it("⚠ gives his two numbers on a 4ft panel, derived rather than typed in", () => {
    /* A ring on a panel with NO centre nailer is the undisturbed case he
       described: two 45in pieces and two 12.5in. 45 is the clear span between
       the stud doubles' inner faces (48 - 2 x 1.5); 12.5 is the depth less the
       two rails the short pieces fit BETWEEN (15.5 - 2 x 1.5). Neither number
       is written down anywhere in the builder — they fall out of the panel. */
    expect(lengthsOf(rawRing())).toEqual([12.5, 12.5, 45, 45]);
    expect(lengthsOf(rawRing(24, D))).toEqual([12.5, 12.5, 21, 21]);
  });

  it("⚠ every piece stands on edge: 1.5in through, 3.5in tall", () => {
    for (const m of [...rawRing(), ...panelRing()]) {
      const box = memberBoxSizeIn(m);
      expect({ id: m.memberId, tall: box.zIn }).toEqual({ id: m.memberId, tall: 3.5 });
      /* 1.5in through its OWN plane — a rail is 1.5 in depth, an end piece is
         1.5 across the width. */
      expect(Math.min(box.xIn, box.yIn)).toBeCloseTo(1.5, 9);
    }
  });

  it("⚠ its top face is 1in above a bar's, which is what moves the braces", () => {
    /* His 2026-10-13 rule: the brace low point rides the girt's TOP face. A
       bar is 1.5in tall, a ring member 3.5in, both centred on the same row. */
    expect(girtHalfHeightIn("ring") - girtHalfHeightIn("blocking")).toBeCloseTo(1, 9);
    expect(girtHalfHeightIn("web")).toBe(girtHalfHeightIn("blocking"));
    const top = (m: PanelMember) => m.position.zIn + memberBoxSizeIn(m).zIn;
    expect(top(rawRing()[0]!)).toBeCloseTo(40 + 1.75, 9);
  });

  it("⚠ has NO web and NO blocking — it IS the infill", () => {
    const members = buildStandardPanelMembers(W, D, H, false, "ring");
    expect(members.filter((m) => m.role === "girt_web")).toEqual([]);
    expect(members.filter((m) => m.memberId.includes("blocking"))).toEqual([]);
  });

  it("the end pieces fit BETWEEN the rails rather than over them", () => {
    /* The reason his two numbers are 45 and 12.5 rather than 45 and 15.5: the
       short pieces are let in between the long ones, so the ring's own corner
       is a butt joint and the outer rectangle still measures the full depth. */
    const ends = row1(panelRing()).filter((m) => m.memberId.endsWith("_end"));
    expect(ends).toHaveLength(2);
    for (const end of ends) {
      expect(end.position.yIn).toBeCloseTo(1.5, 9);
      expect(end.actualDimsIn.lengthIn).toBeCloseTo(12.5, 9);
    }
  });
});

describe("⚠ his cut-and-tie: a rail is cut around anything perfectly vertical", () => {
  it("cuts the rail either side of the centre nailer and ties it with a 42in piece", () => {
    const ms = row1(panelRing());
    const extRails = ms.filter((m) => m.memberId.startsWith(`${RING_GIRT_ID_PREFIX}1_ext_rail`));
    const tie = ms.find((m) => m.memberId === `${RING_GIRT_ID_PREFIX}1_ext_tie`)!;
    expect(extRails).toHaveLength(2);
    expect(tie).toBeDefined();
    /* ⚠ 42in is not typed in anywhere: it is the span between the INSIDE faces
       of the ring's own two short pieces, 3 to 45 on a 48in panel. That it
       comes out at exactly his number is the check worth having. */
    expect(tie.actualDimsIn.lengthIn).toBeCloseTo(42, 9);
  });

  it("⚠ the tie sits BEHIND the rail, in the 1.5-3in band the flat nailer leaves free", () => {
    /* The whole detail hangs on this: a centre nailer lies flat and stops at
       1.5in, so the tie can be in contact with the pieces it repairs. On edge
       it would reach 3.5in and the tie would have to be notched into a
       bearing stud. */
    const tie = panelRing().find((m) => m.memberId.endsWith("_ext_tie"))!;
    expect(tie.position.yIn).toBeCloseTo(1.5, 9);
    expect(tie.position.yIn + memberBoxSizeIn(tie).yIn).toBeCloseTo(3, 9);
    const nailer = buildStandardPanelMembers(W, D, H, false, "ring").find(
      (m) => m.memberId === "stud_centre_1_exterior",
    )!;
    expect(memberBoxSizeIn(nailer).yIn).toBeCloseTo(1.5, 9);
  });

  it("both faces get the same treatment", () => {
    const ms = row1(panelRing());
    expect(ms.filter((m) => m.memberId.endsWith("_tie"))).toHaveLength(2);
    expect(ms.filter((m) => m.memberId.includes("_int_rail"))).toHaveLength(2);
  });

  it("a panel with no centre nailer gets four pieces and no tie", () => {
    const narrow = row1(panelRing(24));
    expect(idsOf(narrow).filter((id) => id.includes("tie"))).toEqual([]);
    expect(narrow).toHaveLength(4);
  });

  it("⚠ the OPTIONAL nailer cuts it too, on a panel with no centre stud at all", () => {
    /* The case that proves the rule is not about centre nailers. A 24in panel
       has no centre stud, so its ring came out whole above — turn the optional
       nailer on and the same rail has to be cut around that instead. This used
       to need its span threaded by hand out of `buildStandardPanelMembers`; the
       pass now reads the nailer's real box off the finished panel. */
    const withNailer = row1(panelRing(24, true));
    expect(withNailer.filter((m) => m.memberId.endsWith("_ext_tie"))).toHaveLength(1);
    expect(withNailer.filter((m) => m.memberId.startsWith(`${RING_GIRT_ID_PREFIX}1_ext_rail_`))).toHaveLength(2);
    /* ⚠ The INTERIOR rail is untouched: that nailer is on the exterior wythe
       only, and the pass asks which face a board actually stands on rather
       than cutting both for symmetry (which B31's span list did). */
    expect(withNailer.filter((m) => m.memberId === `${RING_GIRT_ID_PREFIX}1_int_rail`)).toHaveLength(1);
    expect(withNailer.filter((m) => m.memberId.endsWith("_int_tie"))).toEqual([]);
  });

  it("⚠ a vertical ADDED after the girts cuts it, which is the whole point of the pass", () => {
    /* His rule is *"anything perfectly vertical that overlaps each girt"*, and
       most verticals in this app are added to a recipe long after the girts
       were built: the Vertical Nailer overlay, a brace pattern's additions, and
       anything a user stands up in the panel editor. A span list handed to the
       girt builder could never see them. */
    const members = buildPanelFromRecipe({
      name: "ring + an added vertical",
      widthIn: 24,
      depthIn: D,
      heightIn: H,
      girtStyle: "ring",
      added: [
        { kind: "straight", id: "added_vertical", wythe: "exterior", fromXIn: 10, fromZIn: 3, toXIn: 10, toZIn: 117 },
      ],
    });
    expect(idsOf(members).filter((id) => id.startsWith(`${RING_GIRT_ID_PREFIX}1_ext_`)).sort()).toEqual([
      `${RING_GIRT_ID_PREFIX}1_ext_rail_1`,
      `${RING_GIRT_ID_PREFIX}1_ext_rail_2`,
      `${RING_GIRT_ID_PREFIX}1_ext_tie`,
    ]);
    /* And the panel is buildable: the added board no longer shares a volume
       with the rail it stands in. */
    expect(overlappingMemberPairs(members)).toEqual([]);
  });

  it('⚠ a DIAGONAL is not cut around — "only anything perfectly vertical"', () => {
    /* Deliberate, and his call while the brace-on-ring collision is undecided:
       *"As long as the review log says when things are overlapping, I think
       it's fine for now."* The rail stays whole and the overlap is reported,
       rather than a brace quietly chopping a girt into pieces. */
    const members = buildPanelFromRecipe({
      name: "ring + a crossing diagonal",
      widthIn: 24,
      depthIn: D,
      heightIn: H,
      girtStyle: "ring",
      added: [{ kind: "diagonal", id: "d1", wythe: "exterior", fromXIn: 1.5, fromZIn: 3, toXIn: 22.5, toZIn: 90 }],
    });
    expect(idsOf(members).filter((id) => id.startsWith(`${RING_GIRT_ID_PREFIX}1_ext_`))).toEqual([
      `${RING_GIRT_ID_PREFIX}1_ext_rail`,
    ]);
    expect(overlappingMemberPairs(members).every((p) => p.includes("d1"))).toBe(true);
  });

  it("⚠ running the pass twice changes nothing", () => {
    /* It has to be idempotent: `buildStandardPanelMembers` runs it, and
       `buildPanelFromRecipe` runs it again over that same base plus its own
       added members. It rebuilds each rail from the ring's END pieces rather
       than from whatever rail it finds, which is what makes that safe. */
    const print = (ms: PanelMember[]) =>
      ms.map((m) => `${m.memberId}@${m.position.xIn}:${m.actualDimsIn.lengthIn}`).sort();
    const once = buildStandardPanelMembers(W, D, H, true, "ring");
    expect(print(cutRingGirtsAroundVerticals(once, D))).toEqual(print(once));
  });

  it("leaves every other girt style alone", () => {
    for (const style of ["web", "blocking"] as const) {
      const members = buildStandardPanelMembers(W, D, H, true, style);
      expect(cutRingGirtsAroundVerticals(members, D)).toEqual(members);
    }
  });
});

describe("⚠ a ring-girted panel is buildable", () => {
  it("has no overlapping members at the default size", () => {
    expect(overlappingMemberPairs(buildStandardPanelMembers(W, D, H, false, "ring"))).toEqual([]);
  });

  it("⚠ and at every width the panelizer actually produces", () => {
    /* The sweep matters more than the single case: the number of centre
       nailers changes with width, and each one cuts both rails again. */
    for (const widthIn of [15.5, 24, 25.5, 36, 48, 60, 72, 96]) {
      expect({
        widthIn,
        overlaps: overlappingMemberPairs(buildStandardPanelMembers(widthIn, D, H, false, "ring")),
      }).toEqual({ widthIn, overlaps: [] });
    }
  });

  it("⚠ OPEN BUILDING QUESTION: ring girts and diagonal braces collide on a 2-row panel", () => {
    /* ⚠ **Pinned as the truth, not asserted as correct.** A braced panel with
       ring girts reports real overlaps today, and the reason is worth reading
       before anyone "fixes" it in the wrong place.

       His 2026-10-13 rule is that a brace's low point RIDES the girt's top
       face — braces run girt to plate, they do not pass through a girt. That
       works whenever there IS a girt at the middle row. On a 120in panel there
       are TWO rows, so `middleRow` is 1.5 and there is no girt there; the
       existing fallback is his own — *"If there happens to be no girt the
       center of the panel then just center it on the height if that ever
       happens"* — and it anchors the braces at mid-height instead.

       That fallback was decided when a girt was a BAR, which bites only 3.5in
       at each end of the panel and lets a mid-panel diagonal pass. A RING runs
       a rail along the whole width of the same face. So the fallback now puts
       a brace through a board.

       ⚠ **And his cut-and-tie is deliberately NOT the answer here**, because
       he scoped it to *"only anything perfectly vertical"*. Three ways out,
       all of them his call, none of them taken here:
         1. anchor braces on the NEAREST ring rather than at mid-height;
         2. keep rings off the braced patterns' wythe;
         3. notch — which this app does not do anywhere else.

       Until then: rings are clean on standard panels at every width (above),
       and a braced panel asking for them says so through the audit rather than
       drawing a joint nobody can build. */
    const withRing = overlappingMemberPairs(buildBracedPanelMembers(W, D, H, false, "chevron", false, false, "ring"));
    const withWeb = overlappingMemberPairs(buildBracedPanelMembers(W, D, H, false, "chevron", false, false, "web"));
    /* ⚠ Measured as a DELTA, because a braced panel already carries two
       overlaps of its own that have nothing to do with girts — the centre
       connector against the two braces it joins, which that member's own
       comment already calls "illustrative, not to scale". Those are a separate
       finding and are not this one. */
    const added = withRing.filter((pair) => !withWeb.includes(pair));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((pair) => pair.includes("ring_girt_") && /brace/.test(pair))).toBe(true);
    expect(withWeb.every((pair) => pair.includes("brace_center_connector"))).toBe(true);
  });

  it("⚠ FINDING: a diagonal that CROSSES a ring row overlaps it, where a bar let it pass", () => {
    /* Not a defect in either piece — a real consequence of what a ring is, and
       worth knowing before somebody drags a brace in the panel editor.

       A bar-and-web row only bites 3.5in of the panel's face at each END (the
       two bars), and its web sits at mid-depth; a diagonal running the full
       height down the exterior face passes between them untouched. A RING
       runs a rail along the full width of that same face, which is exactly
       where the diagonal is. So the two genuinely occupy one volume.

       The editor already refuses this on the drop (B29/B30), with the rail
       named in the message, so a user meets it as a refusal rather than as a
       panel that cannot be built. Pinned so the difference between the two
       girt styles is recorded rather than rediscovered. */
    const crossing = buildPanelFromRecipe({
      name: "ring + a brace that crosses it",
      widthIn: W,
      depthIn: D,
      heightIn: H,
      girtStyle: "ring",
      added: [{ kind: "diagonal", id: "d1", wythe: "exterior", fromXIn: 1.5, fromZIn: 3, toXIn: 46.5, toZIn: 90 }],
    });
    expect(overlappingMemberPairs(crossing).every((p) => p.includes("d1"))).toBe(true);
    /* The same brace on a bar-and-web panel passes freely. */
    expect(
      overlappingMemberPairs(
        buildPanelFromRecipe({
          name: "web + the same brace",
          widthIn: W,
          depthIn: D,
          heightIn: H,
          girtStyle: "web",
          added: [{ kind: "diagonal", id: "d1", wythe: "exterior", fromXIn: 1.5, fromZIn: 3, toXIn: 46.5, toZIn: 90 }],
        }),
      ),
    ).toEqual([]);
  });

  it("⚠ FINDING, not a ring defect: the OPTIONAL nailer duplicates the centre nailer stud", () => {
    /* Found by sweeping this panel with the overlap audit for the first time —
       it is present at HEAD before B31 and has nothing to do with rings.
       Half of it is fixed: the nailer used to start at the skin's top face and
       run through the bottom plate, and his own reference BOM says it should
       stand between the plates (115.5in on a 120in panel is exactly plate face
       to plate face).

       The other half is a BUILDING decision and is left standing rather than
       nudged: on any panel wide enough to carry a centre nailer stud, the
       optional nailer lands in exactly the same place, because both are
       centred on the width. They are not two boards fighting over a volume —
       they are the SAME board asked for twice. Moving one would invent a
       position nobody chose; the question is whether a panel that already has
       a centre nailer should offer the option at all. Pinned here so it
       cannot be mistaken for ring work or quietly disappear. */
    const overlaps = overlappingMemberPairs(buildStandardPanelMembers(W, D, H, true, "ring"));
    expect(overlaps).toEqual(["stud_centre_1_exterior x nailer"]);
    /* A width with no centre nailer stud has no such argument. */
    expect(overlappingMemberPairs(buildStandardPanelMembers(24, D, H, true, "ring"))).toEqual([]);
  });
});

describe("⚠ the screws are counted per RING, not per board", () => {
  it("is 28 — his 4 corners of 4 plus his 4 frame landings of 3", () => {
    expect(RING_GIRT_SCREWS_PER_RING).toBe(28);
  });

  it("⚠ a cut ring has more boards and the SAME 28 screws", () => {
    /* Which is why the fastener model cannot express this with the per-member
       rules it uses for everything else: his number counts JOINTS. A 48in
       panel's ring is 8 boards; a 24in panel's is 4; both are one ring. */
    expect({ cutBoards: row1(panelRing()).length, wholeBoards: row1(panelRing(24)).length }).toEqual({
      cutBoards: 8,
      wholeBoards: 4,
    });
  });
});
