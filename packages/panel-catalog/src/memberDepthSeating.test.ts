import { describe, expect, it } from "vitest";
import { buildPanelFromRecipe, recipeFingerprint, type PanelRecipe } from "./panelRecipe";
import { memberBoxSizeIn } from "./panelMemberHelpers";
import { overlappingMemberPairs } from "./memberPrism";
import { memberDepthSeating, newDiagonalSpec, newVerticalSpec, setMemberNominalSize, setMemberOnEdge } from "./panelEditorOps";

/**
 * **B30 — WHICH WAY A BOARD IS TURNED THROUGH THE DEPTH, 2026-11-05.**
 *
 * > *"A full height vertical should be 90 degrees plan view rotated - and
 * > should only protrude into the panel it's 1.5in depth. You should very
 * > easily be able to put a 2x6 and other sizes of nailers in. Not really sure
 * > why you would put such a fat nailer in. There should be an option to
 * > rotate it, and unable to do so if it overlaps or would hit the girt."*
 *
 * Four claims, and this file pins each one: the default is flat, the depth no
 * longer depends on the size, the rotation is available, and it is refused
 * when it would hit something.
 */

const PANEL = { widthIn: 48, depthIn: 15.5, heightIn: 96 };

function recipeWith(...added: PanelRecipe["added"]): PanelRecipe {
  return { name: "test", ...PANEL, added };
}

/** Full height, in the clear band between the two girt bars — see the girt
 * geometry note in the overlap test below for why x matters here. */
const vertical = (id = "v1", xIn = 12, extra: Record<string, unknown> = {}) =>
  ({ kind: "straight" as const, id, wythe: "exterior" as const, fromXIn: xIn, toXIn: xIn, fromZIn: 3, toZIn: 90, ...extra });

const memberOf = (recipe: PanelRecipe, id: string) => buildPanelFromRecipe(recipe).find((m) => m.memberId === id)!;

describe("⚠ a vertical lies FLAT by default", () => {
  it("reaches 1.5in into the panel and shows its wide face out", () => {
    const board = memberOf(recipeWith(vertical()), "v1");
    expect(memberBoxSizeIn(board)).toEqual({ xIn: 3.5, yIn: 1.5, zIn: 87 });
    expect(board.position.rotationDeg).toBe(90);
  });

  it("⚠ and the depth it occupies does NOT depend on the stick it is cut from", () => {
    /* His *"you should very easily be able to put a 2x6 and other sizes of
       nailers in"*, measured as the thing that makes it easy: the 2x6 is wider
       across the face and not one thousandth deeper into the straw. */
    const asIs = memberOf(recipeWith(vertical()), "v1");
    const bigger = memberOf(recipeWith(vertical("v1", 12, { nominalSize: "2x6" })), "v1");
    expect(memberBoxSizeIn(asIs).yIn).toBe(1.5);
    expect(memberBoxSizeIn(bigger).yIn).toBe(1.5);
    expect(memberBoxSizeIn(bigger).xIn).toBe(5.5);
  });

  it("stands ON EDGE when asked, and that is the only way to get 3.5in of depth", () => {
    const board = memberOf(recipeWith(vertical("v1", 12, { onEdge: true })), "v1");
    expect(memberBoxSizeIn(board)).toEqual({ xIn: 1.5, yIn: 3.5, zIn: 87 });
    expect(board.position.rotationDeg).toBe(0);
  });

  it("⚠ a HORIZONTAL was already flat, so nothing about it moved", () => {
    /* The two were inconsistent rather than both wrong — a horizontal tie has
       always lain on its wide face. This pins that B30 did not quietly change
       the other half of the pair while fixing the vertical. */
    const tie = memberOf(recipeWith({ kind: "straight", id: "h1", wythe: "exterior", fromXIn: 6, toXIn: 40, fromZIn: 40, toZIn: 40 }), "h1");
    expect(memberBoxSizeIn(tie)).toEqual({ xIn: 34, yIn: 1.5, zIn: 3.5 });
    expect(tie.position.rotationDeg).toBe(0);
  });

  it("a new vertical from the editor is centred on its own 3.5in face", () => {
    const spec = newVerticalSpec(PANEL, { wythe: "exterior" });
    expect(spec.fromXIn + 3.5 / 2).toBe(PANEL.widthIn / 2);
  });

  it("⚠ turning a board is a different PART, so the panel is a different part", () => {
    const flat = recipeWith(vertical());
    const edge = recipeWith(vertical("v1", 12, { onEdge: true }));
    expect(recipeFingerprint(flat)).not.toBe(recipeFingerprint(edge));
  });
});

describe("⚠ the rotate option, and his refusal", () => {
  /* ⚠ **The girt geometry this whole section turns on**, measured off a plain
     48 x 15.5 x 96 panel rather than assumed:

     - `girt_N_bar_left/right` — x 1.5..5 and 43..46.5, through the panel's
       WHOLE depth (y 0..15.5). A full-height board must miss these in x, flat
       or on edge, which leaves the clear band x 5..39.5.
     - `girt_N_web` — x 1.25..46.75, y 3.5..12, i.e. across the MIDDLE of the
       depth. This is the one that decides a rotation: a board laid flat sits
       at y 0..1.5 and passes in front of it; a 2x4 on edge reaches y 0..3.5
       and just touches it; a 2x6 on edge reaches 5.5 and runs through it. */

  it("lays a 2x4 on edge, because there is room for it in front of the web", () => {
    const out = setMemberOnEdge(recipeWith(vertical()), "v1", true);
    expect(out.accepted).toBe(true);
    expect(memberBoxSizeIn(memberOf(out.recipe, "v1")).yIn).toBe(3.5);
    expect(overlappingMemberPairs(buildPanelFromRecipe(out.recipe))).toEqual([]);
  });

  it("⚠ REFUSES to stand a 2x6 on edge, and names the girt it would hit", () => {
    /* His sentence, exactly: *"unable to do so if it overlaps or would hit the
       girt."* The size is allowed and the rotation is not, which is the
       opposite way round from yesterday — and the right way round, because a
       2x6 standing on edge is the *"fat nailer"* he asked about. */
    const sized = setMemberNominalSize(recipeWith(vertical()), "v1", "2x6");
    expect(sized.accepted).toBe(true);
    const out = setMemberOnEdge(sized.recipe, "v1", true);
    expect(out.accepted).toBe(false);
    expect(out.message).toContain("girt");
    expect(out.message).toContain("5.5");
    /* Refused means unchanged — not nearly unchanged. */
    expect(recipeFingerprint(out.recipe)).toBe(recipeFingerprint(sized.recipe));
  });

  it("turns it back flat again", () => {
    const edge = recipeWith(vertical("v1", 12, { onEdge: true }));
    const out = setMemberOnEdge(edge, "v1", false);
    expect(out.accepted).toBe(true);
    expect(memberOf(out.recipe, "v1").position.rotationDeg).toBe(90);
  });

  it("asking for the seating it already has does nothing, quietly", () => {
    const flat = recipeWith(vertical());
    const out = setMemberOnEdge(flat, "v1", false);
    expect(out.accepted).toBe(true);
    expect(out.message).toBeNull();
    expect(out.recipe).toBe(flat);
  });

  it("⚠ refuses a DIAGONAL, for a different reason than its size is refused", () => {
    const out = setMemberOnEdge(recipeWith({ ...newDiagonalSpec(PANEL, { wythe: "exterior" }), id: "d1" }), "d1", true);
    expect(out.accepted).toBe(false);
    expect(out.message).toContain("different part");
  });

  it("reports what a board is seated as", () => {
    expect(memberDepthSeating(vertical())).toBe("flat");
    expect(memberDepthSeating(vertical("v1", 12, { onEdge: true }))).toBe("on-edge");
    expect(memberDepthSeating(newDiagonalSpec(PANEL, { wythe: "exterior" }))).toBe("brace");
  });

  it("⚠ every seating leaves a buildable panel or refuses outright", () => {
    for (const onEdge of [true, false]) {
      for (const nominalSize of ["2x4", "2x6"] as const) {
        const seeded = setMemberNominalSize(recipeWith(vertical()), "v1", nominalSize);
        const out = setMemberOnEdge(seeded.recipe, "v1", onEdge);
        expect({ onEdge, nominalSize, overlaps: overlappingMemberPairs(buildPanelFromRecipe(out.recipe)) }).toEqual({
          onEdge,
          nominalSize,
          overlaps: [],
        });
        if (!out.accepted) expect(out.message).not.toBeNull();
      }
    }
  });
});
