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
    const members = buildBracedPanelMembers(40, 15.5, 120, false, "chevron");
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
    const members = buildBracedPanelMembers(40, 15.5, 120, true, "hatch-forward");
    const first = computePanelCutList(members).map((r) => `${r.letter}:${r.partLabel}`);
    const second = computePanelCutList(members).map((r) => `${r.letter}:${r.partLabel}`);
    expect(first).toEqual(second);
  });
});
