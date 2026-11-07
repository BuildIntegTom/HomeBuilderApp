import { describe, expect, it } from "vitest";
import { ASSEMBLY_COLORS, DECK_PANEL_COLORS, PANEL_TYPE_COLORS } from "./panelColors";
import {
  drawnPart,
  SCALE_PROPS,
  SCALE_PROP_PROVENANCE,
  scalePropPlacements,
  scalePropsPlanBounds,
  type PlanBoundsFt,
  type ScaleProp,
  type ScalePropPart,
} from "./scaleProps";

const IN_PER_FT = 12;

/** Half-extent of one part along each local axis, inches. */
function halfExtentIn(part: ScalePropPart): [number, number, number] {
  const s = part.shape;
  if (s.kind === "box") return [s.sizeIn[0] / 2, s.sizeIn[1] / 2, s.sizeIn[2] / 2];
  if (s.kind === "sphere") return [s.radiusIn, s.radiusIn, s.radiusIn];
  const half = s.lengthIn / 2;
  return s.axis === "x" ? [half, s.radiusIn, s.radiusIn] : s.axis === "y" ? [s.radiusIn, half, s.radiusIn] : [s.radiusIn, s.radiusIn, half];
}

interface Box3 {
  min: [number, number, number];
  max: [number, number, number];
}

/** The box the prop's PARTS actually fill, inches, in its own local frame. */
function assembledBoxIn(prop: ScaleProp): Box3 {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const part of prop.parts) {
    const half = halfExtentIn(part);
    for (let a = 0; a < 3; a += 1) {
      min[a] = Math.min(min[a]!, part.centerIn[a]! - half[a]!);
      max[a] = Math.max(max[a]!, part.centerIn[a]! + half[a]!);
    }
  }
  return { min, max };
}

/** The prop's own box put in the world, feet — local inches, rotated about Y
 * by a right angle or not at all, then translated. */
function placedBoxFt(prop: ScaleProp, positionFt: [number, number, number], rotationY: number): Box3 {
  const local = assembledBoxIn(prop);
  const quarterTurn = Math.abs(Math.abs(rotationY) - Math.PI / 2) < 1e-9;
  const xs = [local.min[0] / IN_PER_FT, local.max[0] / IN_PER_FT];
  const zs = [local.min[2] / IN_PER_FT, local.max[2] / IN_PER_FT];
  // Rotating +90deg about Y maps local (x, z) to world (z, -x).
  const worldX = quarterTurn ? zs : xs;
  const worldZ = quarterTurn ? xs.map((v) => -v).sort((a, b) => a - b) : zs;
  return {
    min: [positionFt[0] + worldX[0]!, positionFt[1] + local.min[1] / IN_PER_FT, positionFt[2] + worldZ[0]!],
    max: [positionFt[0] + worldX[1]!, positionFt[1] + local.max[1] / IN_PER_FT, positionFt[2] + worldZ[1]!],
  };
}

/** Two boxes are clear of each other if ANY axis separates them. */
function separated(a: Box3, b: Box3): boolean {
  for (let i = 0; i < 3; i += 1) {
    if (a.max[i]! <= b.min[i]! || b.max[i]! <= a.min[i]!) return true;
  }
  return false;
}

/** Every building the starter templates make, plus a deliberately tiny one. */
const SAMPLE_BUILDINGS: { name: string; bounds: PlanBoundsFt }[] = [
  { name: "Tiny House 24x16", bounds: { minX: 0, maxX: 24, minZ: 0, maxZ: 16 } },
  { name: "The Tank 48x24", bounds: { minX: 0, maxX: 48, minZ: 0, maxZ: 24 } },
  { name: "Octagon 16ft", bounds: { minX: 0, maxX: 16, minZ: 0, maxZ: 16 } },
  { name: "Octagon 32ft", bounds: { minX: 0, maxX: 32, minZ: 0, maxZ: 32 } },
  { name: "The Cindy 55.25x34.83", bounds: { minX: 0, maxX: 55.25, minZ: 0, maxZ: 34 + 10 / 12 } },
  { name: "Square courtyard 40x40", bounds: { minX: 0, maxX: 40, minZ: 0, maxZ: 40 } },
  // Not drawn from a template — a footprint away from the origin, because the
  // placements are offsets off the bounding box and must not assume it starts
  // at 0,0 (the plan's own origin moves with where you drag).
  { name: "offset 20x20 at (-80,45)", bounds: { minX: -80, maxX: -60, minZ: 45, maxZ: 65 } },
];

describe("⚠ a prop's drawn size equals the size it claims", () => {
  /* This is the whole point of the file. A prop exists to tell a client how
     big the building is; a prop drawn at the wrong size tells them something
     false, confidently, and nothing else on screen contradicts it. So the
     parts are assembled and measured, not trusted. */
  it.each(SCALE_PROPS)("$name: its parts fill exactly its stated extent", (prop) => {
    const box = assembledBoxIn(prop);
    expect([box.max[0]! - box.min[0]!, box.max[1]! - box.min[1]!, box.max[2]! - box.min[2]!]).toEqual(prop.extentIn);
  });

  it("⚠ and the DRAWN prop, in feet, is the same size as the stated one", () => {
    /* The second half of the claim, and the half that can fail silently. The
       parts above are inches; what reaches three.js is `drawnPart`, in the
       feet every panel in `Building3DView` is placed in. A figure that is 72in
       here and half that on screen just makes the building look twice as big,
       and nothing on screen contradicts it. */
    for (const prop of SCALE_PROPS) {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const part of prop.parts) {
        const d = drawnPart(part);
        const g = d.geometry;
        // Half-extent in the part's OWN axes, then swapped for the quarter
        // turn a cylinder's rotation applies.
        let half: [number, number, number];
        if (g.kind === "box") half = [g.sizeFt[0] / 2, g.sizeFt[1] / 2, g.sizeFt[2] / 2];
        else if (g.kind === "sphere") half = [g.radiusFt, g.radiusFt, g.radiusFt];
        else {
          const h = g.lengthFt / 2;
          half = d.rotation[0] !== 0 ? [g.radiusFt, g.radiusFt, h] : d.rotation[2] !== 0 ? [h, g.radiusFt, g.radiusFt] : [g.radiusFt, h, g.radiusFt];
        }
        for (let a = 0; a < 3; a += 1) {
          min[a] = Math.min(min[a]!, d.positionFt[a]! - half[a]!);
          max[a] = Math.max(max[a]!, d.positionFt[a]! + half[a]!);
        }
      }
      for (let a = 0; a < 3; a += 1) {
        expect(max[a]! - min[a]!, `${prop.name} axis ${a}`).toBeCloseTo(prop.extentIn[a]! / IN_PER_FT, 9);
      }
      expect(min[1], `${prop.name} does not stand on the ground once drawn`).toBeCloseTo(0, 9);
    }
  });

  it("the person is 72in — six feet exactly, his number", () => {
    const figure = SCALE_PROPS.find((p) => p.id === "figure")!;
    expect(assembledBoxIn(figure).max[1]).toBe(6 * IN_PER_FT);
    expect(figure.label).toBe("6'-0\"");
  });

  it("the car is 16ft long, 6ft wide and 4ft 9in tall, on a 111in wheelbase", () => {
    const car = SCALE_PROPS.find((p) => p.id === "car")!;
    expect(car.extentIn).toEqual([16 * IN_PER_FT, 57, 6 * IN_PER_FT]);
    const wheelXs = car.parts
      .filter((p) => p.shape.kind === "cylinder")
      .map((p) => p.centerIn[0]!)
      .sort((a, b) => a - b);
    expect(wheelXs[wheelXs.length - 1]! - wheelXs[0]!).toBe(111);
  });

  it("the tree is 16ft tall and 10ft across — a stated nominal, and it says so", () => {
    const tree = SCALE_PROPS.find((p) => p.id === "tree")!;
    expect(tree.extentIn).toEqual([10 * IN_PER_FT, 16 * IN_PER_FT, 10 * IN_PER_FT]);
    expect(SCALE_PROP_PROVENANCE).toContain("has no standard size");
  });

  it("⚠ no limb is thinner than an inch and a half once drawn", () => {
    /* Measured in the browser 2026-11-07: at the opening camera angle on a
       24ft building a 5in leg came out under a pixel wide, the legs vanished,
       and the figure read as a floating torso — i.e. as a person half his own
       height, which is the one mistake this feature cannot make. */
    for (const prop of SCALE_PROPS) {
      for (const part of prop.parts) {
        if (part.shape.kind !== "box") continue;
        expect(Math.min(part.shape.sizeIn[0], part.shape.sizeIn[2]), `${prop.name} has a hairline part`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("every prop stands ON the ground — nothing floats and nothing sinks", () => {
    for (const prop of SCALE_PROPS) expect(assembledBoxIn(prop).min[1]).toBe(0);
  });

  it("⚠ only the person is labelled — three labels is clutter, not a scale cue", () => {
    expect(SCALE_PROPS.filter((p) => p.label !== undefined).map((p) => p.id)).toEqual(["figure"]);
  });
});

describe("⚠ props stand outside the building, and clear of each other", () => {
  it.each(SAMPLE_BUILDINGS)("$name: no prop stands in the building", ({ bounds }) => {
    const buildingBox: Box3 = { min: [bounds.minX, 0, bounds.minZ], max: [bounds.maxX, 1e4, bounds.maxZ] };
    for (const { prop, positionFt, rotationY } of scalePropPlacements(bounds)) {
      expect(separated(placedBoxFt(prop, positionFt, rotationY), buildingBox), `${prop.name} overlaps the footprint`).toBe(true);
    }
  });

  it.each(SAMPLE_BUILDINGS)("$name: no two props overlap", ({ bounds }) => {
    const placed = scalePropPlacements(bounds).map((p) => ({ name: p.prop.name, box: placedBoxFt(p.prop, p.positionFt, p.rotationY) }));
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(separated(placed[i]!.box, placed[j]!.box), `${placed[i]!.name} overlaps ${placed[j]!.name}`).toBe(true);
      }
    }
  });

  it.each(SAMPLE_BUILDINGS)("$name: they are on the SOUTH and EAST sides, where the view opens", ({ bounds }) => {
    /* The bird's-eye camera opens at +X/+Z and north is -Z, so the SE corner
       faces the viewer. A prop behind the building is a prop nobody sees. */
    for (const { prop, positionFt, rotationY } of scalePropPlacements(bounds)) {
      const box = placedBoxFt(prop, positionFt, rotationY);
      expect(box.max[0]! > bounds.maxX || box.max[2]! > bounds.maxZ, `${prop.name} is not to the south or east`).toBe(true);
      expect(box.min[2]!, `${prop.name} stands north of the building, where it would be hidden`).toBeGreaterThan(bounds.minZ - 3);
    }
  });

  it("⚠ the standoffs are REAL distances and do not scale with the building", () => {
    /* Scaling them would hold every prop at the same share of the screen at
       every building size, which is exactly the information a scale reference
       exists to destroy. The same person stands the same 4ft off the wall on a
       16ft shed and on a 55ft ranch. */
    const small = scalePropPlacements({ minX: 0, maxX: 16, minZ: 0, maxZ: 16 });
    const large = scalePropPlacements({ minX: 0, maxX: 56, minZ: 0, maxZ: 36 });
    for (let i = 0; i < small.length; i += 1) {
      expect(small[i]!.positionFt[0]! - 16).toBeCloseTo(large[i]!.positionFt[0]! - 56, 9);
      expect(small[i]!.positionFt[2]! - 16).toBeCloseTo(large[i]!.positionFt[2]! - 36, 9);
    }
  });
});

describe("⚠ a prop can never be mistaken for a part", () => {
  it("no prop colour is any panel, deck or assembly colour", () => {
    /* Every panel colour in this app is warm or saturated and lumber renders
       tan. Props are desaturated greys for that reason, and this is the test
       that keeps it true when somebody adds a panel type. */
    const partColours = new Set(SCALE_PROPS.flatMap((p) => p.parts.map((part) => part.color.toLowerCase())));
    const buildingColours = [
      ...Object.values(PANEL_TYPE_COLORS),
      ...Object.values(DECK_PANEL_COLORS),
      ...Object.values(ASSEMBLY_COLORS),
    ].map((c) => c.toLowerCase());
    for (const colour of buildingColours) expect(partColours.has(colour)).toBe(false);
  });

  it("the provenance note says plainly that a prop is not a part", () => {
    expect(SCALE_PROP_PROVENANCE).toContain("None of the three is a part");
  });
});

describe("⚠ turning props on pulls the camera back far enough to SEE them", () => {
  /* Measured in the browser on 2026-11-07, before this existed: on the 24 x 16
     Tiny House the camera framed the building and the car was drawn half past
     the right-hand edge of the canvas. A scale reference you cannot see is not
     a scale reference. */
  it.each(SAMPLE_BUILDINGS)("$name: the widened box contains every prop whole", ({ bounds }) => {
    const widened = scalePropsPlanBounds(bounds);
    for (const { prop, positionFt, rotationY } of scalePropPlacements(bounds)) {
      const box = placedBoxFt(prop, positionFt, rotationY);
      expect(box.min[0]).toBeGreaterThanOrEqual(widened.minX - 1e-9);
      expect(box.max[0]).toBeLessThanOrEqual(widened.maxX + 1e-9);
      expect(box.min[2]).toBeGreaterThanOrEqual(widened.minZ - 1e-9);
      expect(box.max[2]).toBeLessThanOrEqual(widened.maxZ + 1e-9);
    }
  });

  it.each(SAMPLE_BUILDINGS)("$name: and it still contains the building", ({ bounds }) => {
    const widened = scalePropsPlanBounds(bounds);
    expect(widened.minX).toBeLessThanOrEqual(bounds.minX);
    expect(widened.maxX).toBeGreaterThanOrEqual(bounds.maxX);
    expect(widened.minZ).toBeLessThanOrEqual(bounds.minZ);
    expect(widened.maxZ).toBeGreaterThanOrEqual(bounds.maxZ);
  });

  it("⚠ it never grows NORTH — nothing stands behind the building", () => {
    /* North is -Z and the camera opens facing south-east, so a prop up there
       would be hidden by the building it is meant to measure. It does grow
       west, because the tree stands west of the person. */
    const bounds = { minX: 0, maxX: 24, minZ: 0, maxZ: 16 };
    const widened = scalePropsPlanBounds(bounds);
    expect(widened.minZ).toBe(0);
    expect(widened.maxX).toBeGreaterThan(24);
    expect(widened.maxZ).toBeGreaterThan(16);
  });

  it("⚠ costs a big building almost nothing and a small one a real pull-back", () => {
    /* The point of measuring it rather than picking a multiplier: a 16ft car
       beside a 16ft octagon really IS half the scene, and the camera should
       say so. The Cindy barely moves. */
    const span = (b: PlanBoundsFt) => Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
    const cindy = { minX: 0, maxX: 55.25, minZ: 0, maxZ: 34 + 10 / 12 };
    const octagon = { minX: 0, maxX: 16, minZ: 0, maxZ: 16 };
    expect(span(scalePropsPlanBounds(cindy)) / span(cindy)).toBeLessThan(1.3);
    expect(span(scalePropsPlanBounds(octagon)) / span(octagon)).toBeGreaterThan(1.5);
  });
});
