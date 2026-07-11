"use client";

import { memberBoxSizeIn, type PanelMember } from "@building-integrity/panel-catalog";

const IN_PER_FT = 12;

// wood_fiber_board (e.g. the square-bale panel's timber fiber board void
// fill — Tommy: "highlighted with the same opacity in a light brown color
// just like straw was") reuses the exact straw-fill overlay's own color/
// opacity from StandardPanel3DView.tsx's STRAW_COLOR/straw opacity.
const MATERIAL_COLOR: Record<PanelMember["material"], string> = {
  dimensional_lumber: "#8a6a3a",
  plywood: "#d9c9a3",
  osb: "#c9b483",
  wood_fiber_board: "#e0c458",
  wire_mesh: "#b8b8b8",
  fastener: "#777777",
};

const MATERIAL_OPACITY: Partial<Record<PanelMember["material"], number>> = {
  wood_fiber_board: 0.55,
};

export interface PanelMembersGroupProps {
  members: PanelMember[];
  /** Overrides every member's material color with one flat color — used
   * for the safety-gap panel's plywood sheet (Tommy: "it appears in the 3d
   * drawing that there are spaces here" — a 3/4in plywood sheet the same
   * tan as every other plywood member is easy to mistake for empty space
   * at typical zoom; this makes it read as the same distinct orange as its
   * 2D panel-type color instead). */
  colorOverride?: string;
}

/** Renders one box mesh per member, in the panel's own local space — X=width
 * from its own min-corner, Y=height up from 0, Z=depth from its exterior
 * face at 0. Shared by StandardPanel3DView.tsx (a panel viewed alone, at the
 * scene origin) and Building3DView.tsx (many panels placed around a whole
 * footprint, each wrapped in its own positioned/rotated `<group>` — since
 * this renders purely in local space, it composes correctly either way
 * without knowing which context it's in). */
export default function PanelMembersGroup({ members, colorOverride }: PanelMembersGroupProps) {
  return (
    <>
      {members.map((member) => {
        const sizeIn = memberBoxSizeIn(member);
        const sizeFt: [number, number, number] = [sizeIn.xIn / IN_PER_FT, sizeIn.zIn / IN_PER_FT, sizeIn.yIn / IN_PER_FT];
        const { tiltDeg } = member.position;
        const isTilted = tiltDeg !== undefined;
        // "diagonal" members store their CENTER directly (a tilted box has
        // no natural min-corner) — everything else stores its min-corner,
        // so the box center is offset by half its size. tiltDeg rotates
        // around the panel's own Y (depth) axis, which maps to world Z
        // here (worldX=panelX, worldY=panelZ, worldZ=panelY) — three.js
        // rotation.z tilts within the worldX/worldY (panel width/height)
        // plane. Checked via presence, not truthiness — tiltDeg can
        // legitimately be 0.
        const centerPos: [number, number, number] = isTilted
          ? [member.position.xIn / IN_PER_FT, member.position.zIn / IN_PER_FT, member.position.yIn / IN_PER_FT]
          : [
              (member.position.xIn + sizeIn.xIn / 2) / IN_PER_FT,
              (member.position.zIn + sizeIn.zIn / 2) / IN_PER_FT,
              (member.position.yIn + sizeIn.yIn / 2) / IN_PER_FT,
            ];
        const rotation: [number, number, number] = isTilted ? [0, 0, ((tiltDeg as number) * Math.PI) / 180] : [0, 0, 0];
        return (
          <mesh key={member.memberId} position={centerPos} rotation={rotation}>
            <boxGeometry args={sizeFt} />
            <meshStandardMaterial
              color={colorOverride ?? MATERIAL_COLOR[member.material]}
              transparent={MATERIAL_OPACITY[member.material] !== undefined}
              opacity={MATERIAL_OPACITY[member.material] ?? 1}
            />
          </mesh>
        );
      })}
    </>
  );
}
