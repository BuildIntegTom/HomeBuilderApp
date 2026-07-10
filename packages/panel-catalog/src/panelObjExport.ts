import type { PanelMember } from "./componentSchema";
import { memberBoxSizeIn } from "./panelMemberHelpers";

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
 * scaling. "diagonal" members store their center directly and get rotated
 * around world Z by `tiltDeg` (matching the renderer's `rotation.z`);
 * every other orientation stores its min-corner, so the box center is
 * offset by half its size.
 */
export function buildPanelObj(members: PanelMember[], displayName: string): string {
  const lines: string[] = [
    `# Building Integrity — ${displayName}`,
    "# Reference-only export — not engineered, not for construction.",
    "# Units: inches. Axes: X=width, Y=height(up), Z=depth.",
    "",
  ];

  let vertexCount = 0;
  for (const member of members) {
    const sizeIn = memberBoxSizeIn(member);
    const hx = sizeIn.xIn / 2;
    const hy = sizeIn.zIn / 2;
    const hz = sizeIn.yIn / 2;
    const { tiltDeg } = member.position;
    const isTilted = tiltDeg !== undefined;

    const centerX = isTilted ? member.position.xIn : member.position.xIn + hx;
    const centerY = isTilted ? member.position.zIn : member.position.zIn + hy;
    const centerZ = isTilted ? member.position.yIn : member.position.yIn + hz;
    const tiltRad = isTilted ? (tiltDeg * Math.PI) / 180 : 0;
    const cos = Math.cos(tiltRad);
    const sin = Math.sin(tiltRad);

    const localCorners: [number, number, number][] = [
      [-hx, -hy, -hz],
      [hx, -hy, -hz],
      [hx, hy, -hz],
      [-hx, hy, -hz],
      [-hx, -hy, hz],
      [hx, -hy, hz],
      [hx, hy, hz],
      [-hx, hy, hz],
    ];

    lines.push(`g ${member.memberId}`);
    for (const [x, y, z] of localCorners) {
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      lines.push(`v ${(centerX + rx).toFixed(4)} ${(centerY + ry).toFixed(4)} ${(centerZ + z).toFixed(4)}`);
    }

    const faces: [number, number, number, number][] = [
      [1, 2, 6, 5], // -Y face
      [2, 3, 7, 6], // +X face
      [3, 4, 8, 7], // +Y face
      [1, 4, 8, 5], // -X face
      [4, 3, 2, 1], // -Z face
      [5, 6, 7, 8], // +Z face
    ];
    for (const face of faces) {
      lines.push(`f ${face.map((i) => i + vertexCount).join(" ")}`);
    }
    vertexCount += 8;
    lines.push("");
  }

  return lines.join("\n");
}
