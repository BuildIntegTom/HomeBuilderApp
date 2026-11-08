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
  SITE_GROUND_CLEARANCE_FT,
  SITE_PROVENANCE,
  SITE_OPENING_CAMERA_AZIMUTH_DEG,
  SITE_SUN_DIRECTION,
  VOID_SUN_DIRECTION,
  deckGroupRotationX,
  lowestDrawnYFt,
  lowestMemberHeightIn,
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
