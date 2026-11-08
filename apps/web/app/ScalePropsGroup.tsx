"use client";

import { Billboard } from "@react-three/drei";
import PanelLabel from "./PanelLabel";
import { drawnPart, scalePropPlacements, type PlanBoundsFt, type ScalePropPart } from "./scaleProps";

const IN_PER_FT = 12;
/** How far above a prop's own head its label floats, inches. Measured in
 * the browser: at 10in the text box's own lower half sat on the figure's head
 * at the opening camera angle, because `PanelLabel` anchors text by its
 * MIDDLE. */
const LABEL_RISE_IN = 22;

/**
 * ⚠ **Props are out of the pointer path entirely.** The 3D view's left-click
 * selects a panel and its right-click opens the panel menu; a figure standing
 * in front of a wall must not be able to swallow either, and a tree must never
 * become an orbit target. A no-op `raycast` has to go on every MESH, not on the
 * group above them — the raycaster walks children regardless of what the
 * parent does. One shared function so it is not a new identity per render.
 */
const NO_RAYCAST = () => {};

/**
 * One part's mesh.
 *
 * ⚠ **This component decides nothing.** Every number it draws comes out of
 * `drawnPart`, a pure function in `scaleProps.ts` that `scaleProps.test.ts`
 * assembles and measures — so "the figure is six feet" is a claim about what
 * is on screen, not about a constant.
 */
function PropPartMesh({ part }: { part: ScalePropPart }) {
  const { positionFt, rotation, geometry, color } = drawnPart(part);
  return (
    /* ⚠ `castShadow` added by U5, and it is free with the site off: nothing
       in the scene casts unless the site's own light is the one with
       `castShadow`, so with the site off three's shadow pass has nothing to
       render. With the site ON it is what puts the figure, the car and the
       tree ON the grass rather than hovering an inch above it. */
    <mesh position={positionFt} rotation={rotation} castShadow raycast={NO_RAYCAST}>
      {geometry.kind === "box" ? (
        <boxGeometry args={geometry.sizeFt} />
      ) : geometry.kind === "sphere" ? (
        <sphereGeometry args={[geometry.radiusFt, 16, 12]} />
      ) : (
        <cylinderGeometry args={[geometry.radiusFt, geometry.radiusFt, geometry.lengthFt, 16]} />
      )}
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/**
 * ⚠ **U4 — the props for scale, drawn.** A 6'-0" person, a car and a tree on
 * the ground outside the building, so a stranger can tell how big it is
 * without reading a dimension. Every size and position comes from
 * `scaleProps.ts`, which `scaleProps.test.ts` measures — see both.
 */
export default function ScalePropsGroup({ bounds, labelScaleFt }: { bounds: PlanBoundsFt; labelScaleFt: number }) {
  return (
    <group>
      {scalePropPlacements(bounds).map(({ prop, positionFt, rotationY }) => (
        <group key={prop.id} position={positionFt} rotation={[0, rotationY, 0]}>
          {prop.parts.map((part, i) => (
            <PropPartMesh key={`${prop.id}-${i}`} part={part} />
          ))}
          {prop.label !== undefined && (
            /* Billboarded rather than fixed to the opening camera angle: the
               label is the prop's whole message, and a 6'-0" that reads
               backwards once the user orbits is worse than no label. */
            <Billboard position={[0, (prop.extentIn[1] + LABEL_RISE_IN) / IN_PER_FT, 0]}>
              <PanelLabel text={prop.label} position={[0, 0, 0]} fontSize={labelScaleFt} />
            </Billboard>
          )}
        </group>
      ))}
    </group>
  );
}
