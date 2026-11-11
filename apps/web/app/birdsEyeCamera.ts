/**
 * Where the 3D view's camera stands when it opens, and why it stops cutting
 * the building off.
 *
 * ⚠ **Its own module so it can be TESTED.** It used to be a four-line
 * closure inside `Building3DView.tsx`, which imports three.js and
 * `@react-three/fiber`; a unit test of the arithmetic had to drag the whole
 * renderer in with it, so there was none, and a fit that ignored the
 * building's height survived in plain sight. This file imports nothing.
 */

/**
 * ⚠ **30 degrees above flat, his number.**
 *
 * > *"part of the 3d birds eye of the building is usually cut off, perhaps
 * > could be fixed if we lowered the angle to 30 degrees above flat or
 * > something."* — Tommy, 2026-11-10
 *
 * It was 50, which looks down INTO a building rather than at it. Lowering it
 * does not by itself stop anything being cut off — a lower eye makes the
 * building taller in frame, not shorter — so the fit below had to be fixed
 * at the same time.
 */
export const BIRDS_EYE_ELEVATION_DEG = 30;

/** A corner/three-quarter starting view, not straight-on. */
export const BIRDS_EYE_AZIMUTH_DEG = 45;

/** Breathing room around the fitted box, so the building is not jammed
 * against the frame edge. */
export const BIRDS_EYE_FIT_MARGIN = 1.08;

/** The plan extent the camera has to frame, in feet. */
export interface BirdsEyePlanBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BirdsEyeFitInputs {
  box: BirdsEyePlanBox;
  /** The plan centre the camera orbits — kept separate from the box so a
   * caller may frame a box it is not looking at the middle of. */
  centerX: number;
  centerZ: number;
  /** The building's own vertical extent, floor line to the top of whatever
   * it has up there. */
  yMinFt: number;
  yMaxFt: number;
  /** The height the camera looks at. */
  targetYFt: number;
  /** The camera's VERTICAL field of view, in degrees. */
  fovDeg: number;
  /** width / height of the canvas it will be rendered into. */
  aspect: number;
}

/**
 * Initial camera position for a bird's-eye starting view, **fitted to the
 * whole building** rather than to its plan.
 *
 * ⚠ **THE HEIGHT WAS NOT IN THE SUM, AND THAT IS WHY THE RENDER WAS CUT
 * OFF.** The distance used to be `maxDim * 1.6`, where `maxDim` is the
 * larger of the footprint's two plan dimensions — nothing about walls, ridge
 * or roof at all. A tall building on a small footprint overflowed the frame
 * every time, and the Project Summary's own 720 x 480 capture is where it
 * showed worst.
 *
 * The fit projects the box's own **eight corners** onto the camera's two
 * axes and backs off until the worst of them sits inside both halves of the
 * frustum. A bounding sphere would have been three lines, and was tried
 * first: it cannot clip either, but it is the sphere AROUND a long building,
 * so a 24 x 48 came out filling about 60% of the frame with white all round
 * it — the thumbnail's whole job is to be small, and a small picture of a
 * small building in a big empty square reads as a mistake. Corners cost a
 * loop and frame it tight.
 *
 * `OrbitControls` lets the view be adjusted freely from there; this only has
 * to be a starting point that shows the whole thing.
 */
export function birdsEyeCameraPosition(fit: BirdsEyeFitInputs): [number, number, number] {
  const elevationRad = (BIRDS_EYE_ELEVATION_DEG * Math.PI) / 180;
  const azimuthRad = (BIRDS_EYE_AZIMUTH_DEG * Math.PI) / 180;
  /* The unit vector from the target TOWARD the camera. Everything below is
     measured along this and the two axes across it, so the fit holds at any
     elevation or azimuth rather than only at the ones in use today. */
  const dir: [number, number, number] = [
    Math.cos(elevationRad) * Math.cos(azimuthRad),
    Math.sin(elevationRad),
    Math.cos(elevationRad) * Math.sin(azimuthRad),
  ];
  /* right = normalize(worldUp x dir); up = dir x right. worldUp is never
     parallel to dir here (the elevation is well short of straight down), so
     neither cross product degenerates. */
  const rightRaw: [number, number, number] = [dir[2], 0, -dir[0]];
  const rightLen = Math.hypot(rightRaw[0], rightRaw[1], rightRaw[2]) || 1;
  const right: [number, number, number] = [rightRaw[0] / rightLen, rightRaw[1] / rightLen, rightRaw[2] / rightLen];
  const up: [number, number, number] = [
    dir[1] * right[2] - dir[2] * right[1],
    dir[2] * right[0] - dir[0] * right[2],
    dir[0] * right[1] - dir[1] * right[0],
  ];

  const vFovRad = (fit.fovDeg * Math.PI) / 180;
  const tanV = Math.tan(vFovRad / 2);
  const tanH = tanV * Math.max(fit.aspect, 0.01);

  let distance = 0;
  for (const cx of [fit.box.minX, fit.box.maxX]) {
    for (const cy of [fit.yMinFt, fit.yMaxFt]) {
      for (const cz of [fit.box.minZ, fit.box.maxZ]) {
        /* The corner relative to what the camera looks at. */
        const vx = cx - fit.centerX;
        const vy = cy - fit.targetYFt;
        const vz = cz - fit.centerZ;
        /* How far toward the camera this corner already is: a corner on the
           near side needs the camera pushed back by that much again. */
        const along = vx * dir[0] + vy * dir[1] + vz * dir[2];
        const across = Math.abs(vx * right[0] + vy * right[1] + vz * right[2]);
        const upward = Math.abs(vx * up[0] + vy * up[1] + vz * up[2]);
        distance = Math.max(distance, across / tanH + along, upward / tanV + along);
      }
    }
  }
  distance = Math.max(distance * BIRDS_EYE_FIT_MARGIN, 1);

  const height = distance * Math.sin(elevationRad);
  const horizontal = distance * Math.cos(elevationRad);
  return [
    fit.centerX + horizontal * Math.cos(azimuthRad),
    fit.targetYFt + height,
    fit.centerZ + horizontal * Math.sin(azimuthRad),
  ];
}
