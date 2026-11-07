/**
 * ⚠ **U4 — Props for scale.** His ask, 2026-11-05:
 *
 * > *"A 6 ft figure, a car, a tree. The cheapest realism in their whole
 * > product, and the one thing that tells a client whether a 12 ft wall is
 * > big."*
 *
 * Three objects of known size, standing on the ground outside the building,
 * so a stranger looking at the model can tell how big it is without reading a
 * dimension.
 *
 * ⚠ **A prop's size IS its whole function, so a prop drawn at the wrong size
 * is worse than no prop at all** — it tells a client the wrong thing about the
 * building, confidently. So each prop here states its overall size, and
 * `scaleProps.test.ts` ASSEMBLES its parts and measures the bounding box
 * against that statement. A constant named `FIGURE_HEIGHT_IN = 72` proves
 * nothing; a figure whose legs, torso and head really do stack to 72in does.
 *
 * ⚠ **None of this is a part.** Props are scenery: they never enter a takeoff,
 * a price, a weight, a fabrication sheet or an export. The OBJ and COLLADA
 * exports are built from `buildExportPanels()` — a data path, not a walk of
 * the three.js scene — so there is no route by which a human figure can arrive
 * in a cut list. Nothing in this file imports from the panel catalog, and
 * nothing in the catalog imports from here.
 *
 * ⚠ **Which numbers are his and which are mine.** The figure is **6'-0"
 * exactly** — his number, and the one a client reads the wall against. The car
 * is a mid-size sedan at typical published dimensions. The tree has no
 * standard size at all and its 22ft is a stated nominal, not a measurement.
 * See `SCALE_PROP_PROVENANCE` below, which the 3D Layers note prints verbatim
 * so the screen says the same thing this file does.
 */

/** A prop part's shape, in inches. */
export type ScalePropShape =
  | { kind: "box"; sizeIn: [number, number, number] }
  /** `axis` is the cylinder's own length direction in the prop's local frame
   * — a wheel's axle runs across the car, a trunk's runs up. */
  | { kind: "cylinder"; radiusIn: number; lengthIn: number; axis: "x" | "y" | "z" }
  | { kind: "sphere"; radiusIn: number };

export interface ScalePropPart {
  /** The part's CENTRE, inches, in the prop's own local frame: origin on the
   * ground at the prop's footprint centre, +Y up. */
  centerIn: [number, number, number];
  shape: ScalePropShape;
  color: string;
}

export type ScalePropId = "figure" | "car" | "tree";

export interface ScaleProp {
  id: ScalePropId;
  name: string;
  /**
   * What this prop CLAIMS to be, inches: `[x, y, z]` overall extent, with Y
   * the height above ground. Measured against the assembled parts by
   * `scaleProps.test.ts` — see this file's own header.
   */
  extentIn: [number, number, number];
  /** Drawn floating above the prop, if any. Only the figure has one: it is
   * the reference, and labelling all three turns a scale cue into clutter. */
  label?: string;
  parts: ScalePropPart[];
}

/**
 * ⚠ **Props are grey on purpose.** Every panel colour in this app is a warm
 * or saturated hue (`PANEL_TYPE_COLORS`, `DECK_PANEL_COLORS`,
 * `ASSEMBLY_COLORS`), and lumber renders tan. A prop in that family would read
 * as a member or a panel type at a glance, which is the one thing scenery must
 * never do. So the figure and the car are desaturated cool greys — the
 * convention of a physical architectural model — and the only colour in the
 * set is the foliage, because a grey tree reads as a rock.
 */
const PROP_COLORS = {
  figure: "#6f7478",
  carBody: "#7a848c",
  carCabin: "#5b6369",
  carWheel: "#36393c",
  treeTrunk: "#7d7570",
  treeFoliage: "#7f9a72",
} as const;

/**
 * **A 6'-0" person, standing.** 72in exactly, his number.
 *
 * Proportioned rather than stylised: hip height 38in is 53% of stature (a real
 * adult's is 48–52%), the head is 9in — an eighth of the height, the drawing
 * canon, against a real ~1/7.5 — and the body is 9in front to back. It is a
 * peg figure and reads as one at building scale; what matters is that the top
 * of its head is at six feet.
 */
const FIGURE: ScaleProp = {
  id: "figure",
  name: "Person",
  extentIn: [23, 72, 9],
  label: "6'-0\"",
  parts: [
    /* ⚠ Legs 7in across, not the 5in an anatomical drawing would want.
       Measured in the browser 2026-11-07: at the opening camera angle on a
       24ft building a 5in leg is under a pixel wide, so the legs disappeared
       and the figure read as a floating torso — which makes it look HALF its
       height, the one mistake a scale prop must not make. A trousered thigh is
       about this wide anyway. */
    { centerIn: [-4.25, 19, 0], shape: { kind: "box", sizeIn: [7, 38, 7] }, color: PROP_COLORS.figure },
    { centerIn: [4.25, 19, 0], shape: { kind: "box", sizeIn: [7, 38, 7] }, color: PROP_COLORS.figure },
    // Torso: hip (38) to shoulder (63).
    { centerIn: [0, 50.5, 0], shape: { kind: "box", sizeIn: [15, 25, 8] }, color: PROP_COLORS.figure },
    // Arms, hanging at the sides — these set the 23in overall width.
    { centerIn: [-9.25, 50, 0], shape: { kind: "box", sizeIn: [4.5, 24, 4.5] }, color: PROP_COLORS.figure },
    { centerIn: [9.25, 50, 0], shape: { kind: "box", sizeIn: [4.5, 24, 4.5] }, color: PROP_COLORS.figure },
    // Head: shoulder (63) to the top of the claim (72).
    { centerIn: [0, 67.5, 0], shape: { kind: "sphere", radiusIn: 4.5 }, color: PROP_COLORS.figure },
  ],
};

/**
 * **A mid-size sedan**, long axis along local X: **192 x 72 x 57in**
 * (16'-0" x 6'-0" x 4'-9"), on a 111in wheelbase.
 *
 * ⚠ Typical published dimensions for the class rather than one measured
 * vehicle — a 2025 Camry is 192.1 x 72.4 x 56.9in, an Accord 195.7 x 73.3 x
 * 57.1in, a Model 3 185.8 x 72.8 x 56.8in. Rounded to the nearest inch, any of
 * the three is this box within about 4in, which is far inside what a scale cue
 * needs to be right about. Nothing is cut from it.
 */
const CAR: ScaleProp = {
  id: "car",
  name: "Car",
  extentIn: [192, 57, 72],
  parts: [
    // Body: 6in ground clearance up to 40in.
    { centerIn: [0, 23, 0], shape: { kind: "box", sizeIn: [192, 34, 72] }, color: PROP_COLORS.carBody },
    // Cabin: 40in to the 57in overall, set back towards the rear.
    { centerIn: [-6, 48.5, 0], shape: { kind: "box", sizeIn: [90, 17, 65] }, color: PROP_COLORS.carCabin },
    // Four wheels, 26in diameter, axles across the car on Z. 111in wheelbase.
    ...([-55.5, 55.5] as const).flatMap((x) =>
      ([-31.5, 31.5] as const).map((z) => ({
        centerIn: [x, 13, z] as [number, number, number],
        shape: { kind: "cylinder" as const, radiusIn: 13, lengthIn: 7, axis: "z" as const },
        color: PROP_COLORS.carWheel,
      })),
    ),
  ],
};

/**
 * **A tree**, nominally **16ft tall with a 10ft spread** on a 7ft trunk.
 *
 * ⚠ **This number is not a measurement of anything and does not pretend to
 * be.** A tree has no standard size: a mature maple is anywhere from 30 to 70ft
 * and a young one is 10. 16ft is chosen as a young shade tree — big enough to
 * read as a real tree beside a one-storey building, small enough that it does
 * not swallow a 16ft octagon or drag the camera halfway across the county to
 * keep it in frame. The note on screen says so. The figure is the scale
 * reference; this is scenery with a stated height.
 */
const TREE: ScaleProp = {
  id: "tree",
  name: "Tree",
  extentIn: [120, 192, 120],
  parts: [
    { centerIn: [0, 42, 0], shape: { kind: "cylinder", radiusIn: 5, lengthIn: 84, axis: "y" }, color: PROP_COLORS.treeTrunk },
    // Canopy: one sphere sets the 10ft spread and the 16ft top; two smaller
    // lobes inside it keep the silhouette from reading as a perfect ball.
    { centerIn: [0, 132, 0], shape: { kind: "sphere", radiusIn: 60 }, color: PROP_COLORS.treeFoliage },
    { centerIn: [-21, 110, 13], shape: { kind: "sphere", radiusIn: 38 }, color: PROP_COLORS.treeFoliage },
    { centerIn: [24, 118, -17], shape: { kind: "sphere", radiusIn: 34 }, color: PROP_COLORS.treeFoliage },
  ],
};

export const SCALE_PROPS: ScaleProp[] = [FIGURE, CAR, TREE];

/** What the 3D Layers note prints, so the screen cannot say something milder
 * than this file does. Kept here rather than in `page.tsx` for exactly that
 * reason. */
export const SCALE_PROP_PROVENANCE =
  "The person is 6'-0\" exactly — Tommy's number, and the one to read a wall against. " +
  "The car is a mid-size sedan at typical published dimensions for the class (16'-0\" long, 4'-9\" tall), " +
  "not a measured vehicle. The tree is scenery at a stated nominal 16'-0\" tall and 10'-0\" across: " +
  "a tree has no standard size, so that figure is chosen, not measured. " +
  "None of the three is a part — no prop enters a takeoff, a price, a weight, a sheet or an export.";

/** The footprint's plan bounding box, feet, in the 3D view's own world frame
 * (X = plan x, Z = plan y, and north is -Z). */
export interface PlanBoundsFt {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ScalePropPlacement {
  prop: ScaleProp;
  /** World position of the prop's own local origin, FEET — on the ground. */
  positionFt: [number, number, number];
  /** Rotation about Y, radians. */
  rotationY: number;
}

/**
 * ⚠ **The standoffs are real distances in feet and do NOT scale with the
 * building.** A person stands about four feet off a wall whether the wall is
 * 16ft long or 55ft, and a car parks five feet off the gable end either way.
 * Scaling them to the footprint would make the props keep the same share of
 * the screen at every size — which is precisely the information a scale
 * reference exists to destroy. On a big building the figure SHOULD look small.
 *
 * ⚠ **They go on the south and east faces**, because `BIRDS_EYE_AZIMUTH_DEG`
 * opens the camera at +X/+Z and north is -Z: the SE corner is the one facing
 * the viewer when the view opens, so the props are in the foreground instead
 * of behind the building. Positioned off the plan BOUNDING BOX rather than off
 * a wall, so an octagon or a courtyard ring puts them outside the building
 * too, without this function having to know the shape.
 */
export function scalePropPlacements(bounds: PlanBoundsFt): ScalePropPlacement[] {
  return [
    {
      // Standing off the south face, 4ft out, 6ft in from the SE corner — close
      // enough to the wall to read the wall's height against.
      prop: FIGURE,
      positionFt: [bounds.maxX - 6, 0, bounds.maxZ + 4],
      rotationY: 0,
    },
    {
      // Parked off the east face with 5ft of clear ground between car and wall,
      // turned a quarter so its 16ft length runs north-south along that face.
      prop: CAR,
      positionFt: [bounds.maxX + 8, 0, bounds.maxZ - 8],
      rotationY: Math.PI / 2,
    },
    {
      /* ⚠ Off the south face too, but 22ft WEST of the figure rather than out
         past the SE corner on the diagonal — measured in the browser
         2026-11-07, where the diagonal stacked all three props along the
         camera's own sight line and the tree stood in front of the person.
         Spreading them across two faces spreads them across the frame.
         12ft out, so a canopy that starts 7ft up clears the south wall
         instead of hanging over it. */
      prop: TREE,
      positionFt: [bounds.maxX - 22, 0, bounds.maxZ + 12],
      rotationY: 0,
    },
  ];
}

/**
 * ⚠ **The ground the props stand on, unioned with the building's own box.**
 *
 * Without this the camera frames the BUILDING, and turning props on puts half
 * a car past the right-hand edge of the canvas — measured in the browser,
 * 2026-11-07, on the 24 x 16 Tiny House. A scale reference you cannot see is
 * not a scale reference.
 *
 * It is computed from `scalePropPlacements` and the props' own `extentIn`, so
 * the camera cannot be pulled back to frame props that are somewhere else. A
 * prop rotated a quarter turn swaps its X and Z extents, which is the only
 * rotation any placement uses and the only one handled here.
 *
 * ⚠ The camera's TARGET does not move — the building stays the subject, and
 * the extra room opens up on the side the props are on. On a big building this
 * is barely a change (the Cindy grows 55ft to 66ft); on a small one it is a
 * real pull-back, which is correct, because a 16ft car beside a 16ft octagon
 * really is half the scene.
 */
export function scalePropsPlanBounds(bounds: PlanBoundsFt): PlanBoundsFt {
  const out = { ...bounds };
  for (const { prop, positionFt, rotationY } of scalePropPlacements(bounds)) {
    const quarterTurn = Math.abs(Math.abs(rotationY) - Math.PI / 2) < 1e-9;
    const halfXIn = (quarterTurn ? prop.extentIn[2] : prop.extentIn[0]) / 2;
    const halfZIn = (quarterTurn ? prop.extentIn[0] : prop.extentIn[2]) / 2;
    out.minX = Math.min(out.minX, positionFt[0] - halfXIn / 12);
    out.maxX = Math.max(out.maxX, positionFt[0] + halfXIn / 12);
    out.minZ = Math.min(out.minZ, positionFt[2] - halfZIn / 12);
    out.maxZ = Math.max(out.maxZ, positionFt[2] + halfZIn / 12);
  }
  return out;
}

/** What a part is actually DRAWN as: a three.js primitive in FEET, which is
 * the unit every panel in `Building3DView` is placed and sized in.
 *
 * ⚠ **This exists so the drawn numbers are testable, not just the stated
 * ones.** `scaleProps.test.ts` measures an assembled prop twice — once from
 * the inches above, and once from what comes out of here — because a figure
 * that is 72in in this file and half that on screen is exactly the failure
 * this whole feature cannot survive, and it is a failure you cannot see: a
 * person drawn at 3ft beside a building just makes the building look twice as
 * big, and nothing on screen contradicts it.
 */
export interface DrawnPart {
  positionFt: [number, number, number];
  /** Euler angles, radians. `cylinderGeometry` stands on Y, so an axle across
   * a car is that same cylinder turned a quarter. */
  rotation: [number, number, number];
  geometry:
    | { kind: "box"; sizeFt: [number, number, number] }
    | { kind: "sphere"; radiusFt: number }
    | { kind: "cylinder"; radiusFt: number; lengthFt: number };
  color: string;
}

export function drawnPart(part: ScalePropPart): DrawnPart {
  const positionFt: [number, number, number] = [part.centerIn[0] / 12, part.centerIn[1] / 12, part.centerIn[2] / 12];
  if (part.shape.kind === "box") {
    return {
      positionFt,
      rotation: [0, 0, 0],
      geometry: { kind: "box", sizeFt: [part.shape.sizeIn[0] / 12, part.shape.sizeIn[1] / 12, part.shape.sizeIn[2] / 12] },
      color: part.color,
    };
  }
  if (part.shape.kind === "sphere") {
    return { positionFt, rotation: [0, 0, 0], geometry: { kind: "sphere", radiusFt: part.shape.radiusIn / 12 }, color: part.color };
  }
  const rotation: [number, number, number] =
    part.shape.axis === "y" ? [0, 0, 0] : part.shape.axis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2];
  return {
    positionFt,
    rotation,
    geometry: { kind: "cylinder", radiusFt: part.shape.radiusIn / 12, lengthFt: part.shape.lengthIn / 12 },
    color: part.color,
  };
}
