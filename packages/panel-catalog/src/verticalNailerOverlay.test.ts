import { describe, expect, it } from "vitest";
import type { PanelMember } from "./componentSchema";
import { overlappingMemberPairs } from "./memberPrism";
import { BRACE_PAIR_PATTERNS, bracePairAddedMembers, verticalNailerSpecs } from "./bracePairPatterns";
import { buildPanelFromRecipe, hasAddedNailer, recipeConflicts, recipeFingerprint } from "./panelRecipe";
import { MAX_STUD_SPACING_IN, PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN, centreNailerStudSpansIn, memberBoxSizeIn } from "./panelMemberHelpers";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { nailerOverlaySpacingIn } from "./data";
import { derivePanelShear } from "@building-integrity/calc-engine";
import { computePanelCutList } from "./panelCutList";

/**
 * **B21 — Vertical Nailers is its own overlay.**
 *
 * > *"Vertical nailers is actually a totally different bracing pattern overlay.
 * > Let's make that a button that turns all of the panels into straight up and
 * > down 2x4s just on the exterior."* — Tommy, 2026-11-02
 *
 * > *"The way I want to build these is 24" spacing, which works well enough for
 * > lumber and sheet goods. We can drop 16" being meaningful."* — 2026-11-04,
 * > after being told that 24in or more adds no boards.
 *
 * ⚠ **So the headline fact these tests hold is that at HIS number the overlay
 * adds nothing**, because `MAX_STUD_SPACING_IN` already puts a vertical every
 * 24in for the floor/roof seam. What remains is a guarantee rather than a
 * generator — two rules that agree today, each written down, so the day they
 * diverge a wall gets nailers instead of silently going unnailable.
 *
 * The subdivision rule is therefore exercised at an explicit TIGHTER spacing.
 * That is not testing a fiction: it is the same code the 24in path runs, and
 * it is what would fire the moment a panel carried a wider bay.
 */

const W = 48;
const D = 15.5;
const H = 120;

/** A spacing that bites, for exercising the generator. Not his number. */
const TIGHT_IN = 16;

const nailerRecipe = (widthIn = W, includeNailer = false) => ({
  name: "overlay",
  widthIn,
  depthIn: D,
  heightIn: H,
  includeNailer,
  girtStyle: "web" as const,
  added: bracePairAddedMembers({ pattern: "nailer" as const, widthIn, heightIn: H, half: "left" as const }),
});

/** A recipe whose overlay was generated at the tighter spacing. */
const tightRecipe = (widthIn = W, includeNailer = false) => ({
  ...nailerRecipe(widthIn, includeNailer),
  added: verticalNailerSpecs(widthIn, H, "exterior", TIGHT_IN),
});

/** Where a vertical member's 1.5in face sits in x, as [start, end]. */
function verticalSpansIn(members: PanelMember[], wytheYIn: number): [number, number][] {
  return members
    .filter((m) => m.orientation === "vertical" && Math.abs(m.position.yIn - wytheYIn) < 1e-9)
    /* ⚠ The member's real X extent, not its nominal thickness. B30/B31 lay
       verticals FLAT, so a nailer is 3.5in across the wall where a corner post
       on edge is 1.5in — and measuring both as 1.5 reports face-to-face gaps
       that are 2in wider than the wall actually has. */
    .map((m) => [m.position.xIn, m.position.xIn + memberBoxSizeIn(m).xIn] as [number, number])
    .sort((a, b) => a[0] - b[0]);
}

describe("B21 — at his confirmed 24in, the overlay is a guarantee and not a generator", () => {
  it("is his number, and it is settled rather than flagged", () => {
    expect(nailerOverlaySpacingIn).toMatchObject({ value: 24, status: "confirmed" });
  });

  it("adds NO board to any panel this app draws — the stud rule already meets it", () => {
    const added = (widthIn: number) => verticalNailerSpecs(widthIn, H).length;
    expect({ 24: added(24), 36: added(36), 48: added(48), 60: added(60), 72: added(72), 96: added(96) }).toEqual({
      24: 0,
      36: 0,
      48: 0,
      60: 0,
      72: 0,
      96: 0,
    });
  });

  it("⚠ and that is not luck — `MAX_STUD_SPACING_IN` is the reason, swept", () => {
    /* Every panel width on the 1/8in grid from the fabrication minimum to a
       very wide one. `centreNailerStudSpansIn` keeps every bay at or under
       MAX_STUD_SPACING_IN, so nothing can ever exceed his spacing while the
       two numbers are equal. Written as a sweep rather than a comment because
       the claim is about ALL widths, and because the day somebody raises
       MAX_STUD_SPACING_IN this test is what tells them nailers start appearing. */
    expect(nailerOverlaySpacingIn.value).toBe(MAX_STUD_SPACING_IN);
    for (let widthIn = 16; widthIn <= 144; widthIn += 0.125) {
      if (verticalNailerSpecs(widthIn, H).length !== 0) {
        throw new Error(`${widthIn}in got a nailer at his 24in spacing`);
      }
    }
  });

  it("so a Vertical Nailer panel is EXACTLY a plain standard panel plus nothing", () => {
    /* The honest statement of what the setting does today. It is still not the
       same as the Carrot Pattern, which DELETES the centre nailer studs to make
       room for its legs — that difference is the next test. */
    for (const widthIn of [24, 36, 48, 72]) {
      expect(buildPanelFromRecipe(nailerRecipe(widthIn))).toEqual(
        buildStandardPanelMembers(widthIn, D, H, false, "web"),
      );
    }
  });

  it("⚠ and it DOES differ from the Carrot Pattern, by the centre studs it keeps", () => {
    const nailered = buildPanelFromRecipe(nailerRecipe());
    const carrot = buildPanelFromRecipe({
      ...nailerRecipe(),
      added: bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left" }),
    });
    const centreStuds = (ms: PanelMember[]) => ms.filter((m) => m.memberId.startsWith("stud_centre_")).length;
    expect({ nailer: centreStuds(nailered), carrot: centreStuds(carrot) }).toEqual({ nailer: 2, carrot: 0 });
  });

  it("is still worth ZERO shear, and that is the honest answer", () => {
    /* A vertical does not resist racking; the covering nailed to it does, and
       this app does not model coverings. `derivePanelShear` reads
       `role === "brace"`, which is why the overlay's boards carry
       `role: "nailer"` rather than inheriting `stud`. */
    const members = buildPanelFromRecipe(tightRecipe());
    expect(members.filter((m) => m.role === "nailer")).toHaveLength(2);
    expect(derivePanelShear("overlay", members).braces).toEqual([]);
    expect(derivePanelShear("overlay", members).totalHorizontalLb).toBe(0);
  });

  it("the button says what it is, including that it adds nothing today", () => {
    const entry = BRACE_PAIR_PATTERNS.find((p) => p.id === "nailer")!;
    expect(entry.label).toBe("Vertical Nailers");
    expect(entry.description).toContain("centre nailer studs stay");
    expect(entry.description).toContain("adds no extra board today");
    /* It must keep saying what it does NOT do. */
    expect(entry.description).toContain("No diagonal");
  });
});

describe("B21 — the subdivision rule itself, at a spacing that bites", () => {
  it("puts a nailer in each bay that needs splitting, and none in one that does not", () => {
    const added = (widthIn: number) => verticalNailerSpecs(widthIn, H, "exterior", TIGHT_IN).length;
    /* A 36in panel's centre stud already leaves two 15.75in bays, so even at
       16in it gets none — the rule adds to a BAY, never to a panel. */
    expect({ 24: added(24), 36: added(36), 48: added(48), 60: added(60), 72: added(72), 96: added(96) }).toEqual({
      24: 1,
      36: 0,
      48: 2,
      60: 3,
      72: 3,
      96: 4,
    });
  });

  it("every board is a square-cut vertical on the exterior, carrying its own role", () => {
    for (const spec of verticalNailerSpecs(W, H, "exterior", TIGHT_IN)) {
      expect(spec.kind).toBe("straight");
      expect(spec.wythe).toBe("exterior");
      if (spec.kind !== "straight") throw new Error("unreachable");
      expect(spec.role).toBe("nailer");
      expect(spec.fromXIn).toBe(spec.toXIn);
      expect(spec.toZIn).toBeGreaterThan(spec.fromZIn);
    }
  });

  it("brings every face-to-face gap on the exterior face under the spacing", () => {
    for (const widthIn of [24, 36, 48, 60, 72, 96]) {
      const spans = verticalSpansIn(buildPanelFromRecipe(tightRecipe(widthIn)), 0);
      for (let i = 0; i < spans.length - 1; i++) {
        const gapIn = spans[i + 1]![0] - spans[i]![1];
        expect({ widthIn, over: gapIn > TIGHT_IN + 1e-9 }).toEqual({ widthIn, over: false });
      }
    }
  });

  it("lands the nailers in the bays, never on a stud that is already there", () => {
    for (const widthIn of [24, 48, 72, 96]) {
      const occupied: [number, number][] = [
        [0, PLATE_2X4_THICKNESS_IN],
        ...centreNailerStudSpansIn(widthIn),
        [widthIn - PLATE_2X4_THICKNESS_IN, widthIn],
      ];
      for (const spec of verticalNailerSpecs(widthIn, H, "exterior", TIGHT_IN)) {
        const from = spec.fromXIn;
        /* 3.5in across, not 1.5in: B30/B31 lay a nailer FLAT, so its wide
           face is the one that runs along the wall. */
        const to = from + PLATE_2X4_WIDTH_IN;
        for (const [a, b] of occupied) {
          expect({ widthIn, id: spec.id, clear: to <= a + 1e-9 || from >= b - 1e-9 }).toEqual({
            widthIn,
            id: spec.id,
            clear: true,
          });
        }
      }
    }
  });

  it("adds not one overlapping pair, at any width", () => {
    for (const widthIn of [24, 36, 48, 60, 72, 96, 120]) {
      const overlay = overlappingMemberPairs(buildPanelFromRecipe(tightRecipe(widthIn)));
      const plain = overlappingMemberPairs(buildStandardPanelMembers(widthIn, D, H, false, "web"));
      /* A DELTA, because the plain standard panel already reports pairs of its
         own (see girtStyles.test.ts) and this is not the place to fix them. */
      expect({ widthIn, added: overlay.filter((p) => !plain.includes(p)) }).toEqual({ widthIn, added: [] });
    }
  });

  it("stops at the plate faces, which makes it the same cut as a centre nailer stud", () => {
    const members = buildPanelFromRecipe(tightRecipe());
    const nailers = members.filter((m) => m.role === "nailer");
    const centreStud = members.find((m) => m.memberId === "stud_centre_1_exterior")!;
    expect(nailers).toHaveLength(2);
    for (const n of nailers) {
      expect(n.position.zIn).toBeCloseTo(centreStud.position.zIn, 9);
      expect(n.actualDimsIn.lengthIn).toBeCloseTo(centreStud.actualDimsIn.lengthIn, 9);
      expect(n.nominalSize).toBe("2x4");
    }
    /* So the cut list groups them under the stud's letter and raises its
       quantity rather than printing a near-duplicate row — `cutKey` excludes
       role on purpose. 2 centre studs + 2 nailers = 4. */
    const rows = computePanelCutList(members);
    const row = rows.find((r) => r.members.some((m) => m.memberId === "stud_centre_1_exterior"))!;
    expect(row.qty).toBe(4);
  });

  it("is EXTERIOR ONLY — nothing is added to the interior face", () => {
    const members = buildPanelFromRecipe(tightRecipe());
    expect(members.filter((m) => m.role === "nailer").every((m) => m.position.yIn === 0)).toBe(true);
    const plain = buildStandardPanelMembers(W, D, H, false, "web");
    expect(verticalSpansIn(members, D - 3.5)).toEqual(verticalSpansIn(plain, D - 3.5));
  });

  it("replaces the single centre nailer rather than standing beside it", () => {
    /* ⚠ The centre nailer member sits at mid-width, where a 48in panel's
       centre nailer STUD already is. Keeping both put a third 2x4 in one
       groove, and `overlappingMemberPairs` was reporting it. */
    const withFlag = tightRecipe(W, true);
    expect(hasAddedNailer(withFlag)).toBe(true);
    expect(buildPanelFromRecipe(withFlag).some((m) => m.memberId === "nailer")).toBe(false);
    /* The flag alone, with no overlay, still builds it — nothing else changed,
       and that is every panel today at his 24in spacing. */
    expect(buildPanelFromRecipe({ ...withFlag, added: [] }).some((m) => m.memberId === "nailer")).toBe(true);
  });

  it("still refuses to pair nailers with diagonals, now by the PART and not by the flag", () => {
    const withBoth = {
      ...tightRecipe(),
      added: [
        ...tightRecipe().added,
        {
          kind: "diagonal" as const,
          id: "d",
          fromXIn: 1.5,
          fromZIn: 2,
          toXIn: 46.5,
          toZIn: 118,
          wythe: "exterior" as const,
        },
      ],
    };
    expect(recipeConflicts(withBoth)).toHaveLength(1);
    expect(recipeConflicts(withBoth)[0]).toContain("vertical nailer and diagonal bracing");
    expect(recipeConflicts(tightRecipe())).toEqual([]);
  });

  it("fingerprints apart from the same boards called studs", () => {
    const asNailers = tightRecipe();
    const asStuds = { ...asNailers, added: asNailers.added.map((spec) => ({ ...spec, role: undefined })) };
    expect(recipeFingerprint(asNailers)).not.toBe(recipeFingerprint(asStuds));
  });

  it("reads the same on both halves of a pair, because a vertical has no handedness", () => {
    const left = bracePairAddedMembers({ pattern: "nailer", widthIn: W, heightIn: H, half: "left" });
    const right = bracePairAddedMembers({ pattern: "nailer", widthIn: W, heightIn: H, half: "right" });
    expect(left).toEqual(right);
  });

  it("adds nothing to a panel whose bays are already close enough", () => {
    expect(verticalNailerSpecs(PLATE_2X4_THICKNESS_IN * 2 + TIGHT_IN - 1, H, "exterior", TIGHT_IN)).toEqual([]);
  });
});
