import { describe, expect, it } from "vitest";
import {
  deleteMemberSpec,
  dragMemberSpec,
  duplicateMemberSpec,
  newDiagonalSpec,
  newVerticalSpec,
  retypeDiagonalOnAxis,
  setMemberNominalSize,
  setMemberWythe,
} from "./panelEditorOps";
import { buildPanelFromRecipe, recipeFingerprint, type PanelRecipe } from "./panelRecipe";
import { overlappingMemberPairs } from "./memberPrism";

const PANEL = { widthIn: 48, depthIn: 15.5, heightIn: 96 };

function recipeWith(...added: PanelRecipe["added"]): PanelRecipe {
  return { name: "test", ...PANEL, added };
}

const diagonal = (id = "d1") => ({ ...newDiagonalSpec(PANEL, { wythe: "exterior" }), id });

/**
 * ⚠ **Placed at x=12, not where `newVerticalSpec` puts it.** A new vertical
 * is born at the panel's CENTRE, which on a plain 48in panel is exactly where
 * `stud_centre_1` already stands — so a fixture built from the default starts
 * life overlapping the base panel, and every overlap assertion downstream
 * measures that instead of the thing under test. (The editor itself is not
 * wrong to put it there: a panel being edited usually has a diagonal, and
 * `buildPanelFromRecipe` drops the centre studs when it does.)
 */
/** Clear of both girt rows (which sit around a third and two thirds up a
 * 96in panel), so a resize has only the frame to answer to. */
const shortVertical = (id = "v1", xIn = 12) =>
  ({ kind: "straight" as const, id, wythe: "exterior" as const, fromXIn: xIn, toXIn: xIn, fromZIn: 3, toZIn: 20 });

const vertical = (id = "v1", xIn = 12, wythe: "exterior" | "interior" = "exterior") =>
  ({ kind: "straight" as const, id, wythe, fromXIn: xIn, toXIn: xIn, fromZIn: 3, toZIn: 90 });

describe("⚠ B19 stride 2 — the drag, and his four answers of 2026-11-05", () => {
  it("moves a board and keeps it rigid — same length, same angle", () => {
    const recipe = recipeWith(diagonal());
    const before = recipe.added[0]!;
    const out = dragMemberSpec(recipe, "d1", 2, 0);
    expect(out.accepted).toBe(true);
    const after = out.recipe.added[0]!;
    const len = (s: typeof before) => Math.hypot(s.toXIn - s.fromXIn, s.toZIn - s.fromZIn);
    expect(len(after)).toBeCloseTo(len(before), 6);
  });

  it("⚠ snaps to a NEIGHBOUR's face, not just to the eighth grid", () => {
    /* His answer: *"Neighbour faces, then 1/8in."* A vertical dropped a hair
       off the panel's own left stud face lands ON it, because a board you
       meant to put against something should end up against it. */
    const v = vertical("v1", 1.6);
    const out = dragMemberSpec(recipeWith(v), "v1", 0, 0);
    expect(out.accepted).toBe(true);
    const moved = out.recipe.added[0]!;
    /* 1.5in is the inner face of the left stud double — a real member's face,
       not a grid line. 1.6 is already on no eighth, so a grid-only snap would
       have put it at 1.625. */
    expect(moved.fromXIn).toBeCloseTo(1.5, 6);
    expect(moved.fromXIn).not.toBeCloseTo(1.625, 6);
  });

  it("⚠ REFUSES a drop that would put two boards through each other", () => {
    /* His standing rule, and his answer when asked what a drag should do about
       it: refuse the drop and snap back. */
    const recipe = recipeWith(vertical("v1", 12), vertical("v2", 30));
    const out = dragMemberSpec(recipe, "v2", -18, 0);
    expect(out.accepted).toBe(false);
    expect(out.message).toContain("v1");
    expect(out.recipe).toBe(recipe);
  });

  it("⚠ a refused drag leaves the panel EXACTLY as it was", () => {
    /* Not "nearly" — the fingerprint is what decides whether this panel is
       its own fabricated part, so a refused drag must not change it. */
    const recipe = recipeWith(vertical("v1", 12), vertical("v2", 30));
    const before = recipeFingerprint(recipe);
    expect(recipeFingerprint(dragMemberSpec(recipe, "v2", -18, 0).recipe)).toBe(before);
  });

  it("⚠ an accepted drag never leaves a new overlap behind", () => {
    /* The audit, not the arithmetic: whatever the snapping did, the panel the
       drag produced is buildable. Swept across a range of drags rather than
       asserted at one spot. */
    /* The vertical is on the INTERIOR face, so the only thing the diagonal can
       collide with as it moves is the base panel's own frame. */
    const recipe = recipeWith(diagonal("d1"), vertical("v1", 40, "interior"));
    for (const dx of [-8, -3, -1, 0, 1, 3, 8]) {
      for (const dz of [-6, 0, 6]) {
        const out = dragMemberSpec(recipe, "d1", dx, dz);
        if (!out.accepted) continue;
        expect({ dx, dz, overlaps: overlappingMemberPairs(buildPanelFromRecipe(out.recipe)) }).toEqual({
          dx,
          dz,
          overlaps: [],
        });
      }
    }
  });
});

describe("⚠ a brace dragged plumb stops being a brace", () => {
  it("converts to a vertical NAILER, and says so", () => {
    /* His answer: *"Convert it, and say so."* The hazard it closes is the
       shear check, which credits `role === \"brace\"` and nothing else. */
    const d = { ...diagonal(), fromXIn: 20, fromZIn: 3, toXIn: 20, toZIn: 90 };
    const { spec, message } = retypeDiagonalOnAxis(d);
    expect(spec.kind).toBe("straight");
    expect(spec.kind === "straight" && spec.role).toBe("nailer");
    expect(message).toContain("no racking");
  });

  it("a brace dragged LEVEL becomes blocking, not a nailer", () => {
    /* A nailer is a vertical for fixing shear coverings. A board lying level
       is blocking, and calling it a nailer would be a lie the cut list and the
       Review Log would both repeat. */
    const d = { ...diagonal(), fromXIn: 4, fromZIn: 40, toXIn: 44, toZIn: 40 };
    const { spec } = retypeDiagonalOnAxis(d);
    expect(spec.kind).toBe("straight");
    expect(spec.kind === "straight" && spec.role).toBeUndefined();
  });

  it("leaves a real diagonal alone", () => {
    const { spec, message } = retypeDiagonalOnAxis(diagonal());
    expect(spec.kind).toBe("diagonal");
    expect(message).toBeNull();
  });

  it("⚠ and the panel it produces no longer counts that board as a brace", () => {
    /* The point of the conversion, measured where it matters rather than on
       the spec: the built member's own role. */
    const d = { ...diagonal(), fromXIn: 20, fromZIn: 3, toXIn: 20, toZIn: 90 };
    const { spec } = retypeDiagonalOnAxis(d);
    const members = buildPanelFromRecipe(recipeWith(spec));
    const board = members.find((m) => m.memberId === "d1")!;
    expect(board.role).toBe("nailer");
    expect(members.filter((m) => m.role === "brace")).toHaveLength(0);
  });
});

describe("⚠ the member right-click menu — his four actions", () => {
  it("deletes a board", () => {
    const out = deleteMemberSpec(recipeWith(vertical(), diagonal()), "v1");
    expect(out.accepted).toBe(true);
    expect(out.recipe.added.map((s) => s.id)).toEqual(["d1"]);
  });

  it("⚠ duplicates BESIDE the original, never on top of it", () => {
    const out = duplicateMemberSpec(recipeWith(vertical()), "v1", "v2");
    expect(out.accepted).toBe(true);
    expect(overlappingMemberPairs(buildPanelFromRecipe(out.recipe))).toEqual([]);
    const [a, b] = out.recipe.added;
    expect(a!.fromXIn).not.toBeCloseTo(b!.fromXIn, 6);
  });

  it("changes a straight board's lumber size, and the built member follows", () => {
    /* A SHORT vertical, clear of both girt rows — see the refusal test below
       for why a full-height one cannot be a 2x6 at all. */
    const out = setMemberNominalSize(recipeWith(shortVertical()), "v1", "2x6");
    expect(out.accepted).toBe(true);
    const board = buildPanelFromRecipe(out.recipe).find((m) => m.memberId === "v1")!;
    expect(board.nominalSize).toBe("2x6");
    expect(board.actualDimsIn.widthIn).toBe(5.5);
    /* ⚠ A 2x6 is wider, NOT thicker — both sticks are 1.5in through. */
    expect(board.actualDimsIn.thicknessIn).toBe(1.5);
  });

  it("⚠ a FULL-HEIGHT vertical cannot become a 2x6, and that is correct", () => {
    /* Found by writing this test rather than by reasoning: a 2x6 standing on
       edge flush with the exterior face reaches 5.5in into a 15.5in panel,
       and the girt web sits across the middle of that depth — so every
       full-height vertical that crosses a girt row collides with its web.
       The refusal names the webs it hit. Worth knowing before anyone expects
       "change lumber size" to work on a full stud: in a girted panel it
       mostly will not, and the honest answer is the refusal rather than a
       2x6 modelled passing through a sheet of plywood. */
    const out = setMemberNominalSize(recipeWith(vertical()), "v1", "2x6");
    expect(out.accepted).toBe(false);
    expect(out.message).toContain("girt");
  });

  it("⚠ refuses to resize a DIAGONAL, with the reason", () => {
    /* Not an oversight and not a TODO: the brace geometry helpers measure off
       a 2x4's width, so a 2x6 brace moves every mitre in the app. */
    const out = setMemberNominalSize(recipeWith(diagonal()), "d1", "2x6");
    expect(out.accepted).toBe(false);
    expect(out.message).toContain("building decision");
  });

  it("⚠ a resized board is a different PART, so the panel is a different part", () => {
    const before = recipeWith(shortVertical());
    const after = setMemberNominalSize(before, "v1", "2x6").recipe;
    expect(recipeFingerprint(after)).not.toBe(recipeFingerprint(before));
  });

  it("moves a board to the other wythe", () => {
    const out = setMemberWythe(recipeWith(vertical()), "v1", "interior");
    expect(out.accepted).toBe(true);
    expect(out.recipe.added[0]!.wythe).toBe("interior");
    expect(overlappingMemberPairs(buildPanelFromRecipe(out.recipe))).toEqual([]);
  });

  it("⚠ and refuses when the other face is already taken", () => {
    const out = setMemberWythe(recipeWith(vertical("v1", 12, "exterior"), vertical("v2", 12, "interior")), "v1", "interior");
    expect(out.accepted).toBe(false);
    expect(out.message).toContain("interior");
  });

  it("every action leaves a buildable panel or refuses outright", () => {
    /* One sweep over the whole menu: whatever each action does, the panel it
       hands back passes the same audit the app pins floor panels with. */
    const recipe = recipeWith(vertical("v1", 12, "interior"), diagonal("d1"));
    const results = [
      deleteMemberSpec(recipe, "v1"),
      duplicateMemberSpec(recipe, "v1", "v9"),
      setMemberNominalSize(recipe, "v1", "2x6"),
      setMemberWythe(recipe, "v1", "interior"),
      dragMemberSpec(recipe, "v1", 4, 2),
    ];
    for (const out of results) {
      expect(overlappingMemberPairs(buildPanelFromRecipe(out.recipe))).toEqual([]);
      if (!out.accepted) expect(out.message).not.toBeNull();
    }
  });
});
