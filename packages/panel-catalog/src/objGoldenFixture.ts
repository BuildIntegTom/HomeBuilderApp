import { buildBoxBeamMembers } from "./boxBeamMembers";
import { buildBracedPanelMembers } from "./bracedPanelMembers";
import type { PanelMember } from "./componentSchema";
import { buildGablePanelMembers } from "./gablePanelMembers";
import type { WorldPlacedPanel } from "./panelObjExport";
import { buildStandardPanelMembers } from "./standardPanelMembers";

/**
 * ⚠ The standard panel AS IT WAS when the fixture was captured.
 *
 * The fixture is a frozen record of the EXPORTER's output and must never be
 * regenerated. But its input was never frozen: it calls the live builder, so
 * any member added to the standard panel later changes the input and breaks
 * the comparison without the exporter having moved at all.
 *
 * That happened on 2026-10-23, when 4ft wall panels gained a centre nailer
 * stud. The nailer is not a new member SHAPE — it is an ordinary vertical
 * box, already represented several times over in this fixture — so dropping
 * it loses no coverage, and keeping the input fixed is what lets the fixture
 * go on proving what it was written to prove.
 */
function goldenStandardPanelMembers(): PanelMember[] {
  return buildStandardPanelMembers(48, 14, 96, true).filter((m) => !m.memberId.startsWith("stud_centre_"));
}

/**
 * ⚠ The girt web AS IT WAS when the fixture was captured, for the same
 * reason.
 *
 * On 2026-10-23 the web stopped being a flat 8 3/4in and started being ripped
 * to the clear space between the studs it runs past, because at 8 3/4 it
 * measurably stood 1/8in inside every one of them. On this fixture's 14in-deep
 * panels that takes the web to 7in — a change to the PANEL, not to the
 * exporter, and the fixture exists to pin the exporter.
 *
 * A web is a plain flat box, a shape this fixture covers many times over, so
 * holding it at its captured size loses no coverage.
 */
const CAPTURED_GIRT_WEB_HEIGHT_IN = 8.75;

/**
 * ⚠ The gable panel's top assembly AS IT WAS when the fixture was captured,
 * for the third time and the same reason.
 *
 * On 2026-10-31 the top skin and the two top plates stopped dropping their
 * centrelines by a PERPENDICULAR half-thickness measured as if it were
 * VERTICAL. Read at a fixed x that left the skin's face plane 0.020in low
 * and the plate 0.081in inside it — which is what stopped a gable's top
 * plate finishing flush with the roof above it (Tommy: *"Let's get gable end
 * panels top plate edge to be flush with the top of the roof panels"*).
 *
 * Only `position.zIn` moved. The rip angle, the cut length and every other
 * member are untouched, and a tilted box is a shape this fixture covers many
 * times over — so holding these three at their captured heights loses no
 * coverage and keeps the fixture pinning the EXPORTER, which is what it is
 * for.
 */
function goldenGablePanelMembers(): PanelMember[] {
  const widthIn = 48;
  const leftIn = 12;
  const rightIn = 60;
  const cosRake = Math.cos(Math.atan2(rightIn - leftIn, widthIn));
  /* How far the old vertical-as-perpendicular reading sat BELOW the true
     one, for a given perpendicular offset. */
  const asCapturedDropIn = (perpendicularIn: number) => perpendicularIn / cosRake - perpendicularIn;
  return buildGablePanelMembers(widthIn, 14, leftIn, rightIn, false).map((m) => {
    const perpendicularIn =
      m.memberId === "top_plate_skin" ? 0.75 / 2 : m.memberId.startsWith("top_plate_2x4_") ? 0.75 + 1.5 / 2 : 0;
    if (perpendicularIn === 0) return m;
    return { ...m, position: { ...m.position, zIn: m.position.zIn + asCapturedDropIn(perpendicularIn) } };
  });
}

function asCaptured(members: PanelMember[]): PanelMember[] {
  return members.map((m) => {
    if (!/^girt_\d+_web$/.test(m.memberId)) return m;
    const nowIn = m.actualDimsIn.widthIn;
    return {
      ...m,
      actualDimsIn: { ...m.actualDimsIn, widthIn: CAPTURED_GIRT_WEB_HEIGHT_IN },
      position: { ...m.position, yIn: m.position.yIn + (nowIn - CAPTURED_GIRT_WEB_HEIGHT_IN) / 2 },
    };
  });
}
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
    ...asCaptured(goldenStandardPanelMembers()),
    ...asCaptured(buildBracedPanelMembers(48, 14, 96, true, "chevron", false, true)),
    ...asCaptured(buildBracedPanelMembers(48, 14, 96, false, "hatch", true, true)),
    ...asCaptured(goldenGablePanelMembers()),
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
      members: asCaptured(goldenStandardPanelMembers()),
    },
    {
      label: "panel_b",
      worldXIn: 120.5,
      worldZIn: -37.25,
      worldYIn: 96,
      rotationRad: Math.PI / 2,
      members: asCaptured(buildBracedPanelMembers(48, 14, 96, true, "chevron", true, true)),
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
