/**
 * ⚠ **U5 — a site around the building, as a toggle.** His ask, 2026-11-05:
 *
 * > *"Grass, sky, a horizon and a shadow. Ours is a grey void — honest for a
 * > fabricator, cold for a client."*
 *
 * ⚠ **This is the 2026-10-29 ground-plane decision revisited with a switch
 * instead of a deletion, and the reason it was deleted is the reason it has to
 * stay a switch.** Tommy, 2026-10-29: *"it blocks the floor panels from being
 * visible and doesn't really illustrate anything for the user."* He was right,
 * and the cause is exact rather than aesthetic: **the floor deck hangs BELOW
 * the datum.** `deckPanelTakeoff.ts` anchors every floor panel at `anchorYFt:
 * 0` — *"The floor deck hangs below Z=0, the finished floor the walls stand
 * on"* — and the view then tips the panel a quarter turn, which swings its
 * 15 1/2in depth from up to down. So a floor deck occupies Y = −15 1/2in to 0,
 * and the bale foundation hangs below the datum too. The old ground was drawn
 * at **y = −0.05ft (−0.6in)**, which is *inside* the floor system: an opaque
 * sheet there buries the whole floor deck and leaves the walls standing on
 * nothing.
 *
 * So the grass here is **not** placed at a fixed offset. It is placed one inch
 * below the lowest point the scene actually draws, measured off the same
 * render data that draws it and through the same rotation the renderer applies
 * — see `siteGroundYFt`, `lowestDrawnYFt` and `deckGroupRotationX`. That makes
 * "the ground can never hide a panel" a property of the arithmetic rather than
 * a promise, and `site.test.ts` checks it against every floor system this app
 * can build.
 *
 * ⚠ **None of this is a site.** There is no survey, no grade, no slope, no
 * soil, no setback, no orientation and no time of day. It is scenery: the sky,
 * the lawn and the shadow exist so a homeowner is not looking into a grey
 * void. Nothing in this file enters a takeoff, a price, a weight, a fabrication
 * sheet or an export — same structural reason as U4's props: the OBJ and
 * COLLADA downloads are built from `buildExportPanels()`, a data path, not a
 * walk of the three.js scene. See `SITE_PROVENANCE`, which the 3D Layers note
 * prints verbatim so the screen says exactly what this file says.
 */

import { memberBoxSizeIn, memberLocalCornersIn, type PanelMember } from "@building-integrity/panel-catalog";

const IN_PER_FT = 12;

/** A plan bounding box in feet — the same shape U4's props use. Re-declared
 * here rather than imported from `scaleProps.ts` so neither module depends on
 * the other; they are two independent view layers that happen to need the same
 * four numbers. */
export interface SitePlanBoundsFt {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * How far below the lowest drawn member the grass sits, feet — **one inch**.
 *
 * ⚠ Small on purpose. Any larger and the building visibly floats; any smaller
 * and z-fighting puts the grass through the floor deck's bottom skin, which is
 * a 1/8in steel mesh. One inch is clear of the mesh at every camera distance
 * this view uses and is under a pixel of apparent gap on anything bigger than
 * a shed.
 */
export const SITE_GROUND_CLEARANCE_FT = 1 / IN_PER_FT;

/**
 * ⚠ **How much AIR a floor panel stands in, feet — two.**
 *
 * > *"separate the grass from floor panels by 2 ft — even if foundation is not
 * > selected. we cant be having it look like these panels — when made of floor
 * > panels — are touching the ground."* — Tommy, 2026-11-08
 *
 * This deliberately overturns the reasoning on `SITE_GROUND_CLEARANCE_FT`
 * above, which says *"any larger and the building visibly floats"*. It turns
 * out floating is the lesser evil: a straw floor panel bedded into grass reads
 * as a slab-on-grade detail, and this system does not build one. A visible gap
 * says "something holds this up" even when the thing holding it up has not
 * been chosen yet, which is the honest picture.
 *
 * ⚠ **It applies only when NOTHING ELSE holds the building up**, and getting
 * that wrong is a mistake I made and this module's own test caught.
 *
 * I first wrote it as `min(an inch under everything, two feet under the floor)`
 * and claimed in this comment that a drawn foundation would therefore always
 * win and meet grade. It does not. A bale foundation 3 ft deep sits under a
 * floor deck whose own bottom is only ~1.3 ft down, so two feet under the deck
 * is 3.29 ft — *lower than the foundation* — and the foundation came out
 * floating two and a half inches above the grass. The very defect the shape
 * was supposed to prevent.
 *
 * So the rule branches, and honestly: **a foundation defines grade when there
 * is one**, and the two feet is the fallback for when there is not. That still
 * satisfies his *"even if foundation is not selected"* — which is the case the
 * fallback exists for — and it keeps the thing whose job is to touch the
 * ground touching the ground.
 *
 * ⚠ **PRESENTATION ONLY.** Nothing that prices, weighs, exports or fabricates
 * may read this. It is not a foundation height, and no real-world claim is
 * made that a bale floor sits 24in clear of grade — that is a building
 * question nobody has answered. It moves a grass plane in a 3D preview.
 */
export const SITE_FLOOR_PANEL_AIR_GAP_FT = 2;

/**
 * ⚠ **The extra rotation `Building3DView` puts on a DECK group**, radians
 * about X — exported from here so there is exactly one expression of it and
 * the grass cannot be placed against a transform the renderer does not use.
 *
 * A floor or roof panel's members are built *lying in the compressor table*:
 * member X is its width, member Y its depth, member Z its span. The view tips
 * each panel a quarter turn (less the roof's pitch) to stand that span out
 * along the plane it belongs on. ⚠ **For a FLOOR that quarter turn is exactly
 * why the deck hangs below the datum** — it swings the panel's 15 1/2in depth
 * from "up" to "down", so a floor panel anchored at Y = 0 occupies Y =
 * −15 1/2in to 0. That is the sentence `deckPanelTakeoff.ts` writes as *"the
 * floor deck hangs below Z=0"*, and it is the whole reason a ground plane at
 * −0.6in buried it.
 */
export function deckGroupRotationX(tiltRad: number): number {
  return Math.PI / 2 - tiltRad;
}

/** Which frame a placed group's members are drawn in — the two cases
 * `Building3DView` actually has. */
export type SiteGroupFrame =
  /** Drawn as-is: wall slots, gable tiles, beams, the bale foundation. */
  | { kind: "upright" }
  /** Tipped by `deckGroupRotationX(tiltRad)`: floor and roof panels. */
  | { kind: "deck"; tiltRad: number };

/** One placed group of members, as every render-data array in
 * `Building3DView` already shapes them. */
export interface SitePlacedGroup {
  anchorYFt: number;
  frame: SiteGroupFrame;
  members: PanelMember[];
}

function frameRotationX(frame: SiteGroupFrame): number {
  return frame.kind === "deck" ? deckGroupRotationX(frame.tiltRad) : 0;
}

/**
 * A member's own corners in the renderer's local frame, inches — the
 * `worldX = panelX, worldY = panelZ, worldZ = panelY` swap
 * `PanelMembersGroup` performs, before the group's own rotation.
 */
function memberRendererCornersIn(member: PanelMember): [number, number, number][] {
  const { trapezoidCornersIn, planPolygonCornersIn, sectionCornersIn, tiltDeg, xIn, yIn, zIn } = member.position;
  if (trapezoidCornersIn || planPolygonCornersIn || sectionCornersIn) {
    /* `memberLocalCornersIn` already performs that same swap, so these are the
       real cut corners in the renderer's frame. */
    return memberLocalCornersIn(member);
  }
  const size = memberBoxSizeIn(member);
  /* ⚠ **A TILTED box is bounded loosely, and only ever on the safe side.** It
     stores its CENTRE and rotates about the renderer's Z, which mixes its
     width into its height. Rather than redo that rotation here, this takes the
     enclosing box `centre ± (width + height) / 2`, which contains the real one
     at every angle — so the grass can come out a few inches deeper than it
     needs to under a diagonal brace, and never an inch shallower. A few inches
     of extra lawn is nothing; a buried panel is the defect. */
  const tilted = tiltDeg !== undefined;
  const halfSpread = (size.xIn + size.zIn) / 2;
  const half = tilted
    ? { x: halfSpread, y: halfSpread, z: size.yIn / 2 }
    : { x: size.xIn / 2, y: size.zIn / 2, z: size.yIn / 2 };
  const centre = tilted
    ? { x: xIn, y: zIn, z: yIn }
    : { x: xIn + size.xIn / 2, y: zIn + size.zIn / 2, z: yIn + size.yIn / 2 };
  const corners: [number, number, number][] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        corners.push([centre.x + sx * half.x, centre.y + sy * half.y, centre.z + sz * half.z]);
      }
    }
  }
  return corners;
}

/**
 * The lowest point this member's drawn geometry reaches once its group's own
 * rotation is applied, in inches above the group's anchor.
 *
 * ⚠ **It must never report higher than the truth, and it is allowed to report
 * lower** — the guarantee this whole file exists for is that the grass goes
 * under everything, and an over-deep answer costs a hair of invisible gap
 * while an over-shallow one buries a panel.
 */
export function lowestMemberHeightIn(member: PanelMember, frame: SiteGroupFrame = { kind: "upright" }): number {
  const rotX = frameRotationX(frame);
  const cos = Math.cos(rotX);
  const sin = Math.sin(rotX);
  let lowest = Infinity;
  for (const [, y, z] of memberRendererCornersIn(member)) {
    lowest = Math.min(lowest, y * cos - z * sin);
  }
  return lowest;
}

/**
 * The lowest world Y, feet, that any of these placed groups draws — never
 * above **0**, which is the datum the wall toe-up stands on.
 *
 * ⚠ **Which groups the caller has to pass, and why that is not every group.**
 * Only two things in this app are drawn below the datum: the **floor deck**
 * (anchored at 0 and tipped so its depth hangs below) and the **bale
 * foundation** (anchored entirely below it, bottom skin included). Walls,
 * gables, roof panels, beams, the ridge column and the cross-tilt row are all
 * anchored at or above 0 by construction, with their members inside their own
 * panel, so the `Math.min(0, …)` floor below already covers them — and passing
 * them would mean walking every member in the building to learn a number that
 * cannot change. ⚠ If something new is ever drawn beneath the datum it has to
 * be added here; that is the one maintenance obligation this function carries.
 */
export function lowestDrawnYFt(groups: readonly SitePlacedGroup[]): number {
  let lowest = 0;
  for (const group of groups) {
    for (const member of group.members) {
      lowest = Math.min(lowest, group.anchorYFt + lowestMemberHeightIn(member, group.frame) / IN_PER_FT);
    }
  }
  return lowest;
}

/**
 * Where the grass goes.
 *
 * - **Something bears on the ground** (a bale foundation is drawn): an inch
 *   under the lowest thing drawn, as it always was. The foundation meets grade,
 *   which is its job, and whatever clearance that gives the floor deck above it
 *   is the real answer rather than one this function invents.
 * - **Nothing bears on the ground** and there are floor panels: two feet under
 *   the lowest floor panel, so the deck plainly stands in air instead of
 *   looking bedded into the grass.
 * - **Nothing bears on the ground and no floor panels**: an inch under
 *   everything, unchanged. There is nothing there that could look bedded in.
 *
 * ⚠ `floorOnlyLowestY` is `null` for BOTH of the first and third cases, and
 * the caller decides which. It must not be `0` as a stand-in for "none": an
 * empty group list makes `lowestDrawnYFt` return exactly `0` (its `min(0, …)`
 * floor), so a `0` default would have computed `0 - 2` and dropped the grass
 * two feet under every floorless building. A sentinel has to sit outside the
 * range of real answers, and `0` is an ordinary answer here.
 */
export function siteGroundYFt(lowestDrawnY: number, floorOnlyLowestY: number | null = null): number {
  const underEverything = Math.min(0, lowestDrawnY) - SITE_GROUND_CLEARANCE_FT;
  if (floorOnlyLowestY === null) return underEverything;
  /* ⚠ Not `Math.min` with `underEverything`. When this branch is taken the
     floor deck IS the lowest thing drawn, so the two feet is always the lower
     of the two anyway — and reaching for a min here is what hid the floating
     foundation, by making the expression look safe for inputs it was never
     given. See SITE_FLOOR_PANEL_AIR_GAP_FT. */
  return Math.min(0, floorOnlyLowestY) - SITE_FLOOR_PANEL_AIR_GAP_FT;
}

/**
 * The lawn's half-size, feet — a square plane `2 × radius` on a side, centred
 * on the building.
 *
 * ⚠ **It has to outrun the camera, which has no polar limit.**
 * `OrbitControls` is mounted with no `maxPolarAngle`, so a user can swing the
 * view down to the horizon and below (U1's Reset View exists because they do).
 * At the opening bird's-eye the farthest visible ground is only a few
 * building-widths out, but at the horizon it is unbounded — which is why the
 * fog below matters more than this number does: the lawn fades to haze well
 * inside its own edge, so the edge is never what the user sees. Twenty
 * building-widths, floored at 400ft so a 10ft shed still gets a landscape,
 * capped at 3000ft so the sky box that has to contain it stays inside the
 * camera's far plane.
 */
export function siteGroundRadiusFt(maxDimFt: number): number {
  return Math.min(3000, Math.max(400, maxDimFt * 20));
}

/**
 * Linear fog, feet — what actually makes the horizon.
 *
 * ⚠ **`nearFt` is set so the BUILDING is never fogged.** Fog is a property of
 * the scene, not of the ground, so every panel material takes it too. At the
 * opening camera the farthest corner of the building is about `2.4 × maxDim`
 * from the eye (`1.6 × maxDim` of camera distance plus a half-diagonal), so
 * fog starting at `4 × maxDim` cannot touch it. Zoom far enough out and the
 * far wall will haze slightly — which is what distance does, and is also why
 * this is a client-facing toggle rather than something a fabricator reads
 * members through.
 *
 * ⚠ **`farFt` is well inside the lawn's own edge** (just over half of it), so
 * the grass is fully haze-coloured long before it runs out. That is the
 * horizon: the lawn does not end, it dissolves.
 */
export function siteFogRangeFt(maxDimFt: number): { nearFt: number; farFt: number } {
  return { nearFt: Math.max(120, maxDimFt * 4), farFt: siteGroundRadiusFt(maxDimFt) * 0.55 };
}

/**
 * The sky dome's `distance`, feet — drei's `Sky` is a unit box scaled by this,
 * so its half-extent is `distance / 2`.
 *
 * ⚠ **Two constraints, and both are tested.** The box has to CONTAIN the lawn,
 * or the grass runs out through the sky and the horizon shows the inside of a
 * cube; and its half-extent has to stay inside the camera's own `far` plane
 * (10000ft, set on the `<Canvas>`), or the sky is clipped away entirely. 2.4 ×
 * the lawn radius satisfies both at every building size this app will draw,
 * which is what the 3000ft cap on the radius is there to guarantee.
 */
export function siteSkyDistanceFt(maxDimFt: number): number {
  return siteGroundRadiusFt(maxDimFt) * 2.4;
}

/** The camera's own `far` plane, feet, as the `<Canvas>` sets it. Here so the
 * sky-clipping check above is an assertion rather than a hope. */
export const SITE_CAMERA_FAR_FT = 10000;

/**
 * ⚠ **Where the light has always been with NO site**, and it does not move.
 * The scene's `directionalLight` has sat at `[maxDim, maxDim × 2, maxDim]`
 * since long before U5; `Building3DView` builds that position from this
 * constant now so it is named rather than repeated. Over the opening camera's
 * own shoulder, which lights both faces a bird's-eye view can see — exactly
 * what a fabricator reading a frame wants, and why U5 does not touch it.
 */
export const VOID_SUN_DIRECTION: readonly [number, number, number] = [1, 2, 1];

/**
 * ⚠ **Where the sun goes once there IS a site, and why it is not the same
 * vector.**
 *
 * With the site on the sun is a real object in the scene: it is drawn in the
 * sky and it throws a shadow on the lawn. `VOID_SUN_DIRECTION` sits at the
 * opening camera's own azimuth (both are 45°, +X +Z), so a shadow cast from
 * there falls **directly away from the viewer and hides behind the building** —
 * measured in the browser 2026-11-07, where the shadow was real, correct and
 * invisible until the view had been orbited most of the way round. Mirroring
 * the sun's X puts the shadow across the screen instead: the shadow direction
 * comes out at 90° to the view, so it lands beside the building at the opening
 * camera and stays visible through most of an orbit.
 *
 * The cost is that one of the two faces a bird's-eye sees falls to ambient
 * light. That is a fair trade with the site on (differentiated faces read as
 * three-dimensional; equal ones read flat) and it is why the fabricator's own
 * lighting is left alone: the light only moves when the toggle is on.
 *
 * ⚠ It is a DIRECTION, not a time or a latitude — about 55° above the horizon,
 * chosen so the shadow can be seen, not derived from any site.
 */
export const SITE_SUN_DIRECTION: readonly [number, number, number] = [-1, 2, 1];

/** The azimuth the 3D view's camera opens at, degrees, as
 * `Building3DView`'s own `BIRDS_EYE_AZIMUTH_DEG` sets it — here so the
 * sun-placement check above is an assertion rather than a hope. */
export const SITE_OPENING_CAMERA_AZIMUTH_DEG = 45;

/**
 * How far from the building's centre the sun sits, feet. Only the DIRECTION
 * matters to the lighting — a directional light has no position in the
 * physical sense — but the shadow camera is placed there, so the distance has
 * to be a real number that the near/far planes below are measured against.
 */
export function siteSunDistanceFt(maxDimFt: number): number {
  const [x, y, z] = SITE_SUN_DIRECTION;
  return maxDimFt * Math.hypot(x, y, z);
}

/**
 * ⚠ **The sun shadow's own camera.**
 *
 * **Why a real shadow map and not drei's `ContactShadows`:** the contact
 * shadow was built first and renders NOTHING in this app's three.js / r3f /
 * drei combination — measured in the browser 2026-11-07 with the shadow forced
 * to opaque red and its frustum opened to 50ft, on a reloaded page with no
 * console error and no lost context. It draws the scene into a render target
 * with `scene.overrideMaterial`, and whatever that pass is doing here, the
 * texture comes back empty. Rather than keep guessing at somebody else's
 * render pass, the shadow is now three's own: one directional light with
 * `castShadow`, one ground plane with `receiveShadow`.
 *
 * ⚠ **And ONE caster: a solid prism of the building's own footprint.** Not the
 * members. Two reasons, and the second is the better one:
 *
 * 1. Casting from the frame would mean `castShadow` on every member mesh,
 *    which means editing `PanelMembersGroup` — the component the panel editor
 *    shares — and a depth pass over thousands of 1 1/2in sticks that comes out
 *    as aliased noise at any map size this app can afford.
 * 2. **The real building is not a lattice.** It is solid straw-panel walls
 *    under plaster; the frame is a fabrication view of it. A client looking at
 *    the site toggle should see the shadow the finished building throws, which
 *    is its massing. That is what this casts.
 *
 * The caster is invisible in the beauty pass (`colorWrite` and `depthWrite`
 * both off) and still casts, because three's shadow pass swaps in its own
 * depth material and only checks `object.visible` and `material.visible`.
 */
export interface SiteSunShadow {
  /** Half-width of the light's orthographic shadow camera, feet. */
  halfSizeFt: number;
  nearFt: number;
  farFt: number;
  /** Shadow map side in texels — a power of two. */
  mapSize: number;
  /** Pushes the shadow test along the surface normal, feet. Shadow ACNE on a
   * ground plane this large is otherwise guaranteed; a normal bias handles it
   * without the peter-panning a depth bias causes. */
  normalBiasFt: number;
}

/**
 * ⚠ **Sized from the plan box's distance from the ORIGIN, not from its own
 * width.** The scene's directional light has always been positioned relative
 * to the origin and aims at the default target there, so its shadow camera is
 * centred on the origin too — a footprint drawn well away from it would fall
 * outside a camera sized only to the building and get no shadow at all. This
 * takes the farthest plan coordinate and adds room for the shadow the building
 * throws, which at this sun angle reaches about 0.7 x its height.
 */
export function siteSunShadow(maxDimFt: number, plan: SitePlanBoundsFt): SiteSunShadow {
  const farthestFromOriginFt = Math.max(
    Math.abs(plan.minX),
    Math.abs(plan.maxX),
    Math.abs(plan.minZ),
    Math.abs(plan.maxZ),
  );
  const halfSizeFt = farthestFromOriginFt + Math.max(20, maxDimFt * 1.5);
  const distanceFt = siteSunDistanceFt(maxDimFt);
  /* The scene spans about +/- halfSize along the light's own view axis too, so
     the depth slab is the light's distance give or take that, with a floor on
     `near` because an orthographic near plane behind the camera is meaningless. */
  const depthFt = halfSizeFt * 1.8;
  return {
    halfSizeFt,
    nearFt: Math.max(0.5, distanceFt - depthFt),
    farFt: distanceFt + depthFt,
    mapSize: 2048,
    normalBiasFt: 0.08,
  };
}


/**
 * ⚠ **Site colours are DULL on purpose, and a test enforces that none of them
 * is a panel colour.** Every panel colour in this app is warm or saturated and
 * lumber renders tan; a bright lawn or a saturated haze would compete with the
 * frame for attention in a view whose subject is the frame. The grass is also
 * deliberately darker and greyer than U4's tree foliage (`#7f9a72`), so a tree
 * standing on the lawn still reads as a tree.
 */
export const SITE_COLORS = {
  /** Mown grass, slightly grey. */
  grass: "#8aa877",
  /** The horizon haze the lawn fades into — picked to sit between drei
   * `Sky`'s own pale horizon and the grass, so neither edge shows a band. */
  haze: "#c8d3dc",
} as const;

/**
 * Printed VERBATIM by the 3D Layers note when the site is on, so the app
 * cannot say something milder than this file does.
 */
export const SITE_PROVENANCE =
  "Scenery, not a site. There is no survey here and no grade: no slope, no soil, no setbacks, " +
  "no orientation and no time of day — the sun is placed to light the model, not to match an hour. " +
  "The lawn is drawn one inch below the lowest member so it cannot hide a floor panel — except where " +
  "nothing bears on the ground, when a floor panel is given two feet of air so it does not read as a " +
  "slab on grade. Both are drawing distances and neither is a ground level or a foundation height: " +
  "the building is not sited on anything, and no claim is made about how high a real floor sits. " +
  "The shadow is thrown by a solid prism of the building's own footprint, not by its frame: a finished " +
  "panel building is solid walls, and a lattice of stud shadows would be neither true nor legible. " +
  "None of it is a part: no takeoff, price, weight, sheet or export reads anything here.";
