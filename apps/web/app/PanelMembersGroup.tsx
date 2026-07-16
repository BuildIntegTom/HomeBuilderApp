"use client";

import * as THREE from "three";
import { BOX_FACES, memberBoxSizeIn, memberLocalCornersIn, type PanelMember } from "@building-integrity/panel-catalog";

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

/**
 * A true beveled-end trapezoid prism (Tommy: "trapezoid cuts" — a diagonal
 * brace's real plumb+level end cuts, not a plain tilted box) — the first
 * non-box member geometry in this app. `memberLocalCornersIn` (shared with
 * the OBJ exporter, so the downloadable file and the on-screen view can
 * never disagree) already returns the 8 corners in this component's own
 * local-space convention (X=width, Y=height up, Z=depth) — this just
 * converts to feet and wires them into a `BufferGeometry` using the same
 * `BOX_FACES` topology (each quad face split into 2 triangles). `DoubleSide`
 * is used defensively — `BOX_FACES`' winding was only ever validated
 * against the OBJ format's own face convention, not against three.js'
 * CCW-front-face convention specifically, so this guards against an
 * invisible (backface-culled) mesh if that winding turns out reversed. */
function buildTrapezoidGeometry(member: PanelMember): THREE.BufferGeometry {
  const corners = memberLocalCornersIn(member);
  const positions = new Float32Array(corners.length * 3);
  corners.forEach(([x, y, z], i) => {
    positions[i * 3] = x / IN_PER_FT;
    positions[i * 3 + 1] = y / IN_PER_FT;
    positions[i * 3 + 2] = z / IN_PER_FT;
  });
  const indices: number[] = [];
  for (const [a, b, c, d] of BOX_FACES) {
    indices.push(a - 1, b - 1, c - 1, a - 1, c - 1, d - 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

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
        if (member.position.trapezoidCornersIn) {
          return (
            <mesh key={member.memberId} geometry={buildTrapezoidGeometry(member)}>
              <meshStandardMaterial
                color={colorOverride ?? MATERIAL_COLOR[member.material]}
                transparent={MATERIAL_OPACITY[member.material] !== undefined}
                opacity={MATERIAL_OPACITY[member.material] ?? 1}
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        }
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
