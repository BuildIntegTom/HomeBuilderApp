"use client";

import { createContext, useContext, useMemo } from "react";
import * as THREE from "three";
import { memberBoxSizeIn, memberFaceIndices, memberLocalCornersIn, strawFillBoxIn, type PanelMember } from "@building-integrity/panel-catalog";

const IN_PER_FT = 12;

/** The straw-fill overlay's own colour, as the single-panel preview has drawn
 * it since early on. */
export const STRAW_COLOR = "#e0c458";
export const STRAW_OPACITY = 0.55;

/**
 * **THE STRAW, EVERYWHERE THERE IS A PANEL — his ask, 2026-11-04.**
 *
 * > *"I mean ideally we could also model out the straw too - let's add 3D straw
 * > volume infill with texture toggle option."*
 *
 * A context rather than a prop because `PanelMembersGroup` is rendered from
 * eleven places in `Building3DView` alone (every wall slot, every gable tile,
 * every deck panel, the opening assemblies), and a prop would have to be
 * threaded through all of them to say one thing. A provider around the scene
 * says it once; a caller that never provides one renders exactly as before.
 *
 * `textured` swaps the flat fill for a procedural straw texture — generated
 * on a canvas rather than loaded from a file, so it costs the app no asset and
 * cannot 404.
 */
export interface StrawFillSettings {
  show: boolean;
  textured: boolean;
}

const StrawFillContext = createContext<StrawFillSettings>({ show: false, textured: false });

export const StrawFillProvider = StrawFillContext.Provider;

/** One canvas texture for the whole app, built on first use. Straw drawn as
 * many short strands at shallow random angles over a warm base — at the
 * distance a whole building is viewed from, strand DIRECTION is what reads as
 * straw, not strand detail. Seeded by hand (a tiny LCG) so the pattern is the
 * same every run and a screenshot of the same model is the same image. */
let strawTextureBase: THREE.CanvasTexture | null = null;
/** One texture per repeat count, not per panel: a 4ft panel and a 12ft floor
 * panel need different repeats to show strands the same SIZE, but there are
 * only a handful of distinct counts in any building. */
const strawTextureByRepeat = new Map<string, THREE.CanvasTexture>();

function buildStrawTextureBase(): THREE.CanvasTexture | null {
  if (strawTextureBase) return strawTextureBase;
  if (typeof document === "undefined") return null;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = STRAW_COLOR;
  ctx.fillRect(0, 0, size, size);
  let seed = 20261104;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 900; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const lengthPx = 10 + rand() * 26;
    const angle = (rand() - 0.5) * 0.9;
    /* Half the strands lighter than the base and half darker, so the texture
       reads at 55% opacity over a dark frame as well as against the sky. */
    const lighter = rand() < 0.5;
    const shade = lighter ? Math.floor(225 + rand() * 30) : Math.floor(120 + rand() * 60);
    ctx.strokeStyle = `rgba(${shade}, ${Math.floor(shade * 0.86)}, ${Math.floor(shade * 0.45)}, 0.9)`;
    ctx.lineWidth = 1 + rand();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * lengthPx, y + Math.sin(angle) * lengthPx);
    ctx.stroke();
  }
  strawTextureBase = new THREE.CanvasTexture(canvas);
  strawTextureBase.wrapS = THREE.RepeatWrapping;
  strawTextureBase.wrapT = THREE.RepeatWrapping;
  return strawTextureBase;
}

/** One tile of the texture covers about this much wall, so strands come out
 * the same size on a 4ft wall panel and a 12ft floor panel. */
const STRAW_TEXTURE_TILE_FT = 2;

function getStrawTexture(widthFt: number, heightFt: number): THREE.CanvasTexture | null {
  const base = buildStrawTextureBase();
  if (!base) return null;
  const clamp = (n: number) => Math.min(16, Math.max(1, Math.round(n / STRAW_TEXTURE_TILE_FT)));
  const rx = clamp(widthFt);
  const ry = clamp(heightFt);
  const key = `${rx}x${ry}`;
  const cached = strawTextureByRepeat.get(key);
  if (cached) return cached;
  /* `clone` shares the canvas image and gets its own repeat — which is the
     whole reason for the cache, since repeat lives on the texture, not on the
     material. */
  const texture = base.clone();
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(rx, ry);
  texture.needsUpdate = true;
  strawTextureByRepeat.set(key, texture);
  return texture;
}

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

/** A member's own `opacityOverride` (Tommy: floor bottom membrane
 * "dividing the space into one side being opaque and the other side
 * being 75% opaque followed by 50%") wins over its material's own
 * default — several same-material members can each need a different
 * opacity, which MATERIAL_OPACITY alone can't express. */
function resolveOpacity(member: PanelMember): number | undefined {
  return member.opacityOverride ?? MATERIAL_OPACITY[member.material];
}

/**
 * Any member whose real shape isn't a box — a true beveled-end trapezoid
 * prism (Tommy: "trapezoid cuts" — a diagonal brace's real plumb+level end
 * cuts, not a plain tilted box), an n-gon prism (the floor bottom skin's
 * footprint-shaped opacity bands, whose ring is the building's own outline
 * clipped into a band, so it has as many corners as the building does), or a
 * SECTION prism (a roof panel's plumb end cut, whose bevel runs across the
 * panel's depth and span at once — see `sectionCornersIn`).
 *
 * Both corners AND topology come from the same two shared helpers the OBJ
 * exporter uses — `memberLocalCornersIn` and `memberFaceIndices` — so the
 * downloadable file and the on-screen view can never disagree about either.
 * The corners arrive already in VIEW SPACE (Y-up: X=width, Y=height up,
 * Z=depth), not the MEMBER SPACE the `position` fields are authored in
 * (X=width, Y=depth, Z=height up, see `MemberPosition` in
 * componentSchema.ts); this just converts to feet and wires them into a
 * `BufferGeometry`.
 *
 * Faces are fan-triangulated (`i0, ij, ij+1`) rather than assumed to be
 * quads — `memberFaceIndices` emits triangle caps as well as quad sides,
 * and never anything larger than a quad. `DoubleSide` is used defensively:
 * this winding was only ever validated against the OBJ format's own face
 * convention, not against three.js' CCW-front-face convention specifically,
 * so this guards against an invisible (backface-culled) mesh. */
function buildPrismGeometry(member: PanelMember): THREE.BufferGeometry {
  const corners = memberLocalCornersIn(member);
  const positions = new Float32Array(corners.length * 3);
  corners.forEach(([x, y, z], i) => {
    positions[i * 3] = x / IN_PER_FT;
    positions[i * 3 + 1] = y / IN_PER_FT;
    positions[i * 3 + 2] = z / IN_PER_FT;
  });
  const indices: number[] = [];
  for (const face of memberFaceIndices(member)) {
    for (let i = 1; i < face.length - 1; i++) {
      indices.push(face[0]! - 1, face[i]! - 1, face[i + 1]! - 1);
    }
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

/** Renders one box mesh per member, in VIEW SPACE (Y-up) — X=width from the
 * panel's own min-corner, Y=height up from 0, Z=depth from its exterior face
 * at 0. That is the render/export space, NOT the MEMBER SPACE a builder
 * authors `position` in (X=width, Y=depth, Z=height up — see `MemberPosition`
 * in componentSchema.ts); the swap between them happens here and in
 * `memberLocalCornersIn`, nowhere else. Shared by StandardPanel3DView.tsx (a
 * panel viewed alone, at the scene origin) and Building3DView.tsx (many panels
 * placed around a whole footprint, each wrapped in its own positioned/rotated
 * `<group>` — since this renders purely in the panel's own local frame, it
 * composes correctly either way without knowing which context it's in). */
export default function PanelMembersGroup({ members, colorOverride }: PanelMembersGroupProps) {
  const straw = useContext(StrawFillContext);
  /* ⚠ Derived from the members themselves, in `panel-catalog`, so the whole
     building and the single-panel preview cannot draw the straw in two
     different places. See `strawFillBoxIn` for why the box stops where it
     does on a gable. */
  const strawBox = useMemo(() => (straw.show ? strawFillBoxIn(members) : null), [straw.show, members]);
  const strawMap =
    straw.show && straw.textured && strawBox
      ? getStrawTexture(strawBox.sizeIn[0] / IN_PER_FT, strawBox.sizeIn[1] / IN_PER_FT)
      : null;
  return (
    <>
      {strawBox && (
        <mesh
          position={[
            strawBox.centerIn[0] / IN_PER_FT,
            strawBox.centerIn[1] / IN_PER_FT,
            strawBox.centerIn[2] / IN_PER_FT,
          ]}
        >
          <boxGeometry args={[strawBox.sizeIn[0] / IN_PER_FT, strawBox.sizeIn[1] / IN_PER_FT, strawBox.sizeIn[2] / IN_PER_FT]} />
          {/* Transparent either way: the frame standing inside the straw is
              the thing a fabricator is looking at, and an opaque fill would
              hide every member this component exists to draw. */}
          {/* ⚠ `key` on the MATERIAL, not just the prop. Adding or removing a
              `map` on a live three.js material needs the shader recompiled;
              without a key the toggle flipped the prop and the scene did not
              change at all — measured in the browser, the textured and flat
              frames were pixel-identical. The key makes r3f build a fresh
              material instead. */}
          <meshStandardMaterial
            key={strawMap ? "straw-textured" : "straw-flat"}
            /* ⚠ WHITE under the map, not the straw colour. `color` multiplies
               the texture, and the texture is already painted in the straw
               colour — tinting it again squared the fill towards brown and the
               strands all but vanished behind 55% opacity. Measured in the
               browser: tinted, the textured and flat frames were almost
               indistinguishable. */
            color={strawMap ? "#ffffff" : STRAW_COLOR}
            {...(strawMap ? { map: strawMap } : {})}
            transparent
            opacity={STRAW_OPACITY}
          />
        </mesh>
      )}
      {members.map((member) => {
        if (member.position.trapezoidCornersIn || member.position.planPolygonCornersIn || member.position.sectionCornersIn) {
          return (
            <mesh key={member.memberId} geometry={buildPrismGeometry(member)}>
              <meshStandardMaterial
                color={colorOverride ?? MATERIAL_COLOR[member.material]}
                transparent={resolveOpacity(member) !== undefined}
                opacity={resolveOpacity(member) ?? 1}
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
              transparent={resolveOpacity(member) !== undefined}
              opacity={resolveOpacity(member) ?? 1}
            />
          </mesh>
        );
      })}
    </>
  );
}
