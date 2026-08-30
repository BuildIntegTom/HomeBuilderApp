import type { PanelMember } from "./componentSchema";
import { BOX_FACES, memberLocalCornersIn } from "./panelMemberHelpers";

const HEADER_LINES = [
  "# Reference-only export — not engineered, not for construction.",
  "# Units: inches. Axes: X=width, Y=height(up), Z=depth.",
  "",
];

/**
 * Converts a panel's members into a Wavefront OBJ mesh (one box per
 * member, grouped by `memberId`) — a plain static-geometry export anyone
 * can open in Blender/MeshLab/etc. to look at the plans, not a SketchUp
 * Dynamic Component export (see the `sketchup-export-pending-cameron`
 * memory: that's a separate, later effort blocked on a conversation with
 * Cameron about his existing DC library).
 *
 * Axis mapping mirrors `StandardPanel3DView.tsx` exactly, so the exported
 * file matches what's on screen: world X = panel X (width), world Y =
 * panel Z (height, up), world Z = panel Y (depth) — Y-up, inches, no
 * scaling.
 */
export function buildPanelObj(members: PanelMember[], displayName: string): string {
  const lines: string[] = [`# Building Integrity — ${displayName}`, ...HEADER_LINES];

  let vertexCount = 0;
  for (const member of members) {
    const corners = memberLocalCornersIn(member);
    lines.push(`g ${member.memberId}`);
    for (const [x, y, z] of corners) {
      lines.push(`v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`);
    }
    for (const face of BOX_FACES) {
      lines.push(`f ${face.map((i) => i + vertexCount).join(" ")}`);
    }
    vertexCount += 8;
    lines.push("");
  }

  return lines.join("\n");
}

/** One panel placed somewhere in the whole-building world space (Tommy:
 * export the 3D Preview's assembled building, not just one panel at a
 * time) — `worldXIn`/`worldZIn` is this panel's min-corner anchor (same
 * convention `panelSlotBoxes3D` in `@building-integrity/geometry` already
 * uses), `rotationRad` its wall's rotation. `members: null` (a panel type
 * with no real geometry yet — window/door/safety-gap) falls back to
 * `blobSizeIn`, a plain placeholder box matching the same dimensions the
 * 3D Preview renders for it. */
export interface WorldPlacedPanel {
  label: string;
  worldXIn: number;
  worldZIn: number;
  /** Vertical offset (e.g. a story stacked above the ground floor) —
   * undefined/0 means it sits directly on the ground plane. */
  worldYIn?: number;
  rotationRad: number;
  members: PanelMember[] | null;
  blobSizeIn?: { widthIn: number; heightIn: number; depthIn: number };
}

/**
 * Combines every panel of a whole building into one Wavefront OBJ file —
 * each panel's members (or placeholder blob) transformed from its own
 * view space (Y-up — what `memberLocalCornersIn` returns, NOT the member
 * space its `position` fields are authored in) into world space (rotate around Y by `-rotationRad`,
 * matching the 3D renderer's `rotation={[0, -rotationRad, 0]}` on that
 * panel's group, then translate by `worldXIn`/`worldZIn`) before being
 * written out, all sharing one global vertex count so face indices stay
 * correct across the whole file.
 */
export function buildBuildingObj(panels: WorldPlacedPanel[], displayName: string): string {
  const lines: string[] = [`# Building Integrity — ${displayName}`, ...HEADER_LINES];

  let vertexCount = 0;
  for (const panel of panels) {
    const cos = Math.cos(panel.rotationRad);
    const sin = Math.sin(panel.rotationRad);
    const toWorld = ([x, y, z]: [number, number, number]): [number, number, number] => [
      x * cos - z * sin + panel.worldXIn,
      y + (panel.worldYIn ?? 0),
      x * sin + z * cos + panel.worldZIn,
    ];

    if (panel.members) {
      for (const member of panel.members) {
        const localCorners = memberLocalCornersIn(member);
        lines.push(`g ${panel.label}_${member.memberId}`);
        for (const corner of localCorners) {
          const [wx, wy, wz] = toWorld(corner);
          lines.push(`v ${wx.toFixed(4)} ${wy.toFixed(4)} ${wz.toFixed(4)}`);
        }
        for (const face of BOX_FACES) {
          lines.push(`f ${face.map((i) => i + vertexCount).join(" ")}`);
        }
        vertexCount += 8;
        lines.push("");
      }
    } else if (panel.blobSizeIn) {
      const { widthIn, heightIn, depthIn } = panel.blobSizeIn;
      const localCorners: [number, number, number][] = [
        [0, 0, 0],
        [widthIn, 0, 0],
        [widthIn, heightIn, 0],
        [0, heightIn, 0],
        [0, 0, depthIn],
        [widthIn, 0, depthIn],
        [widthIn, heightIn, depthIn],
        [0, heightIn, depthIn],
      ];
      lines.push(`g ${panel.label}_placeholder`);
      for (const corner of localCorners) {
        const [wx, wy, wz] = toWorld(corner);
        lines.push(`v ${wx.toFixed(4)} ${wy.toFixed(4)} ${wz.toFixed(4)}`);
      }
      for (const face of BOX_FACES) {
        lines.push(`f ${face.map((i) => i + vertexCount).join(" ")}`);
      }
      vertexCount += 8;
      lines.push("");
    }
  }

  return lines.join("\n");
}
