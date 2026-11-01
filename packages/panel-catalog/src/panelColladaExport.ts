import { memberFaceIndices, memberLocalCornersIn } from "./panelMemberHelpers";
import type { WorldPlacedPanel } from "./panelObjExport";

/**
 * ⚠ **COLLADA (.dae), for getting the building into SketchUp as real
 * groups rather than one undifferentiated mesh.**
 *
 * > *"The goal with exporter options is to be able to export the object
 * > (ideally as parametric groups of objects) into SketchUp."* — Tommy,
 * > 2026-11-01
 *
 * **Why this format and not the OBJ we already had.** An OBJ's `g` lines are
 * face tags, not containers: SketchUp imports the whole file as one lump and
 * the panels cannot be selected, moved or counted separately. COLLADA carries
 * a real scene GRAPH — a node per panel, a node per member inside it, each
 * with its own name — so the building lands in the Outliner as a tree a
 * person can open. That is the whole reason to add it.
 *
 * **What it cannot do, said plainly so nobody expects otherwise:**
 *
 * - **It is not parametric.** COLLADA has no notion of a SketchUp Dynamic
 *   Component's attributes or formulas. This gives named, individually
 *   selectable groups; a panel whose width can be typed in SketchUp is the
 *   Dynamic Component path, which is a Ruby script run inside SketchUp
 *   against Cameron's existing DC library — see the
 *   `sketchup-export-pending-cameron` memory. This file does not replace
 *   that work and is not a step toward it.
 * - **⚠ SketchUp's FREE web tier will not open it.** Measured 2026-11-01
 *   against SketchUp's own documentation: the free tier of SketchUp for Web
 *   imports `.skp`, `.jpg` and `.png` only, and `.dae` (with `.stl`, `.dwg`
 *   and the rest) is subscriber-only. Desktop SketchUp imports COLLADA
 *   normally, and free *desktop* SketchUp has not existed since SketchUp
 *   Make was retired. So this reaches any paid SketchUp and does not reach
 *   the free web app, whatever the format's generality suggests.
 *
 * Geometry is emitted in each member's own LOCAL space and the panel's world
 * placement rides on its node's `<matrix>`, rather than baking world
 * coordinates into every vertex the way the OBJ exporter does. That is what
 * makes a panel a movable group in SketchUp instead of a cloud of triangles
 * that happens to sit in the right place.
 */

/** Inches to metres, so SketchUp imports the building at true size rather
 * than at 1 unit = 1 metre. The asset's `<unit>` is the only place the file
 * says what its numbers mean. */
const METRES_PER_INCH = 0.0254;

/** XML text content — the five predefined entities, nothing more exotic,
 * since every name here comes from the app's own ids and labels. */
function xmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * An XML `ID`, which is stricter than XML text: it may not start with a
 * digit and may not contain a space. Panel labels like `N3` are already
 * fine; a bale-foundation ring's `balefoundation_ring a` is not, and an id
 * collision would make SketchUp instance the wrong geometry — so every id is
 * built from a counter rather than from the name, and the NAME (which has no
 * such rules) carries the readable text.
 */
function xmlId(prefix: string, index: number): string {
  return `${prefix}${index}`;
}

/**
 * The 4x4 row-major transform COLLADA wants for a panel node — the same
 * rotate-about-Y-then-translate the OBJ exporter applies vertex by vertex:
 *
 *   x' = x·cos − z·sin + X      y' = y + Y      z' = x·sin + z·cos + Z
 *
 * ⚠ The TRANSLATION is converted to metres and the rotation is not, because
 * a rotation has no units. Scaling both would tilt nothing and move
 * everything to a fortieth of its right place.
 */
function panelMatrix(panel: WorldPlacedPanel): string {
  const cos = Math.cos(panel.rotationRad);
  const sin = Math.sin(panel.rotationRad);
  const tx = panel.worldXIn * METRES_PER_INCH;
  const ty = (panel.worldYIn ?? 0) * METRES_PER_INCH;
  const tz = panel.worldZIn * METRES_PER_INCH;
  const m = [cos, 0, -sin, tx, 0, 1, 0, ty, sin, 0, cos, tz, 0, 0, 0, 1];
  return m.map((v) => v.toFixed(6)).join(" ");
}

interface MeshOut {
  geometryId: string;
  xml: string;
}

/** One member (or one placeholder box) as a COLLADA `<geometry>`, in its own
 * local space and in metres. */
function meshGeometry(
  geometryId: string,
  name: string,
  cornersIn: readonly (readonly [number, number, number])[],
  faces: readonly (readonly number[])[],
): MeshOut | null {
  if (cornersIn.length === 0 || faces.length === 0) return null;

  const positions = cornersIn.flatMap(([x, y, z]) =>
    [x, y, z].map((v) => (v * METRES_PER_INCH).toFixed(6)),
  );
  /* ⚠ `memberFaceIndices` is 1-BASED, because it was written for OBJ, whose
     `f` lines are 1-based. COLLADA's `<p>` is 0-based. Off by one here is
     not a crash — it is a mesh whose every face points at its neighbour's
     corner, which opens and looks like a shredded panel. */
  const vcount = faces.map((f) => f.length);
  const p = faces.flatMap((f) => f.map((i) => i - 1));

  return {
    geometryId,
    xml: [
      `    <geometry id="${geometryId}" name="${xmlText(name)}">`,
      "      <mesh>",
      `        <source id="${geometryId}-pos">`,
      `          <float_array id="${geometryId}-pos-array" count="${positions.length}">${positions.join(" ")}</float_array>`,
      "          <technique_common>",
      `            <accessor source="#${geometryId}-pos-array" count="${cornersIn.length}" stride="3">`,
      '              <param name="X" type="float"/>',
      '              <param name="Y" type="float"/>',
      '              <param name="Z" type="float"/>',
      "            </accessor>",
      "          </technique_common>",
      "        </source>",
      `        <vertices id="${geometryId}-vtx">`,
      `          <input semantic="POSITION" source="#${geometryId}-pos"/>`,
      "        </vertices>",
      `        <polylist count="${faces.length}">`,
      `          <input semantic="VERTEX" source="#${geometryId}-vtx" offset="0"/>`,
      `          <vcount>${vcount.join(" ")}</vcount>`,
      `          <p>${p.join(" ")}</p>`,
      "        </polylist>",
      "      </mesh>",
      "    </geometry>",
    ].join("\n"),
  };
}

/** The placeholder box a panel type with no real geometry gets — same
 * dimensions the 3D view draws for it, same fallback the OBJ exporter makes.
 * Its corner order and face table match `BOX_FACES`' 1-based convention so
 * both exporters describe the same box. */
function blobCornersIn(widthIn: number, heightIn: number, depthIn: number): [number, number, number][] {
  return [
    [0, 0, 0],
    [widthIn, 0, 0],
    [widthIn, heightIn, 0],
    [0, heightIn, 0],
    [0, 0, depthIn],
    [widthIn, 0, depthIn],
    [widthIn, heightIn, depthIn],
    [0, heightIn, depthIn],
  ];
}

/**
 * The whole building as one COLLADA 1.4.1 document: a node per panel, named
 * and placed, each holding a node per member.
 *
 * Takes the very same `WorldPlacedPanel[]` the OBJ exporter does, so the two
 * downloads can never describe different buildings — the only difference
 * between them is the shape of the file.
 */
export function buildBuildingCollada(panels: WorldPlacedPanel[], displayName: string, nowIso: string): string {
  const geometries: string[] = [];
  const nodes: string[] = [];
  let geometryIndex = 0;

  for (const [panelIndex, panel] of panels.entries()) {
    const children: string[] = [];

    if (panel.members) {
      for (const member of panel.members) {
        const mesh = meshGeometry(
          xmlId("geom", geometryIndex),
          `${panel.label}_${member.memberId}`,
          memberLocalCornersIn(member),
          memberFaceIndices(member),
        );
        if (!mesh) continue;
        geometries.push(mesh.xml);
        children.push(
          [
            `        <node id="${xmlId("node", geometryIndex)}" name="${xmlText(member.memberId)}" type="NODE">`,
            `          <instance_geometry url="#${mesh.geometryId}"/>`,
            "        </node>",
          ].join("\n"),
        );
        geometryIndex++;
      }
    } else if (panel.blobSizeIn) {
      const { widthIn, heightIn, depthIn } = panel.blobSizeIn;
      const mesh = meshGeometry(
        xmlId("geom", geometryIndex),
        `${panel.label}_placeholder`,
        blobCornersIn(widthIn, heightIn, depthIn),
        [
          [1, 2, 6, 5],
          [2, 3, 7, 6],
          [3, 4, 8, 7],
          [1, 4, 8, 5],
          [4, 3, 2, 1],
          [5, 6, 7, 8],
        ],
      );
      if (mesh) {
        geometries.push(mesh.xml);
        children.push(
          [
            `        <node id="${xmlId("node", geometryIndex)}" name="placeholder" type="NODE">`,
            `          <instance_geometry url="#${mesh.geometryId}"/>`,
            "        </node>",
          ].join("\n"),
        );
        geometryIndex++;
      }
    }

    /* A panel that contributed nothing gets no node at all, rather than an
       empty group for somebody to find in the Outliner and wonder about. */
    if (children.length === 0) continue;
    nodes.push(
      [
        `      <node id="${xmlId("panel", panelIndex)}" name="${xmlText(panel.label)}" type="NODE">`,
        `        <matrix sid="transform">${panelMatrix(panel)}</matrix>`,
        ...children,
        "      </node>",
      ].join("\n"),
    );
  }

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">',
    "  <asset>",
    "    <contributor>",
    "      <authoring_tool>Building Integrity — reference-only export, not engineered, not for construction.</authoring_tool>",
    `      <comments>${xmlText(displayName)}</comments>`,
    "    </contributor>",
    `    <created>${xmlText(nowIso)}</created>`,
    `    <modified>${xmlText(nowIso)}</modified>`,
    `    <unit meter="${METRES_PER_INCH}" name="inch"/>`,
    "    <up_axis>Y_UP</up_axis>",
    "  </asset>",
    "  <library_geometries>",
    ...geometries,
    "  </library_geometries>",
    "  <library_visual_scenes>",
    '    <visual_scene id="scene" name="Building">',
    ...nodes,
    "    </visual_scene>",
    "  </library_visual_scenes>",
    "  <scene>",
    '    <instance_visual_scene url="#scene"/>',
    "  </scene>",
    "</COLLADA>",
    "",
  ].join("\n");
}
