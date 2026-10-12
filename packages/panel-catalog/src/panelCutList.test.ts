import { describe, expect, it } from "vitest";
import { computePanelCutList } from "./panelCutList";
import { buildColumnPanelMembers } from "./columnPanelMembers";
import { buildBracedPanelMembers } from "./bracedPanelMembers";
import { buildSafetyGapMembers } from "./safetyGapMembers";
import type { PanelMember } from "./componentSchema";

describe("computePanelCutList", () => {
  it("merges members that share material/nominalSize/actualDimsIn into one lettered row, regardless of role", () => {
    // A Column Panel's blocking (role "blocking") is deliberately built to
    // match the plate runners' (role "plate") own length exactly (same
    // PLATE_END_CLEARANCE_IN-derived formula) — a shop cutting a batch of
    // these identical 2x4s doesn't care which role a given stick fills.
    const members = buildColumnPanelMembers(15.5, 120, false);
    const rows = computePanelCutList(members);
    const plate = members.find((m) => m.role === "plate")!;
    const blocking = members.find((m) => m.role === "blocking")!;
    expect(plate.actualDimsIn).toEqual(blocking.actualDimsIn);

    const row = rows.find((r) => r.members.includes(plate))!;
    expect(row.members).toContain(blocking);
  });

  it("orders letters by role priority (plates/studs first, skins last), then by first-occurrence position", () => {
    const members = buildColumnPanelMembers(15.5, 120, false);
    const rows = computePanelCutList(members);
    const roleOrderSeen = rows.map((r) => r.role);
    // Every row's role priority should be non-decreasing across the list.
    const ROLE_PRIORITY_ORDER = ["plate", "stud", "jack_stud", "girt", "girt_web", "nailer", "brace", "blocking", "skin"];
    const priorities = roleOrderSeen.map((role) => ROLE_PRIORITY_ORDER.indexOf(role));
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]!);
    }
    // Letters assigned A, B, C... in that same order.
    expect(rows.map((r) => r.letter)).toEqual(rows.map((_, i) => String.fromCharCode(65 + i)));
  });

  it("gives a true trapezoid brace a 'long point, beveled ends' qualifier with both cut angles", () => {
    const members = buildBracedPanelMembers(40, 15.5, 120, false, "chevron", false);
    const rows = computePanelCutList(members);
    const braceRow = rows.find((r) => r.role === "brace")!;
    expect(braceRow.dimensions).toContain("long point, beveled ends");
    expect(braceRow.dimensions).toMatch(/\d+\.\d° level \/ \d+\.\d° plumb/);
  });

  it("formats a plywood row's dimensions as a 2-dim sheet size (thickness lives in the Part label instead)", () => {
    const members = buildColumnPanelMembers(15.5, 120, false);
    const rows = computePanelCutList(members);
    const skinRow = rows.find((r) => r.material === "plywood" && r.role === "skin")!;
    expect(skinRow.dimensions).toMatch(/^\d+(\.\d+)?" x \d+(\.\d+)?"$/);
    expect(skinRow.partLabel).toMatch(/^3\/4" Plywood/);
  });

  it("differentiates Column/Corner's side plywood ('Side Ply') from a flat skin ('Skin') in the part label", () => {
    const members = buildColumnPanelMembers(15.5, 120, false);
    const rows = computePanelCutList(members);
    const sidePlyRow = rows.find((r) => r.role === "skin" && r.members[0]!.orientation === "vertical")!;
    expect(sidePlyRow.partLabel).toContain("Side Ply");
    const flatSkinRow = rows.find((r) => r.role === "skin" && r.members[0]!.orientation === "flat")!;
    expect(flatSkinRow.partLabel).toContain("Skin");
    expect(flatSkinRow.partLabel).not.toContain("Side Ply");
  });

  it("produces exactly one row for a Safety/Gap panel's single member", () => {
    const members = buildSafetyGapMembers(15.5, 120);
    const rows = computePanelCutList(members);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.letter).toBe("A");
    expect(rows[0]!.qty).toBe(1);
  });

  it("counts qty as the number of distinct member positions sharing a letter, not each member's own qty field", () => {
    const members = buildColumnPanelMembers(15.5, 120, false);
    const rows = computePanelCutList(members);
    const studRow = rows.find((r) => r.role === "stud")!;
    const realStudCount = members.filter((m) => m.role === "stud").length;
    expect(studRow.qty).toBe(realStudCount);
    expect(studRow.qty).toBeGreaterThan(1);
  });

  it("excludes non-lumber/plywood materials from the cut list", () => {
    const fakeFastener: PanelMember = {
      memberId: "fake_fastener",
      material: "fastener",
      speciesGrade: null,
      plySpec: null,
      nominalSize: null,
      actualDimsIn: { thicknessIn: 0.25, widthIn: 0.25, lengthIn: 4 },
      orientation: "vertical",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "blocking",
      qty: 1,
    };
    const rows = computePanelCutList([fakeFastener]);
    expect(rows).toHaveLength(0);
  });

  it("assigns the same letter to a panel's cut list deterministically across repeated calls", () => {
    const members = buildBracedPanelMembers(40, 15.5, 120, true, "hatch", false);
    const first = computePanelCutList(members).map((r) => `${r.letter}:${r.partLabel}`);
    const second = computePanelCutList(members).map((r) => `${r.letter}:${r.partLabel}`);
    expect(first).toEqual(second);
  });
});

/**
 * ⚠ THE SHOP COLUMNS, ON REAL GEOMETRY RATHER THAN A FIXTURE.
 *
 * `shopCutNotes.test.ts` next door proves the formatters and the triangle maths
 * against hand-built `BraceEndCut`s. That is necessary but not sufficient: it
 * cannot catch a wrong angle being FED to a correct formatter. These run a real
 * Braced Panel through the real builder and read what a shop would be handed.
 */
describe("the shop columns Tommy asked for, 2026-10-11", () => {
  const members = buildBracedPanelMembers(40, 15.5, 120, false, "chevron", false);
  const rows = computePanelCutList(members);

  it("material is the denominational name on its own, not buried in the part label", () => {
    // His words: "using common denominational names for dimensional lumber
    // like 2x4 as materials".
    const lumber = rows.filter((r) => r.material === "dimensional_lumber");
    expect(lumber.length).toBeGreaterThan(0);
    for (const row of lumber) expect(row.materialLabel).toMatch(/^\d+x\d+$/);
    expect(rows.some((r) => r.materialLabel === "2x4")).toBe(true);
  });

  it("every row carries a length, and a sheet carries both of its sides", () => {
    for (const row of rows) expect(row.lengthLabel).toMatch(/\d/);
    const sheet = rows.find((r) => r.material === "plywood");
    if (sheet) expect(sheet.lengthLabel).toContain(" x ");
  });

  it("a square-cut row says Square and carries NO note", () => {
    // The note cell is blank on purpose: a sentence on every row buries the
    // handful that actually need the saw reset.
    const square = rows.filter((r) => r.angleLabel === "Square");
    expect(square.length).toBeGreaterThan(0);
    for (const row of square) expect(row.cutNote).toBe("");
  });

  it("⚠ THE BRACE: COMPLEMENTARY end cuts, with the jig legs spelled out", () => {
    /* A chevron brace meets a plate and a stud — one level end, one plumb end.
       On a 40" x 120" panel that is ~32.6° and ~57.4°, NOT 45°: this test first
       asserted 45° on my assumption and the real builder corrected it. The
       invariant is that a plumb end and a level end on the same board are
       complementary, which holds at any panel proportion — so that is what is
       checked, rather than one panel's numbers. */
    const brace = rows.find((r) => r.role === "brace")!;
    const angles = [...brace.cutNote.matchAll(/~?([\d.]+)°/g)].map((m) => Number(m[1]));
    expect(angles).toHaveLength(2);
    expect(angles[0]! + angles[1]!).toBeCloseTo(90, 1);
    // And neither is square, or there would be no jig to build.
    for (const a of angles) expect(a).toBeGreaterThan(1);
    expect(brace.angleLabel).toContain("off square");
    expect(brace.cutNote).toContain("lands level");
    expect(brace.cutNote).toContain("lands plumb");
    expect(brace.cutNote).toContain("across the face");
    expect(brace.cutNote).toContain("along the length");
    expect(brace.cutNote).toContain("jig block");
    // Same angle but different kinds, so it must NOT be collapsed into one
    // sentence — a crew checking a finished piece needs to know which end is
    // which.
    expect(brace.cutNote.startsWith("Both ends the same.")).toBe(false);
    expect(brace.cutNote).toContain("End 1:");
    expect(brace.cutNote).toContain("End 2:");
  });

  it("⚠ BOTH ends give the SAME across-leg — the stock width, exactly, no tilde", () => {
    /* The point of sizing the jig from stock rather than from the modelled
       face. This brace's modelled face is a slightly non-parallel
       quadrilateral: measured across, its two ends are 3.4628" and 3.5156" on
       a 2x4. A jig is cut from stock, so both ends read 3½" — and read it
       EXACTLY, with no tilde, which is the visible proof that no trig noise is
       being rounded away. */
    const brace = rows.find((r) => r.role === "brace")!;
    const across = [...brace.cutNote.matchAll(/triangle (\S+) across the face/g)].map((m) => m[1]);
    expect(across).toHaveLength(2);
    expect(across[0]).toBe('3½"');
    expect(across[1]).toBe('3½"');
    // The along-legs differ, because the two angles differ.
    const along = [...brace.cutNote.matchAll(/x (\S+) along the length/g)].map((m) => m[1]);
    expect(along).toHaveLength(2);
    expect(along[0]).not.toBe(along[1]);
  });

  it("⚠ RECORDS A LIVE FINDING: this brace's modelled face IS off the stock width", () => {
    /* ⚠ **This is not a test of the note, it is a measurement of the panel, and
       it is currently a FLAG awaiting Tommy's decision.**

       The default chevron brace's modelled face measures 3.4628" across at its
       plumb end against 3.5" of real 2x4 — about 1/27", which trips
       JIG_MODEL_TOLERANCE_IN. So every braced panel's sheet currently carries
       the CHECK sentence.

       Asserted as PRESENT rather than absent because that is the truth, and a
       test written the comfortable way round would quietly license raising the
       threshold until the flag went away. Two honest resolutions exist and both
       are Tommy's, not mine: correct the brace geometry so the face really is
       parallel-sided, or accept the CHECK as standing advice on braced panels.
       Until he decides, the sheet says it out loud.

       If the geometry is fixed, this test fails — and that failure is the
       notification that it worked. */
    const brace = rows.find((r) => r.role === "brace")!;
    expect(brace.cutNote).toContain("CHECK:");
    expect(brace.cutNote).toContain("confirm the panel geometry");
  });

  it("the angle column and the note never disagree about the order of the ends", () => {
    // Both are built from the same sorted `endCutsFor`, so this is a guard
    // against someone later re-sorting one of them.
    for (const row of rows) {
      if (row.cutNote === "") continue;
      const firstAngleInLabel = row.angleLabel.split(" ")[0]!;
      expect(row.cutNote).toContain(firstAngleInLabel);
    }
  });
});
