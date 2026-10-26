import { describe, expect, it } from "vitest";
import {
  ALTERNATIVE_STUD_PACKS,
  COLUMN_SKIN_NAILS_PER_6IN,
  DEFAULT_STUD_PACK,
  STRUCTURAL_COLUMN_WIDTH_IN,
  buildStructuralColumnMembers,
  columnSkinNailCount,
} from "./structuralColumnMembers";
import { overlappingMemberPairs } from "./memberPrism";
import { COLUMN_TOTAL_WIDTH_IN } from "./columnPanelMembers";

const H = 108;

describe("the column under a roof catcher beam", () => {
  it("⚠ is 15 1/2in square — NOT the existing 25 1/2in Column Panel", () => {
    /* Two different things with similar names. A beam landing on the wall
       panel would be sitting on something 10in wider than he asked for. */
    expect(STRUCTURAL_COLUMN_WIDTH_IN).toBe(15.5);
    expect(COLUMN_TOTAL_WIDTH_IN).toBe(25.5);
    expect(STRUCTURAL_COLUMN_WIDTH_IN).not.toBe(COLUMN_TOTAL_WIDTH_IN);
  });

  it("defaults to a 4-pack of 2x8s", () => {
    expect(DEFAULT_STUD_PACK).toEqual({ count: 4, nominalSize: "2x8" });
    const built = buildStructuralColumnMembers({ heightIn: H });
    expect(built.refusal).toBeNull();
    const studs = built.members.filter((m) => m.memberId.startsWith("column_stud_"));
    expect(studs).toHaveLength(4);
    for (const s of studs) {
      expect(s.nominalSize).toBe("2x8");
      expect(s.actualDimsIn.thicknessIn).toBe(1.5);
      expect(s.actualDimsIn.widthIn).toBe(7.25);
      expect(s.actualDimsIn.lengthIn).toBe(H);
    }
  });

  it("⚠ a 4-pack of 2x8s is 6in of a 15 1/2in column, and says so", () => {
    /* Worth reporting rather than quietly centring something much smaller
       than the hole it stands in: 6in of pack in a 15.5in square leaves
       9.5in of slack. Whether that slack should be straw, more plies or a
       narrower column is his call. */
    const built = buildStructuralColumnMembers({ heightIn: H });
    expect(built.packWidthIn).toBe(6);
    expect(STRUCTURAL_COLUMN_WIDTH_IN - built.packWidthIn).toBe(9.5);
  });

  it("adjusts to the other packs he named", () => {
    // "adjustable to make into other types of stud packs like 3 2x6s"
    expect(ALTERNATIVE_STUD_PACKS).toContainEqual({ count: 3, nominalSize: "2x6" });
    const built = buildStructuralColumnMembers({ heightIn: H, pack: { count: 3, nominalSize: "2x6" } });
    expect(built.packWidthIn).toBe(4.5);
    const studs = built.members.filter((m) => m.memberId.startsWith("column_stud_"));
    expect(studs).toHaveLength(3);
    expect(studs[0]!.actualDimsIn.widthIn).toBe(5.5);
  });

  it("the pack is centred, in both directions", () => {
    const built = buildStructuralColumnMembers({ heightIn: H });
    const studs = built.members.filter((m) => m.memberId.startsWith("column_stud_"));
    const left = Math.min(...studs.map((s) => s.position.xIn));
    const right = Math.max(...studs.map((s) => s.position.xIn + s.actualDimsIn.thicknessIn));
    expect(left).toBeCloseTo(STRUCTURAL_COLUMN_WIDTH_IN - right, 9);
    const front = studs[0]!.position.yIn;
    const back = STRUCTURAL_COLUMN_WIDTH_IN - (front + studs[0]!.actualDimsIn.widthIn);
    expect(front).toBeCloseTo(back, 9);
  });

  it("carries a 3/4in plywood skin on each face", () => {
    // "3/4in plywood skins similar to safety gap plywood"
    const built = buildStructuralColumnMembers({ heightIn: H });
    const skins = built.members.filter((m) => m.role === "skin");
    expect(skins).toHaveLength(2);
    for (const s of skins) expect(s.actualDimsIn.thicknessIn).toBe(0.75);
    expect(buildStructuralColumnMembers({ heightIn: H, includeSkins: false }).members.filter((m) => m.role === "skin")).toEqual([]);
  });

  it("⚠ the sheathing nails are counted, which is what he asked for", () => {
    /* "nailed on with sheathing nails 2 per 6 inches count those for material
       counts." Read as 2 per 6in down each vertical edge of each skin: two
       edges, two skins. A different reading would give a different number
       and nobody has said which. */
    expect(COLUMN_SKIN_NAILS_PER_6IN).toBe(2);
    // 108in tall: 18 lots of 6in, 2 nails each, 2 edges, 2 skins.
    expect(columnSkinNailCount(108)).toBe(144);
    expect(columnSkinNailCount(108, 1)).toBe(72);
  });

  it("⚠ no two members share space", () => {
    for (const pack of [DEFAULT_STUD_PACK, ...ALTERNATIVE_STUD_PACKS]) {
      const built = buildStructuralColumnMembers({ heightIn: H, pack });
      expect({ pack, overlaps: overlappingMemberPairs(built.members) }).toEqual({ pack, overlaps: [] });
    }
  });
});

describe("what it refuses", () => {
  it("⚠ a pack too big for the column, with both measurements", () => {
    const built = buildStructuralColumnMembers({ heightIn: H, pack: { count: 12, nominalSize: "2x12" } });
    expect(built.members).toEqual([]);
    expect(built.refusal).toContain("does not fit");
    expect(built.refusal).toContain("18in");
  });

  it("a board that is too deep for the column, not just too wide a pack", () => {
    const built = buildStructuralColumnMembers({ heightIn: H, depthIn: 6, pack: { count: 2, nominalSize: "2x8" } });
    expect(built.refusal).toContain("does not fit");
  });

  it("a size nobody has dressed dimensions for", () => {
    const built = buildStructuralColumnMembers({ heightIn: H, pack: { count: 4, nominalSize: "2x14" as "2x8" } });
    expect(built.refusal).toContain("No dressed size");
  });

  it("a column with no height", () => {
    expect(buildStructuralColumnMembers({ heightIn: 0 }).refusal).toContain("needs a height");
  });
});
