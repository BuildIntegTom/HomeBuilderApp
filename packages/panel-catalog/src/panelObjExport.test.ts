import { describe, expect, it } from "vitest";
import { buildBuildingObj, buildPanelObj, type WorldPlacedPanel } from "./panelObjExport";
import type { PanelMember } from "./componentSchema";

function makeMember(overrides: Partial<PanelMember>): PanelMember {
  return {
    memberId: "test_member",
    material: "dimensional_lumber",
    speciesGrade: null,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 10 },
    orientation: "flat",
    position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
    role: "stud",
    qty: 1,
    ...overrides,
  };
}

function parseObj(obj: string) {
  const vertices = obj
    .split("\n")
    .filter((l) => l.startsWith("v "))
    .map((l) => l.slice(2).trim().split(/\s+/).map(Number));
  const faces = obj
    .split("\n")
    .filter((l) => l.startsWith("f "))
    .map((l) => l.slice(2).trim().split(/\s+/).map(Number));
  const groups = obj
    .split("\n")
    .filter((l) => l.startsWith("g "))
    .map((l) => l.slice(2).trim());
  return { vertices, faces, groups };
}

describe("buildPanelObj", () => {
  it("emits 8 vertices and 6 quad faces per member", () => {
    const members = [makeMember({ memberId: "a" }), makeMember({ memberId: "b" })];
    const obj = buildPanelObj(members, "Test Panel");
    const { vertices, faces, groups } = parseObj(obj);
    expect(groups).toEqual(["a", "b"]);
    expect(vertices).toHaveLength(16);
    expect(faces).toHaveLength(12);
  });

  it("indexes faces globally (1-based, offset by prior members' vertex counts)", () => {
    const members = [makeMember({ memberId: "a" }), makeMember({ memberId: "b" })];
    const { faces } = parseObj(buildPanelObj(members, "Test Panel"));
    // first member's faces reference vertices 1-8
    for (const f of faces.slice(0, 6)) expect(Math.max(...f)).toBeLessThanOrEqual(8);
    // second member's faces reference vertices 9-16
    for (const f of faces.slice(6, 12)) {
      expect(Math.min(...f)).toBeGreaterThanOrEqual(9);
      expect(Math.max(...f)).toBeLessThanOrEqual(16);
    }
  });

  it("centers a flat, unrotated box's vertices on its min-corner + half box size, remapped to Y-up world axes", () => {
    // flat: actualDimsIn (t=1.5,w=3.5,l=10) -> boxSize X=length=10, Y(depth)=width=3.5, Z(height)=thickness=1.5
    // world mapping: worldX=panelX, worldY=panelZ(height), worldZ=panelY(depth)
    const member = makeMember({
      actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 10 },
      orientation: "flat",
      position: { xIn: 2, yIn: 1, zIn: 0.75, rotationDeg: 0 },
    });
    const { vertices } = parseObj(buildPanelObj([member], "Test"));
    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    const zs = vertices.map((v) => v[2]);
    // worldX center = xIn + lengthIn/2 = 2 + 5 = 7, half-extent 5 -> [2, 12]
    expect(Math.min(...xs)).toBeCloseTo(2, 6);
    expect(Math.max(...xs)).toBeCloseTo(12, 6);
    // worldY center = zIn + thicknessIn/2 = 0.75 + 0.75 = 1.5, half-extent 0.75 -> [0.75, 2.25]
    expect(Math.min(...ys)).toBeCloseTo(0.75, 6);
    expect(Math.max(...ys)).toBeCloseTo(2.25, 6);
    // worldZ center = yIn + widthIn/2 = 1 + 1.75 = 2.75, half-extent 1.75 -> [1, 4.5]
    expect(Math.min(...zs)).toBeCloseTo(1, 6);
    expect(Math.max(...zs)).toBeCloseTo(4.5, 6);
  });

  it("treats a tilted (diagonal) member's position as its center, unrotated (tiltDeg=0) reproducing the plain box bounds", () => {
    const member = makeMember({
      actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 10 },
      orientation: "diagonal",
      position: { xIn: 5, yIn: 2, zIn: 3, rotationDeg: 0, tiltDeg: 0 },
    });
    // diagonal box size: X=thickness=1.5, Y(depth)=width=3.5, Z(height)=length=10
    const { vertices } = parseObj(buildPanelObj([member], "Test"));
    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    const zs = vertices.map((v) => v[2]);
    expect(Math.min(...xs)).toBeCloseTo(5 - 0.75, 6);
    expect(Math.max(...xs)).toBeCloseTo(5 + 0.75, 6);
    expect(Math.min(...ys)).toBeCloseTo(3 - 5, 6); // worldY = panelZ = 3, half-extent = length/2 = 5
    expect(Math.max(...ys)).toBeCloseTo(3 + 5, 6);
    expect(Math.min(...zs)).toBeCloseTo(2 - 1.75, 6); // worldZ = panelY = 2, half-extent = width/2 = 1.75
    expect(Math.max(...zs)).toBeCloseTo(2 + 1.75, 6);
  });

  it("rotates a tilted member's X/Y extent by tiltDeg around world Z, leaving world Z unchanged", () => {
    // A 90deg tilt should swap the X and Y half-extents (since rotation.z by
    // 90deg maps the local X axis onto world Y and vice versa).
    const member = makeMember({
      actualDimsIn: { thicknessIn: 2, widthIn: 4, lengthIn: 10 },
      orientation: "diagonal",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0, tiltDeg: 90 },
    });
    const { vertices } = parseObj(buildPanelObj([member], "Test"));
    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    // untilted half-extents: hx=thickness/2=1, hy=length/2=5 -> tilted 90deg swaps them
    expect(Math.max(...xs)).toBeCloseTo(5, 6);
    expect(Math.max(...ys)).toBeCloseTo(1, 6);
  });

  it("includes a reference-only disclaimer header comment with the given display name", () => {
    const obj = buildPanelObj([makeMember({})], "Standard Panel");
    expect(obj).toContain("# Building Integrity — Standard Panel");
    expect(obj).toMatch(/reference-only/i);
  });
});

describe("buildBuildingObj", () => {
  it("translates an unrotated panel's members by its world anchor, with no other change", () => {
    const member = makeMember({
      actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 10 },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
    });
    const panels: WorldPlacedPanel[] = [
      { label: "wall1_panel0", worldXIn: 100, worldZIn: 50, rotationRad: 0, members: [member] },
    ];
    const { vertices } = parseObj(buildBuildingObj(panels, "Building"));
    const xs = vertices.map((v) => v[0]);
    const zs = vertices.map((v) => v[2]);
    // Local flat box: worldX in [0,10], worldZ in [0,3.5] before translation.
    expect(Math.min(...xs)).toBeCloseTo(100, 6);
    expect(Math.max(...xs)).toBeCloseTo(110, 6);
    expect(Math.min(...zs)).toBeCloseTo(50, 6);
    expect(Math.max(...zs)).toBeCloseTo(53.5, 6);
  });

  it("rotates a panel's members 90deg around world Y before translating, matching the renderer's -rotationRad convention", () => {
    const member = makeMember({
      actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 10 },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
    });
    // Local box spans X=[0,10], Z=[0,3.5]. Rotated by rotationRad=PI/2:
    // worldX = x*cos - z*sin = -z (in [-3.5, 0]); worldZ = x*sin + z*cos = x (in [0, 10]).
    const panels: WorldPlacedPanel[] = [
      { label: "wall2_panel0", worldXIn: 0, worldZIn: 0, rotationRad: Math.PI / 2, members: [member] },
    ];
    const { vertices } = parseObj(buildBuildingObj(panels, "Building"));
    const xs = vertices.map((v) => v[0]);
    const zs = vertices.map((v) => v[2]);
    expect(Math.min(...xs)).toBeCloseTo(-3.5, 6);
    expect(Math.max(...xs)).toBeCloseTo(0, 6);
    expect(Math.min(...zs)).toBeCloseTo(0, 6);
    expect(Math.max(...zs)).toBeCloseTo(10, 6);
  });

  it("renders a placeholder blob box (min-corner at the world anchor) for a panel with no member geometry", () => {
    const panels: WorldPlacedPanel[] = [
      {
        label: "wall1_panel1",
        worldXIn: 10,
        worldZIn: 20,
        rotationRad: 0,
        members: null,
        blobSizeIn: { widthIn: 40, heightIn: 120, depthIn: 15.5 },
      },
    ];
    const { vertices, groups } = parseObj(buildBuildingObj(panels, "Building"));
    expect(groups).toEqual(["wall1_panel1_placeholder"]);
    const xs = vertices.map((v) => v[0]);
    const ys = vertices.map((v) => v[1]);
    const zs = vertices.map((v) => v[2]);
    expect(Math.min(...xs)).toBeCloseTo(10, 6);
    expect(Math.max(...xs)).toBeCloseTo(50, 6);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
    expect(Math.max(...ys)).toBeCloseTo(120, 6);
    expect(Math.min(...zs)).toBeCloseTo(20, 6);
    expect(Math.max(...zs)).toBeCloseTo(35.5, 6);
  });

  it("keeps one global vertex/face index count across multiple panels, real and placeholder alike", () => {
    const member = makeMember({});
    const panels: WorldPlacedPanel[] = [
      { label: "p0", worldXIn: 0, worldZIn: 0, rotationRad: 0, members: [member] },
      { label: "p1", worldXIn: 40, worldZIn: 0, rotationRad: 0, members: null, blobSizeIn: { widthIn: 40, heightIn: 120, depthIn: 15.5 } },
      { label: "p2", worldXIn: 80, worldZIn: 0, rotationRad: 0, members: [member, member] },
    ];
    const { vertices, faces, groups } = parseObj(buildBuildingObj(panels, "Building"));
    expect(groups).toEqual(["p0_test_member", "p1_placeholder", "p2_test_member", "p2_test_member"]);
    expect(vertices).toHaveLength(32); // 4 boxes x 8 vertices
    expect(faces).toHaveLength(24); // 4 boxes x 6 faces
    // Last box's faces should reference the last 8 vertices (25-32).
    const lastBoxFaces = faces.slice(-6);
    for (const f of lastBoxFaces) {
      expect(Math.min(...f)).toBeGreaterThanOrEqual(25);
      expect(Math.max(...f)).toBeLessThanOrEqual(32);
    }
  });

  it("includes a reference-only disclaimer header comment with the given display name", () => {
    const obj = buildBuildingObj([], "Whole Building");
    expect(obj).toContain("# Building Integrity — Whole Building");
    expect(obj).toMatch(/reference-only/i);
  });
});
