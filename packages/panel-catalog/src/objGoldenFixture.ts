import { buildBoxBeamMembers } from "./boxBeamMembers";
import { buildBracedPanelMembers } from "./bracedPanelMembers";
import type { PanelMember } from "./componentSchema";
import { buildGablePanelMembers } from "./gablePanelMembers";
import type { WorldPlacedPanel } from "./panelObjExport";
import { buildStandardPanelMembers } from "./standardPanelMembers";
import { buildTrussPlateMembers } from "./trussPlateMembers";

/**
 * The member set behind `panelObjExport.test.ts`'s GOLDEN test — a broad,
 * deliberately representative slice of every member shape this app emits
 * today: plain boxes in all four orientations (including the rotationDeg
 * 90/180 variants `memberBoxSizeIn` special-cases), a center-anchored
 * tilted "diagonal", and real trapezoid-prism braces from both brace
 * patterns.
 *
 * It exists as its own module (not inline in the test) so the fixture
 * `objGolden.fixture.obj` could be generated from exactly the same input
 * the test replays. The fixture was captured BEFORE `memberFaceIndices`
 * and the `vertexCount += corners.length` fix landed, and must never be
 * regenerated — the whole point is that it is a frozen record of the
 * exporter's output for every member that existed before n-gon prisms.
 */
export function goldenMembers(): PanelMember[] {
  const handBuilt: PanelMember[] = [
    {
      memberId: "hand_flat",
      material: "plywood",
      speciesGrade: null,
      plySpec: "3/4in_5ply_CDX",
      nominalSize: null,
      actualDimsIn: { thicknessIn: 0.75, widthIn: 14, lengthIn: 48 },
      orientation: "flat",
      position: { xIn: 1.25, yIn: 2.5, zIn: 3.75, rotationDeg: 0 },
      role: "skin",
      qty: 1,
    },
    {
      memberId: "hand_vertical",
      material: "dimensional_lumber",
      speciesGrade: "No. 2 Pine",
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 92.25 },
      orientation: "vertical",
      position: { xIn: 10, yIn: 0, zIn: 0.75, rotationDeg: 0 },
      role: "stud",
      qty: 1,
    },
    {
      memberId: "hand_horizontal",
      material: "dimensional_lumber",
      speciesGrade: "No. 2 Pine",
      plySpec: null,
      nominalSize: "2x6",
      actualDimsIn: { thicknessIn: 1.5, widthIn: 5.5, lengthIn: 48 },
      orientation: "horizontal",
      position: { xIn: 0, yIn: 1, zIn: 20, rotationDeg: 0 },
      role: "plate",
      qty: 1,
    },
    {
      memberId: "hand_horizontal_rot90",
      material: "dimensional_lumber",
      speciesGrade: "No. 2 Pine",
      plySpec: null,
      nominalSize: "2x6",
      actualDimsIn: { thicknessIn: 1.5, widthIn: 5.5, lengthIn: 30 },
      orientation: "horizontal",
      position: { xIn: 4, yIn: 5, zIn: 6, rotationDeg: 90 },
      role: "blocking",
      qty: 1,
    },
    {
      memberId: "hand_horizontal_rot180",
      material: "dimensional_lumber",
      speciesGrade: "No. 2 Pine",
      plySpec: null,
      nominalSize: "2x6",
      actualDimsIn: { thicknessIn: 1.5, widthIn: 5.5, lengthIn: 30 },
      orientation: "horizontal",
      position: { xIn: 7, yIn: 8, zIn: 9, rotationDeg: 180 },
      role: "blocking",
      qty: 1,
    },
    {
      memberId: "hand_diagonal_tilted",
      material: "dimensional_lumber",
      speciesGrade: "No. 2 Pine",
      plySpec: null,
      nominalSize: "2x4",
      actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 60 },
      orientation: "diagonal",
      position: { xIn: 24, yIn: 7, zIn: 48, rotationDeg: 0, tiltDeg: 37.5 },
      role: "brace",
      qty: 1,
    },
    {
      memberId: "hand_mesh_opacity",
      material: "wire_mesh",
      speciesGrade: null,
      plySpec: null,
      nominalSize: null,
      actualDimsIn: { thicknessIn: 0.125, widthIn: 240, lengthIn: 480 },
      orientation: "flat",
      position: { xIn: 0, yIn: 0, zIn: 0, rotationDeg: 0 },
      role: "skin",
      qty: 1,
      opacityOverride: 0.75,
    },
  ];

  return [
    ...buildStandardPanelMembers(48, 14, 96, true),
    ...buildBracedPanelMembers(48, 14, 96, true, "chevron", false),
    ...buildBracedPanelMembers(48, 14, 96, false, "hatch", true),
    ...buildGablePanelMembers(48, 14, 12, 60, false),
    ...buildTrussPlateMembers(96, 14),
    ...buildBoxBeamMembers(96, 14),
    ...handBuilt,
  ];
}

/** The whole-building counterpart of `goldenMembers` — rotated placements
 * plus the `members: null` placeholder-blob branch, so all three of
 * `panelObjExport.ts`'s vertex-count sites are exercised by the golden. */
export function goldenPanels(): WorldPlacedPanel[] {
  return [
    {
      label: "panel_a",
      worldXIn: 0,
      worldZIn: 0,
      rotationRad: 0,
      members: buildStandardPanelMembers(48, 14, 96, true),
    },
    {
      label: "panel_b",
      worldXIn: 120.5,
      worldZIn: -37.25,
      worldYIn: 96,
      rotationRad: Math.PI / 2,
      members: buildBracedPanelMembers(48, 14, 96, true, "chevron", true),
    },
    {
      label: "panel_c_blob",
      worldXIn: 240,
      worldZIn: 15,
      rotationRad: Math.PI / 4,
      members: null,
      blobSizeIn: { widthIn: 36, heightIn: 96, depthIn: 14 },
    },
    {
      label: "panel_d",
      worldXIn: 300,
      worldZIn: 60,
      rotationRad: -Math.PI / 3,
      members: buildTrussPlateMembers(96, 14),
    },
  ];
}
