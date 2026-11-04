import { describe, expect, it } from "vitest";
import type { PanelMember } from "./componentSchema";
import { overlappingMemberPairs } from "./memberPrism";
import {
  BRACE_PAIR_PATTERNS,
  bracePairAddedMembers,
  verticalNailerSpecs,
} from "./bracePairPatterns";
import { buildPanelFromRecipe, hasAddedNailer, recipeConflicts, recipeFingerprint } from "./panelRecipe";
import { MAX_STUD_SPACING_IN, PLATE_2X4_THICKNESS_IN, centreNailerStudSpansIn } from "./panelMemberHelpers";
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
 * Before this the `nailer` pattern returned an empty list, so the button set a
 * field and changed nothing a shop could see. These tests hold the three things
 * that make the overlay real rather than decorative: that it adds members, that
 * they fit (nothing overlaps and nothing leaves the panel), and that it still
 * reports zero shear — because a vertical does not brace, and the covering that
 * does is not modelled.
 */

const W = 48;
const D = 15.5;
const H = 120;
const SPACING = nailerOverlaySpacingIn.value;

const nailerRecipe = (widthIn = W, includeNailer = false) => ({
  name: "overlay",
  widthIn,
  depthIn: D,
  heightIn: H,
  includeNailer,
  girtStyle: "web" as const,
  added: bracePairAddedMembers({ pattern: "nailer" as const, widthIn, heightIn: H, half: "left" as const }),
});

/** Where a vertical member's 1.5in face sits in x, as [start, end]. */
function verticalSpansIn(members: PanelMember[], wytheYIn: number): [number, number][] {
  return members
    .filter((m) => m.orientation === "vertical" && Math.abs(m.position.yIn - wytheYIn) < 1e-9)
    .map((m) => [m.position.xIn, m.position.xIn + m.actualDimsIn.thicknessIn] as [number, number])
    .sort((a, b) => a[0] - b[0]);
}

describe("B21 — the vertical nailer overlay", () => {
  it("adds real members where it used to add nothing", () => {
    const specs = bracePairAddedMembers({ pattern: "nailer", widthIn: W, heightIn: H, half: "left" });
    expect(specs.length).toBeGreaterThan(0);
    /* Every one is a square-cut vertical on the exterior, carrying its own
       role — "just on the exterior" and "straight up and down". */
    for (const spec of specs) {
      expect(spec.kind).toBe("straight");
      expect(spec.wythe).toBe("exterior");
      if (spec.kind !== "straight") throw new Error("unreachable");
      expect(spec.role).toBe("nailer");
      expect(spec.fromXIn).toBe(spec.toXIn);
      expect(spec.toZIn).toBeGreaterThan(spec.fromZIn);
    }
  });

  it("a 48in panel takes one nailer in each of its two stud bays", () => {
    /* Pinned as a MEASUREMENT, not an invariant: at a 16in spacing a 48in
       panel's two ~21.75in clear bays each need splitting once. If the
       spacing value changes this number moves, and it should. */
    expect(SPACING).toBe(16);
    expect(bracePairAddedMembers({ pattern: "nailer", widthIn: W, heightIn: H, half: "left" })).toHaveLength(2);
  });

  it("brings every face-to-face gap on the exterior face under the spacing", () => {
    for (const widthIn of [24, 36, 48, 60, 72, 96]) {
      const members = buildPanelFromRecipe(nailerRecipe(widthIn));
      const spans = verticalSpansIn(members, 0);
      for (let i = 0; i < spans.length - 1; i++) {
        const gapIn = spans[i + 1]![0] - spans[i]![1];
        expect({ widthIn, over: gapIn > SPACING + 1e-9 }).toEqual({ widthIn, over: false });
      }
    }
  });

  it("⚠ adds boards only where the bays need them — a 36in panel already passes", () => {
    /* MEASURED, and worth knowing before a shop sees two panels on one wall
       built differently: the overlay's rule is "no gap over the spacing", and
       a 36in panel's centre nailer stud already splits it into two 15.75in
       bays. At 16in there is nothing left to subdivide, so it gets none. If
       he sets the spacing to 12in this row fills in. */
    const added = (widthIn: number) => verticalNailerSpecs(widthIn, H).length;
    expect({ 24: added(24), 36: added(36), 48: added(48), 60: added(60), 72: added(72), 96: added(96) }).toEqual({
      24: 1,
      36: 0,
      48: 2,
      60: 3,
      72: 3,
      96: 4,
    });
  });

  it("lands the nailers in the bays, never on a stud that is already there", () => {
    for (const widthIn of [24, 48, 72, 96]) {
      const specs = verticalNailerSpecs(widthIn, H);
      const occupied: [number, number][] = [
        [0, PLATE_2X4_THICKNESS_IN],
        ...centreNailerStudSpansIn(widthIn),
        [widthIn - PLATE_2X4_THICKNESS_IN, widthIn],
      ];
      for (const spec of specs) {
        const from = spec.fromXIn;
        const to = from + PLATE_2X4_THICKNESS_IN;
        for (const [a, b] of occupied) {
          /* Disjoint in x: either wholly left of the stud or wholly right. */
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
      const overlay = overlappingMemberPairs(buildPanelFromRecipe(nailerRecipe(widthIn)));
      const plain = overlappingMemberPairs(buildStandardPanelMembers(widthIn, D, H, false, "web"));
      /* A DELTA, because the plain standard panel already reports pairs of its
         own (see girtStyles.test.ts) and this is not the place to fix them. */
      expect({ widthIn, added: overlay.filter((p) => !plain.includes(p)) }).toEqual({ widthIn, added: [] });
    }
  });

  it("stops at the plate faces, which makes it the same cut as a centre nailer stud", () => {
    const members = buildPanelFromRecipe(nailerRecipe());
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
    const members = buildPanelFromRecipe(nailerRecipe());
    expect(members.filter((m) => m.role === "nailer").every((m) => m.position.yIn === 0)).toBe(true);
    /* And the interior face is left exactly as a plain standard panel's. */
    const plain = buildStandardPanelMembers(W, D, H, false, "web");
    expect(verticalSpansIn(members, D - 3.5)).toEqual(verticalSpansIn(plain, D - 3.5));
  });

  it("replaces the single centre nailer rather than standing beside it", () => {
    /* ⚠ The centre nailer member sits at mid-width, where a 48in panel's
       centre nailer STUD already is. Keeping both put a third 2x4 in one
       groove, and `overlappingMemberPairs` was reporting it. */
    const withFlag = buildPanelFromRecipe(nailerRecipe(W, true));
    expect(hasAddedNailer(nailerRecipe(W, true))).toBe(true);
    expect(withFlag.some((m) => m.memberId === "nailer")).toBe(false);
    /* The flag alone, with no overlay, still builds it — nothing else changed. */
    expect(
      buildPanelFromRecipe({ ...nailerRecipe(W, true), added: [] }).some((m) => m.memberId === "nailer"),
    ).toBe(true);
  });

  it("still refuses to pair nailers with diagonals, now by the PART and not by the flag", () => {
    const withBoth = {
      ...nailerRecipe(),
      added: [
        ...nailerRecipe().added,
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
    /* The overlay on its own is no conflict. */
    expect(recipeConflicts(nailerRecipe())).toEqual([]);
  });

  it("is still worth ZERO shear, and that is the honest answer", () => {
    /* A vertical does not resist racking; the covering nailed to it does, and
       this app does not model coverings. `derivePanelShear` reads
       `role === "brace"` and a nailer is not one — which is exactly why the
       overlay carries `role: "nailer"` rather than inheriting `stud`. */
    const members = buildPanelFromRecipe(nailerRecipe());
    expect(derivePanelShear("overlay", members).braces).toEqual([]);
    expect(derivePanelShear("overlay", members).totalHorizontalLb).toBe(0);
  });

  it("fingerprints apart from the same boards called studs", () => {
    const asNailers = nailerRecipe();
    const asStuds = {
      ...asNailers,
      added: asNailers.added.map((spec) => ({ ...spec, role: undefined })),
    };
    expect(recipeFingerprint(asNailers)).not.toBe(recipeFingerprint(asStuds));
  });

  it("reads the same on both halves of a pair, because a vertical has no handedness", () => {
    const left = bracePairAddedMembers({ pattern: "nailer", widthIn: W, heightIn: H, half: "left" });
    const right = bracePairAddedMembers({ pattern: "nailer", widthIn: W, heightIn: H, half: "right" });
    expect(left).toEqual(right);
  });

  it("adds nothing to a panel whose bays are already close enough", () => {
    /* A narrow panel's two corner posts are nearer to each other than the
       spacing, so there is nothing to subdivide — the overlay is a no-op and
       says so by returning an empty list rather than forcing a board in. */
    expect(verticalNailerSpecs(PLATE_2X4_THICKNESS_IN * 2 + SPACING - 1, H)).toEqual([]);
  });

  it("would be a no-op at or above the stud spacing, which is why 16 is the default", () => {
    /* Not a hypothetical: `MAX_STUD_SPACING_IN` is the guarantee a standard
       panel already makes, so a nailer spacing of 24 could never add a board
       to a 48in panel. This is the argument recorded in the catalog value's
       own note, held as a test so it cannot quietly stop being true. */
    expect(SPACING).toBeLessThan(MAX_STUD_SPACING_IN);
    const bayIn = W / 2 - PLATE_2X4_THICKNESS_IN;
    expect(Math.ceil(bayIn / MAX_STUD_SPACING_IN - 1e-9)).toBe(1);
    expect(Math.ceil(bayIn / SPACING - 1e-9)).toBe(2);
  });

  it("the spacing is flagged as his to confirm, not presented as settled", () => {
    expect(nailerOverlaySpacingIn.status).toBe("pending-BI-confirmation");
  });

  it("the button is no longer called a Nailer Pair", () => {
    const entry = BRACE_PAIR_PATTERNS.find((p) => p.id === "nailer")!;
    expect(entry.label).toBe("Vertical Nailers");
    expect(entry.description).toContain("exterior face only");
    /* It must keep saying what it does NOT do. */
    expect(entry.description).toContain("No diagonal");
  });
});
