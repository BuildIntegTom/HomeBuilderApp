"use client";

import { Sky } from "@react-three/drei";
import { ExtrudeGeometry, Shape } from "three";
import { SITE_COLORS, siteFogRangeFt, siteGroundRadiusFt, siteSkyDistanceFt } from "./site";

/**
 * ⚠ **The site is out of the pointer path entirely**, the rule U4's props
 * follow and for a sharper reason here: the lawn is thousands of feet across,
 * so without this it would intercept every click the building misses — and
 * `Building3DView`'s `onPointerMissed` is what clears the Orbit tool's
 * re-centring, so a lawn that can be hit is a lawn that silently breaks a
 * tool. It has to go on the MESH, not the group: the raycaster walks children
 * regardless of what the parent does. One shared function so it is not a new
 * identity per render.
 */
const NO_RAYCAST = () => {};

/**
 * ⚠ **The lawn needs SEGMENTS, which is not a cosmetic choice.** three.js fog
 * is computed per-vertex into a varying and interpolated across the triangle,
 * so a single 6000ft quad would show a gradient interpolated between four
 * corners — a diagonal seam straight across the ground rather than a horizon.
 * 64 x 64 makes the gradient read as distance and still costs one draw call.
 */
const GROUND_SEGMENTS = 64;

/**
 * ⚠ **One shadow-caster geometry alive at a time, built outside React.**
 *
 * The caster is an extruded prism of the footprint, so it changes whenever the
 * building is resized or re-drawn — and a fresh `ExtrudeGeometry` on every
 * render would leak a GPU buffer per frame. A one-slot cache keyed by the
 * geometry's own description is the pattern this app already uses for the
 * straw texture in `PanelMembersGroup`; it costs no hook, and it disposes the
 * geometry it replaces instead of letting the previous one go unreferenced.
 */
let casterCache: { key: string; geometry: ExtrudeGeometry } | null = null;

function casterGeometry(cornersFt: readonly { x: number; z: number }[], heightFt: number): ExtrudeGeometry {
  const key = `${heightFt}|${cornersFt.map((c) => `${c.x},${c.z}`).join(";")}`;
  if (casterCache?.key === key) return casterCache.geometry;
  casterCache?.geometry.dispose();
  /* The shape is drawn in (x, −z) and extruded along +Z, so the mesh's own
     −90° turn about X below lands the extrusion on +Y (height) and puts the
     shape's y back on world +Z. */
  const shape = new Shape();
  cornersFt.forEach((corner, i) => {
    if (i === 0) shape.moveTo(corner.x, -corner.z);
    else shape.lineTo(corner.x, -corner.z);
  });
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: heightFt, bevelEnabled: false });
  casterCache = { key, geometry };
  return geometry;
}

export interface SiteGroupProps {
  /** Where the grass goes — `siteGroundYFt` of the scene's own lowest member,
   * never a fixed offset. See `site.ts`'s header for why that is the whole
   * point of this feature. */
  groundYFt: number;
  /** The building's largest plan dimension, feet — sizes the lawn, the fog and
   * the sky together. */
  maxDimFt: number;
  centerXFt: number;
  centerZFt: number;
  /** The footprint's own corners in plan feet, for the shadow caster — the
   * real outline, so an octagon or a notched plan throws its own shadow rather
   * than a rectangle's. */
  footprintCornersFt: readonly { x: number; z: number }[];
  /** ⚠ **Where the caster's underside sits, feet — `siteCasterBaseYFt`, the
   * bottom of the BUILDING rather than `groundYFt`.** Based at the grass it
   * filled a floor panel's two feet of air with invisible mass and welded the
   * shadow to the footprint, so a deck standing in air drew the picture of a
   * deck standing on the ground. See `siteCasterBaseYFt` for the measurement
   * that forced it. */
  casterBaseYFt: number;
  /** How tall the caster stands above its base, feet: the top of the roof
   * where there is one, the top of the walls where there is not. */
  casterHeightFt: number;
  /** The scene's own sun, so the disc drawn in the sky is the same one lighting
   * the model and throwing the shadow. Passed in rather than read here, because
   * `Building3DView` owns the light. */
  sunDirection: readonly [number, number, number];
}

/**
 * ⚠ **U5 — the site, drawn.** Sky, lawn, horizon, shadow. Every number comes
 * from `site.ts`, which `site.test.ts` measures; this component decides
 * nothing. The light that throws the shadow lives in `Building3DView` beside
 * the scene's other lights, not here.
 */
export default function SiteGroup({
  groundYFt,
  maxDimFt,
  centerXFt,
  centerZFt,
  footprintCornersFt,
  casterBaseYFt,
  casterHeightFt,
  sunDirection,
}: SiteGroupProps) {
  const radiusFt = siteGroundRadiusFt(maxDimFt);
  const { nearFt, farFt } = siteFogRangeFt(maxDimFt);
  return (
    <>
      {/* ⚠ Attached to the SCENE, so r3f restores whatever was there when the
          toggle goes off. The background matters on its own: zoom far enough
          out to leave the sky box and the view would otherwise fall back to
          the page's own grey, which is the void this feature exists to end. */}
      <color attach="background" args={[SITE_COLORS.haze]} />
      <fog attach="fog" args={[SITE_COLORS.haze, nearFt, farFt]} />
      {/* ⚠ Centred on the BUILDING, via a group: drei's `Sky` types accept no
          transform of their own, and its box is centred on wherever it sits —
          left at the origin, a footprint drawn well away from it would run out
          through the side of the sky. */}
      <group position={[centerXFt, groundYFt, centerZFt]}>
        <Sky
          distance={siteSkyDistanceFt(maxDimFt)}
          sunPosition={[sunDirection[0], sunDirection[1], sunDirection[2]]}
          turbidity={6}
          rayleigh={1.2}
        />
      </group>
      <mesh
        position={[centerXFt, groundYFt, centerZFt]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        raycast={NO_RAYCAST}
      >
        <planeGeometry args={[radiusFt * 2, radiusFt * 2, GROUND_SEGMENTS, GROUND_SEGMENTS]} />
        <meshStandardMaterial color={SITE_COLORS.grass} />
      </mesh>
      {/* ⚠ **The shadow caster, and it is invisible.** `colorWrite` off so it
          paints nothing and `depthWrite` off so it occludes nothing — three's
          shadow pass swaps in its own depth material and checks only
          `object.visible` and `material.visible`, so it still casts. See
          `SiteSunShadow` in `site.ts` for why the shadow is the building's
          massing rather than its frame. */}
      {footprintCornersFt.length >= 3 && casterHeightFt > 0 && (
        <mesh
          geometry={casterGeometry(footprintCornersFt, casterHeightFt)}
          position={[0, casterBaseYFt, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          raycast={NO_RAYCAST}
        >
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}
