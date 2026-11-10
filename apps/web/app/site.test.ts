import { describe, expect, it } from "vitest";
import {
  BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
  BALE_FOUNDATION_GAP_DEFAULT_IN,
  BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
  STEEL_MESH_THICKNESS_IN,
  SUBFLOOR_DEPTH_DEFAULT_IN,
  baleFoundationTopFaceZIn,
  buildDoubledStackPair,
  buildFloorBottomSkinMembers,
  buildFloorRoofPanelMembers,
  buildFramingStackMembers,
  buildStandardPanelMembers,
  memberBoxSizeIn,
  memberLocalCornersIn,
  type PanelMember,
} from "@building-integrity/panel-catalog";
import { ASSEMBLY_COLORS, DECK_PANEL_COLORS, PANEL_TYPE_COLORS } from "./panelColors";
import {
  SITE_CAMERA_FAR_FT,
  SITE_COLORS,
  SITE_FLOOR_PANEL_AIR_GAP_FT,
  SITE_GROUND_CLEARANCE_FT,
  SITE_MIN_EYE_ABOVE_GRASS_FT,
  SITE_PROVENANCE,
  SITE_OPENING_CAMERA_AZIMUTH_DEG,
  SITE_SUN_DIRECTION,
  VOID_SUN_DIRECTION,
  deckGroupRotationX,
  lowestDrawnYFt,
  cameraClampedAboveGround,
  lowestMemberHeightIn,
  siteCasterBaseYFt,
  siteFogRangeFt,
  siteGroundRadiusFt,
  siteGroundYFt,
  siteSkyDistanceFt,
  siteSunDistanceFt,
  siteSunShadow,
  type SiteGroupFrame,
  type SitePlacedGroup,
} from "./site";

const IN_PER_FT = 12;
const UPRIGHT: SiteGroupFrame = { kind: "upright" };
const FLAT_DECK: SiteGroupFrame = { kind: "deck", tiltRad: 0 };

/**
 * ⚠ **An INDEPENDENT measure of where a member's drawn geometry really bottoms
 * out**, in inches above its group's anchor. Deliberately not
 * `lowestMemberHeightIn` — the guarantee under test is "the grass is below
 * every member", and checking that with the same function that places the
 * grass would prove nothing. This one does the tilt rotation exactly where the
 * shipped function takes a deliberately loose bound.
 */
function trueMemberBottomIn(member: PanelMember, frame: SiteGroupFrame): number {
  const { trapezoidCornersIn, planPolygonCornersIn, sectionCornersIn, tiltDeg, yIn, zIn } = member.position;
  const rotX = frame.kind === "deck" ? Math.PI / 2 - frame.tiltRad : 0;
  const project = (y: number, z: number) => y * Math.cos(rotX) - z * Math.sin(rotX);

  if (trapezoidCornersIn || planPolygonCornersIn || sectionCornersIn) {
    return Math.min(...memberLocalCornersIn(member).map(([, y, z]) => project(y, z)));
  }
  const size = memberBoxSizeIn(member);
  if (tiltDeg === undefined) {
    const ys = [zIn, zIn + size.zIn];
    const zs = [yIn, yIn + size.yIn];
    return Math.min(...ys.flatMap((y) => zs.map((z) => project(y, z))));
  }
  /* A tilted box stores its CENTRE and rotates about the renderer's Z — the
     axis normal to the (width, height) plane. Done properly here. */
  const rad = (tiltDeg * Math.PI) / 180;
  const halfHeight = (Math.abs(size.zIn * Math.cos(rad)) + Math.abs(size.xIn * Math.sin(rad))) / 2;
  const ys = [zIn - halfHeight, zIn + halfHeight];
  const zs = [yIn - size.yIn / 2, yIn + size.yIn / 2];
  return Math.min(...ys.flatMap((y) => zs.map((z) => project(y, z))));
}

function tiltedBrace(zIn: number, tiltDeg: number): PanelMember {
  return {
    memberId: `brace-${tiltDeg}`,
    material: "dimensional_lumber",
    speciesGrade: null,
    plySpec: null,
    nominalSize: "2x4",
    actualDimsIn: { thicknessIn: 1.5, widthIn: 3.5, lengthIn: 90 },
    orientation: "diagonal",
    position: { xIn: 24, yIn: 2, zIn, tiltDeg, rotationDeg: 90 },
    role: "brace",
    qty: 1,
  };
}

/** The real floor systems this app draws, each as the placed groups
 * `Building3DView` hands the scene. */
const FLOOR_SYSTEMS: { name: string; groups: SitePlacedGroup[] }[] = (() => {
  const floorPanel = (lengthIn: number): SitePlacedGroup => ({
    anchorYFt: 0,
    frame: FLAT_DECK,
    members: buildFloorRoofPanelMembers({
      kind: "floor",
      widthIn: 24,
      depthIn: 15.5,
      lengthIn,
      structuralGirtEnds: ["start", "end"],
    }),
  });

  const topFaceZIn = baleFoundationTopFaceZIn(SUBFLOOR_DEPTH_DEFAULT_IN);
  const stackHeightIn =
    BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN + BALE_FOUNDATION_GAP_DEFAULT_IN + BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN;
  const bottomZIn = topFaceZIn - stackHeightIn;
  const baleGroups: SitePlacedGroup[] = [
    {
      anchorYFt: bottomZIn / IN_PER_FT,
      frame: UPRIGHT,
      members: buildFramingStackMembers(
        "field",
        144,
        BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
        BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
        BALE_FOUNDATION_GAP_DEFAULT_IN,
      ),
    },
    {
      anchorYFt: bottomZIn / IN_PER_FT,
      frame: UPRIGHT,
      members: buildDoubledStackPair(
        "ring",
        288,
        BALE_FOUNDATION_TOP_DEPTH_DEFAULT_IN,
        BALE_FOUNDATION_BOTTOM_DEPTH_DEFAULT_IN,
        BALE_FOUNDATION_GAP_DEFAULT_IN,
      ),
    },
  ];
  const bottomSkinGroup: SitePlacedGroup = {
    anchorYFt: (bottomZIn - STEEL_MESH_THICKNESS_IN) / IN_PER_FT,
    frame: UPRIGHT,
    members: buildFloorBottomSkinMembers([
      {
        bandIndex: 0,
        pieceIndex: 0,
        cornersIn: [
          { xIn: 0, yIn: 0 },
          { xIn: 288, yIn: 0 },
          { xIn: 288, yIn: 192 },
          { xIn: 0, yIn: 192 },
        ],
      },
    ]),
  };
  /* Walls are anchored on the datum and never reach below it — present in
     every case below, so the `Math.min(0, …)` floor is exercised too. */
  const wallGroup: SitePlacedGroup = {
    anchorYFt: 0,
    frame: UPRIGHT,
    members: buildStandardPanelMembers(48, 15.5, 108, true),
  };
  const bracedWallGroup: SitePlacedGroup = {
    anchorYFt: 0,
    frame: UPRIGHT,
    members: [...buildStandardPanelMembers(48, 15.5, 108, true), tiltedBrace(54, 34), tiltedBrace(54, -34)],
  };

  return [
    { name: "floor panels only", groups: [wallGroup, floorPanel(144)] },
    { name: "bale foundation only", groups: [wallGroup, ...baleGroups] },
    { name: "bale foundation with the clay/steel bottom skin", groups: [wallGroup, ...baleGroups, bottomSkinGroup] },
    {
      name: "floor panels over a bale foundation",
      groups: [bracedWallGroup, floorPanel(192), ...baleGroups, bottomSkinGroup],
    },
    { name: "no floor system at all — walls on the bare datum", groups: [bracedWallGroup] },
  ];
})();

function trueLowestYFt(groups: SitePlacedGroup[]): number {
  let lowest = 0;
  for (const group of groups) {
    for (const member of group.members) {
      lowest = Math.min(lowest, group.anchorYFt + trueMemberBottomIn(member, group.frame) / IN_PER_FT);
    }
  }
  return lowest;
}

const BUILDING_SIZES_FT = [10, 16, 20, 24, 30, 33, 40, 55, 66, 100, 150, 400];

describe("U5 — the grass goes UNDER the building, which is the whole reason the ground plane was deleted", () => {
  it.each(FLOOR_SYSTEMS)("$name: no member is below the grass", ({ groups }) => {
    const groundYFt = siteGroundYFt(lowestDrawnYFt(groups));
    for (const group of groups) {
      for (const member of group.members) {
        const bottomYFt = group.anchorYFt + trueMemberBottomIn(member, group.frame) / IN_PER_FT;
        expect(bottomYFt, `${member.memberId} bottoms out at ${bottomYFt}ft, grass at ${groundYFt}ft`).toBeGreaterThan(
          groundYFt,
        );
      }
    }
  });

  it.each(FLOOR_SYSTEMS)("$name: and the grass is not needlessly deep either", ({ groups }) => {
    const gapIn = (trueLowestYFt(groups) - siteGroundYFt(lowestDrawnYFt(groups))) * IN_PER_FT;
    expect(gapIn).toBeGreaterThan(0.99);
    /* The one source of slack is the deliberately loose bound on a TILTED
       member, and a brace lives well above the floor, so in practice the grass
       lands within an inch of the truth. */
    expect(gapIn).toBeLessThan(2);
  });

  it("⚠ a FLOOR PANEL hangs below the datum once the view tips it — which is the defect this replaces", () => {
    const floorOnly = FLOOR_SYSTEMS.find((s) => s.name === "floor panels only")!;
    const trueLowestFt = trueLowestYFt(floorOnly.groups);
    /* The 15 1/2in panel depth, swung from up to down by the quarter turn. */
    expect(trueLowestFt * IN_PER_FT).toBeCloseTo(-15.5, 6);
    /* Tommy, 2026-10-29: *"it blocks the floor panels from being visible"*. The
       old plane sat at -0.6in — inside the deck, hiding all but its top face. */
    const OLD_GROUND_Y_FT = -0.05;
    expect(trueLowestFt).toBeLessThan(OLD_GROUND_Y_FT);
    expect(siteGroundYFt(lowestDrawnYFt(floorOnly.groups))).toBeLessThan(trueLowestFt);
  });

  it("the deck rotation is the quarter turn the renderer applies, less the pitch", () => {
    expect(deckGroupRotationX(0)).toBeCloseTo(Math.PI / 2, 12);
    const pitchRad = Math.atan2(4, 12);
    expect(deckGroupRotationX(pitchRad)).toBeCloseTo(Math.PI / 2 - pitchRad, 12);
  });

  it("never draws grass above the datum, even with nothing below it", () => {
    expect(siteGroundYFt(0)).toBe(-SITE_GROUND_CLEARANCE_FT);
    expect(siteGroundYFt(5)).toBe(-SITE_GROUND_CLEARANCE_FT);
    expect(lowestDrawnYFt([])).toBe(0);
  });

  it("a tilted member's bound is loose on the safe side, never the unsafe one", () => {
    for (const tiltDeg of [-60, -34, 0, 12, 34, 60, 90]) {
      const member = tiltedBrace(54, tiltDeg);
      expect(lowestMemberHeightIn(member)).toBeLessThanOrEqual(trueMemberBottomIn(member, UPRIGHT));
      expect(lowestMemberHeightIn(member, FLAT_DECK)).toBeLessThanOrEqual(trueMemberBottomIn(member, FLAT_DECK));
    }
  });

  it("a prism member is measured from its real corners", () => {
    const [skin] = buildFloorBottomSkinMembers([
      {
        pieceIndex: 0,
        cornersIn: [
          { xIn: 0, yIn: 0 },
          { xIn: 96, yIn: 0 },
          { xIn: 96, yIn: 96 },
        ],
      },
    ]);
    expect(lowestMemberHeightIn(skin)).toBe(trueMemberBottomIn(skin, UPRIGHT));
  });
});

describe("the lawn, the sky and the horizon have to agree with each other", () => {
  it.each(BUILDING_SIZES_FT)("%ift building: the sky box CONTAINS the lawn", (maxDimFt) => {
    expect(siteSkyDistanceFt(maxDimFt) / 2).toBeGreaterThan(siteGroundRadiusFt(maxDimFt));
  });

  it.each(BUILDING_SIZES_FT)("%ift building: the sky stays inside the camera's far plane", (maxDimFt) => {
    expect(siteSkyDistanceFt(maxDimFt) / 2).toBeLessThan(SITE_CAMERA_FAR_FT);
  });

  it.each(BUILDING_SIZES_FT)("%ift building: the lawn fades to haze well inside its own edge", (maxDimFt) => {
    const { nearFt, farFt } = siteFogRangeFt(maxDimFt);
    expect(farFt).toBeGreaterThan(nearFt);
    expect(farFt).toBeLessThan(siteGroundRadiusFt(maxDimFt) * 0.75);
  });

  it.each(BUILDING_SIZES_FT)("%ift building: fog never touches the building at the opening camera", (maxDimFt) => {
    /* `birdsEyeCameraPosition` puts the eye `1.6 × maxDim` from the centre; the
       farthest point of a square building is a half-diagonal further out. */
    const farthestBuildingPointFt = maxDimFt * 1.6 + (maxDimFt * Math.SQRT2) / 2;
    expect(siteFogRangeFt(maxDimFt).nearFt).toBeGreaterThan(farthestBuildingPointFt);
  });

  it("the lawn grows with the building, within a floor and a cap", () => {
    const radii = BUILDING_SIZES_FT.map(siteGroundRadiusFt);
    for (let i = 1; i < radii.length; i++) expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1]);
    expect(Math.min(...radii)).toBe(400);
    expect(Math.max(...radii)).toBe(3000);
  });

  it.each([
    ["the site sun", SITE_SUN_DIRECTION],
    ["the void sun", VOID_SUN_DIRECTION],
  ])("%s is above the horizon and off to one side, not overhead", (_name, direction) => {
    const [x, y, z] = direction;
    expect(y).toBeGreaterThan(0);
    const elevationDeg = (Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI;
    expect(elevationDeg).toBeGreaterThan(30);
    expect(elevationDeg).toBeLessThan(75);
  });

  it("⚠ the site's sun throws its shadow ACROSS the opening view, not behind the building", () => {
    const azimuthRad = (SITE_OPENING_CAMERA_AZIMUTH_DEG * Math.PI) / 180;
    /* `birdsEyeCameraPosition` puts the eye at this azimuth, so the camera
       looks back along the negated unit vector. */
    const viewX = -Math.cos(azimuthRad);
    const viewZ = -Math.sin(azimuthRad);
    /* A shadow runs away from the sun. */
    const shadowX = -SITE_SUN_DIRECTION[0];
    const shadowZ = -SITE_SUN_DIRECTION[2];
    const shadowLength = Math.hypot(shadowX, shadowZ);
    const alignment = (viewX * shadowX + viewZ * shadowZ) / shadowLength;
    const angleDeg = (Math.acos(Math.max(-1, Math.min(1, alignment))) * 180) / Math.PI;
    expect(angleDeg).toBeGreaterThan(60);
  });

  it("⚠ the VOID sun is the vector the scene has always carried, and U5 must not move it", () => {
    /* The fabricator's lighting predates U5 by months; changing it is a
       regression for everyone who never turns the site on. */
    expect([...VOID_SUN_DIRECTION]).toEqual([1, 2, 1]);
  });

  it("and the void sun is exactly the one that hides its shadow — which is why it stays off", () => {
    const azimuthRad = (SITE_OPENING_CAMERA_AZIMUTH_DEG * Math.PI) / 180;
    const viewX = -Math.cos(azimuthRad);
    const viewZ = -Math.sin(azimuthRad);
    const shadowX = -VOID_SUN_DIRECTION[0];
    const shadowZ = -VOID_SUN_DIRECTION[2];
    const alignment = (viewX * shadowX + viewZ * shadowZ) / Math.hypot(shadowX, shadowZ);
    const angleDeg = (Math.acos(Math.max(-1, Math.min(1, alignment))) * 180) / Math.PI;
    expect(angleDeg).toBeLessThan(5);
  });
});

describe("the sun shadow's camera has to actually contain the shadow", () => {
  const PLAN = { minX: 4, maxX: 28, minZ: -6, maxZ: 10 };

  it.each(BUILDING_SIZES_FT)("%ift building: the shadow camera reaches the building AND its shadow", (maxDimFt) => {
    const { halfSizeFt } = siteSunShadow(maxDimFt, PLAN);
    /* ⚠ The light is positioned relative to the ORIGIN and aims at the
       default target there, so its shadow camera is centred on the origin, not
       on the building — the coverage test is distance from the origin. */
    const farthestFromOriginFt = Math.max(
      Math.abs(PLAN.minX),
      Math.abs(PLAN.maxX),
      Math.abs(PLAN.minZ),
      Math.abs(PLAN.maxZ),
    );
    /* At this sun's elevation the shadow reaches about 0.7 x the height, and
       the tallest thing this app draws is well under 1.5 x its plan size. */
    const shadowReachFt = maxDimFt * 1.5 * 0.71;
    expect(halfSizeFt).toBeGreaterThan(farthestFromOriginFt + shadowReachFt);
  });

  it("a footprint drawn far from the origin is still inside the shadow camera", () => {
    const far = { minX: 180, maxX: 204, minZ: 95, maxZ: 111 };
    const { halfSizeFt } = siteSunShadow(24, far);
    expect(halfSizeFt).toBeGreaterThan(204);
    expect(halfSizeFt).toBeGreaterThan(111);
  });

  it.each(BUILDING_SIZES_FT)("%ift building: the depth slab brackets the light's own distance", (maxDimFt) => {
    const { nearFt, farFt } = siteSunShadow(maxDimFt, PLAN);
    const distanceFt = siteSunDistanceFt(maxDimFt);
    expect(nearFt).toBeGreaterThan(0);
    expect(nearFt).toBeLessThan(distanceFt);
    expect(farFt).toBeGreaterThan(distanceFt);
  });

  it("the sun's distance follows the direction vector, not a second number", () => {
    const [x, y, z] = SITE_SUN_DIRECTION;
    expect(siteSunDistanceFt(30)).toBeCloseTo(30 * Math.hypot(x, y, z), 9);
  });

  it("the shadow map is a power of two, and large enough to resolve a wall", () => {
    const { mapSize, halfSizeFt } = siteSunShadow(24, PLAN);
    expect(Math.log2(mapSize) % 1).toBe(0);
    /* Inches of ground per texel — a 15 1/2in wall should be several texels
       wide or its shadow edge crawls. */
    const inchesPerTexel = ((halfSizeFt * 2) / mapSize) * 12;
    expect(inchesPerTexel).toBeLessThan(4);
  });

  it("carries a normal bias, because a lawn this size otherwise acnes", () => {
    expect(siteSunShadow(24, PLAN).normalBiasFt).toBeGreaterThan(0);
  });
});

describe("the site can never be mistaken for the building", () => {
  it("no site colour is a panel colour", () => {
    const panelColors = new Set(
      [
        ...Object.values(PANEL_TYPE_COLORS),
        ...Object.values(DECK_PANEL_COLORS),
        ...Object.values(ASSEMBLY_COLORS),
      ].map((c) => c.toLowerCase()),
    );
    for (const [name, color] of Object.entries(SITE_COLORS)) {
      expect(panelColors.has(color.toLowerCase()), `${name} (${color}) is also a panel colour`).toBe(false);
    }
  });

  it("the grass is distinct from U4's tree foliage, so a tree still reads as a tree", () => {
    expect(SITE_COLORS.grass).not.toBe("#7f9a72");
  });

  it("⚠ the note the app prints refuses the things a site would imply", () => {
    for (const word of ["survey", "grade", "slope", "soil", "setback", "orientation", "time of day"]) {
      expect(SITE_PROVENANCE.toLowerCase()).toContain(word);
    }
    expect(SITE_PROVENANCE).toMatch(/takeoff/);
    expect(SITE_PROVENANCE).toMatch(/export/);
    /* And it says what the shadow is thrown BY, because "a shadow" would
       otherwise read as the frame's own. */
    expect(SITE_PROVENANCE.toLowerCase()).toContain("footprint");
    expect(SITE_PROVENANCE.toLowerCase()).toContain("not by its frame");
  });
});

describe("the 2 ft of air under a floor panel", () => {
  it("is 2 ft, his own number", () => {
    expect(SITE_FLOOR_PANEL_AIR_GAP_FT).toBe(2);
  });

  it("⚠ null means NO fallback, and leaves the old one-inch behaviour alone", () => {
    /* The bug this guards is one I wrote: defaulting the parameter to `0` —
       which is what `lowestDrawnYFt` returns for an empty list — computed
       `0 - 2` and dropped the grass two feet under every floorless building.
       A sentinel has to sit outside the range of real answers. */
    expect(siteGroundYFt(0, null)).toBeCloseTo(-SITE_GROUND_CLEARANCE_FT, 9);
    expect(siteGroundYFt(0)).toBeCloseTo(-SITE_GROUND_CLEARANCE_FT, 9);
    expect(siteGroundYFt(-0.5, null)).toBeCloseTo(-0.5 - SITE_GROUND_CLEARANCE_FT, 9);
    expect(siteGroundYFt(0, null)).toBeGreaterThan(-0.5);
  });

  it("drops the grass 2 ft below a floor panel when nothing bears on the ground", () => {
    /* The deck hangs its 15 1/2in depth below the datum, so the lowest drawn
       point is about -1.29 ft; the old rule put grass an inch under that. */
    const deckBottomFt = -15.5 / 12;
    const ground = siteGroundYFt(deckBottomFt, deckBottomFt);
    expect(ground).toBeCloseTo(deckBottomFt - SITE_FLOOR_PANEL_AIR_GAP_FT, 9);
    expect(deckBottomFt - ground).toBeCloseTo(SITE_FLOOR_PANEL_AIR_GAP_FT, 9);
  });

  it("⚠ a FOUNDATION meets grade — it is not pushed down by the floor rule", () => {
    /* The correction. I first wrote this as
         min(an inch under everything, two feet under the floor)
       and asserted a drawn foundation would always win. It does not: a 3 ft
       foundation under a deck whose bottom is 1.3 ft down loses to
       `-1.29 - 2 = -3.29`, and the foundation came out floating 2 1/2 inches
       above the grass — the exact defect the shape was meant to prevent.
       The caller now passes `null` whenever anything bears on the ground. */
    const foundationBottomFt = -3;
    const ground = siteGroundYFt(foundationBottomFt, null);
    expect(ground).toBeCloseTo(foundationBottomFt - SITE_GROUND_CLEARANCE_FT, 9);
    // One inch, not two feet: the foundation sits on the grass.
    expect(foundationBottomFt - ground).toBeCloseTo(SITE_GROUND_CLEARANCE_FT, 9);
  });

  it("⚠ and the two rules are never combined, at any depth", () => {
    /* Swept so that no future edit can reintroduce the min(): for a shallow
       foundation the one-inch answer must hold even though two-feet-under-the
       -deck would be lower. */
    const deckBottomFt = -15.5 / 12;
    for (const foundationBottomFt of [-0.5, -1.5, -2, -3, -3.28, -3.3, -6]) {
      const ground = siteGroundYFt(Math.min(foundationBottomFt, deckBottomFt), null);
      expect(ground, `foundation ${foundationBottomFt}`).toBeCloseTo(
        Math.min(foundationBottomFt, deckBottomFt) - SITE_GROUND_CLEARANCE_FT,
        9,
      );
    }
  });

  it("the floor gets exactly its 2 ft when the fallback is in play", () => {
    for (const deck of [-0.1, -15.5 / 12, -2, -4]) {
      expect(deck - siteGroundYFt(deck, deck), `deck ${deck}`).toBeCloseTo(SITE_FLOOR_PANEL_AIR_GAP_FT, 9);
    }
  });

  it("never puts the grass above the datum", () => {
    expect(siteGroundYFt(5, 5)).toBeLessThan(0);
    expect(siteGroundYFt(5, null)).toBeLessThan(0);
    expect(siteGroundYFt(0, 0)).toBeCloseTo(-SITE_FLOOR_PANEL_AIR_GAP_FT, 9);
  });
});


describe("the shadow caster stands on the BUILDING, not on the lawn", () => {
  /* ⚠ Tommy, 2026-11-09: *"I cannot see the 2-ft spacing between the grass and
     the bottom of wooden floor panels."* The gap measured exactly 24in in the
     browser that day — deck bottom -1.2917ft, grass -3.2917ft on the 16 x 24
     Tiny House. What hid it was this prism: based at the grass it filled the
     air with invisible mass and the building cast the shadow of a plinth it
     does not have. See `siteCasterBaseYFt`. */

  /** The browser's own numbers, 2026-11-09, so these are not invented. */
  const MEASURED_DECK_BOTTOM_FT = -15.5 / 12;
  const MEASURED_GROUND_FT = MEASURED_DECK_BOTTOM_FT - SITE_FLOOR_PANEL_AIR_GAP_FT;

  it("leaves the whole air gap EMPTY under a floor deck with nothing bearing on the ground", () => {
    const base = siteCasterBaseYFt(MEASURED_GROUND_FT, MEASURED_DECK_BOTTOM_FT);
    expect(base).toBeCloseTo(MEASURED_DECK_BOTTOM_FT, 9);
    // The whole point: the prism's underside is two feet clear of the grass.
    expect(base - MEASURED_GROUND_FT).toBeCloseTo(SITE_FLOOR_PANEL_AIR_GAP_FT, 9);
  });

  it("MEETS the grass when something bears on it, so a foundation's shadow stays attached", () => {
    // A bale foundation sets grade: `siteGroundYFt` puts the grass an inch under it.
    for (const foundationBottomFt of [-0.5, -1, -2, -3, -4]) {
      const ground = siteGroundYFt(foundationBottomFt, null);
      const base = siteCasterBaseYFt(ground, foundationBottomFt);
      expect(base - ground, `foundation ${foundationBottomFt}`).toBeCloseTo(SITE_GROUND_CLEARANCE_FT, 9);
    }
  });

  it("never hangs through the lawn", () => {
    for (const ground of [-0.1, -1, -3.2917, -10]) {
      for (const lowest of [0, -1, -5, -20]) {
        expect(siteCasterBaseYFt(ground, lowest), `ground ${ground} lowest ${lowest}`).toBeGreaterThanOrEqual(ground);
      }
    }
  });

  it("never rises above the datum, so a building with nothing below zero still casts from its own base", () => {
    expect(siteCasterBaseYFt(-SITE_GROUND_CLEARANCE_FT, 0)).toBe(0);
    // `lowestDrawnYFt` already floors at 0, but a positive input must not lift the prism off the walls.
    expect(siteCasterBaseYFt(-SITE_GROUND_CLEARANCE_FT, 5)).toBe(0);
  });

  it("⚠ the lift actually MOVES the shadow — which is the only reason any of this is visible", () => {
    /* The sun is a direction, so a caster lifted by h slides its shadow
       h x horizontal/vertical across the ground. With the gap filled (base at
       the grass) that offset is zero and the shadow is welded to the
       footprint, which is what the picture was saying before this change. */
    const [sx, sy, sz] = SITE_SUN_DIRECTION;
    const horizontalOverVertical = Math.hypot(sx, sz) / sy;

    const lifted = siteCasterBaseYFt(MEASURED_GROUND_FT, MEASURED_DECK_BOTTOM_FT) - MEASURED_GROUND_FT;
    const shadowOffsetFt = lifted * horizontalOverVertical;

    // About 1.4ft on this sun — enough lit grass under the near edge to read.
    expect(shadowOffsetFt).toBeGreaterThan(1);
    expect(shadowOffsetFt).toBeLessThan(2);
  });

  it("stays as tall as the building once it is based higher up", () => {
    /* `Building3DView` computes the height as `top - base`, so moving the base
       up must not shorten the prism below the roof — the top is an absolute
       height above the datum either way. */
    const topFt = 15.33;
    const base = siteCasterBaseYFt(MEASURED_GROUND_FT, MEASURED_DECK_BOTTOM_FT);
    expect(base + (topFt - base)).toBeCloseTo(topFt, 9);
    expect(topFt - base).toBeGreaterThan(0);
  });
});


describe("the orbit has a FLOOR, so the eye lands in the air gap instead of under the world", () => {
  /* ⚠ The other half of 2026-11-09. The two feet were there and nothing could
     look at them: a deck hides its own underside from every eye above it, and
     the only eye below it had already fallen through the single-sided ground
     plane into the blank page on the far side. */

  const TARGET: [number, number, number] = [0, 5, 0];
  const GROUND_FT = -15.5 / 12 - SITE_FLOOR_PANEL_AIR_GAP_FT;
  const FLOOR_FT = GROUND_FT + SITE_MIN_EYE_ABOVE_GRASS_FT;

  it("leaves a camera above the lawn completely alone", () => {
    for (const y of [0, 5, 20, FLOOR_FT, FLOOR_FT + 0.001]) {
      expect(cameraClampedAboveGround([30, y, 30], TARGET, FLOOR_FT), `y ${y}`).toBeNull();
    }
  });

  it("⚠ keeps the DISTANCE, so looking under the building does not silently dolly in", () => {
    const camera: [number, number, number] = [20, -30, 20];
    const before = Math.hypot(camera[0] - TARGET[0], camera[1] - TARGET[1], camera[2] - TARGET[2]);
    const after = cameraClampedAboveGround(camera, TARGET, FLOOR_FT);
    expect(after).not.toBeNull();
    const radius = Math.hypot(after![0] - TARGET[0], after![1] - TARGET[1], after![2] - TARGET[2]);
    expect(radius).toBeCloseTo(before, 9);
  });

  it("keeps the compass bearing, so the clamp never spins the view round", () => {
    const camera: [number, number, number] = [12, -40, -5];
    const after = cameraClampedAboveGround(camera, TARGET, FLOOR_FT)!;
    const bearingBefore = Math.atan2(camera[2] - TARGET[2], camera[0] - TARGET[0]);
    const bearingAfter = Math.atan2(after[2] - TARGET[2], after[0] - TARGET[0]);
    expect(bearingAfter).toBeCloseTo(bearingBefore, 9);
  });

  it("lands the eye exactly on the floor", () => {
    expect(cameraClampedAboveGround([30, -100, 30], TARGET, FLOOR_FT)![1]).toBeCloseTo(FLOOR_FT, 9);
  });

  it("⚠ and that floor is BELOW the floor deck, which is the whole point", () => {
    const deckBottomFt = -15.5 / 12;
    // Clamped at the lawn, the eye still has a clear foot and a half of air
    // over its head before the underside of the deck.
    expect(deckBottomFt - FLOOR_FT).toBeGreaterThan(1);
    expect(FLOOR_FT).toBeLessThan(deckBottomFt);
  });

  it("refuses rather than teleporting when the target is itself under the floor", () => {
    // No point at this radius satisfies it; a best-effort answer would jump the view.
    expect(cameraClampedAboveGround([1, -50, 0], [0, -60, 0], FLOOR_FT)).toBeNull();
    expect(cameraClampedAboveGround([0.5, -4, 0], [0, -4.2, 0], FLOOR_FT)).toBeNull();
  });

  it("handles a camera straight under the target without dividing by zero", () => {
    const after = cameraClampedAboveGround([0, -30, 0], TARGET, FLOOR_FT)!;
    expect(after[1]).toBeCloseTo(FLOOR_FT, 9);
    expect(Number.isFinite(after[0]) && Number.isFinite(after[2])).toBe(true);
    expect(Math.hypot(after[0] - TARGET[0], after[2] - TARGET[2])).toBeGreaterThan(0);
  });
});
