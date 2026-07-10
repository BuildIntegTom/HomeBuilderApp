"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { panelSlotBoxes3D, type Footprint, type PanelSlot } from "@building-integrity/geometry";
import {
  buildBracedPanelMembers,
  buildColumnPanelMembers,
  buildCornerPanelMembers,
  buildStandardPanelMembers,
  type PanelMember,
} from "@building-integrity/panel-catalog";
import PanelMembersGroup from "./PanelMembersGroup";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 480;
const BIRDS_EYE_ELEVATION_DEG = 50;
const BIRDS_EYE_AZIMUTH_DEG = 45; // a corner/3-quarter starting view, not straight-on
const IN_PER_FT = 12;
const BLOB_COLOR = "#b5b0a8";

interface Bounds {
  centerX: number;
  centerZ: number;
  maxDim: number;
}

function footprintBounds(footprint: Footprint): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const c of footprint.corners) {
    minX = Math.min(minX, c.point.x);
    maxX = Math.max(maxX, c.point.x);
    minZ = Math.min(minZ, c.point.y);
    maxZ = Math.max(maxZ, c.point.y);
  }
  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    maxDim: Math.max(maxX - minX, maxZ - minZ, 10),
  };
}

/** Initial camera position for a "bird's-eye at `BIRDS_EYE_ELEVATION_DEG`"
 * starting view, auto-fit to the footprint's size — distance is a rough
 * multiple of the footprint's largest dimension, not a tight/exact fit
 * (this is a starting point; `OrbitControls` lets the view be adjusted
 * freely from there). */
function birdsEyeCameraPosition(bounds: Bounds): [number, number, number] {
  const distance = bounds.maxDim * 1.6;
  const elevationRad = (BIRDS_EYE_ELEVATION_DEG * Math.PI) / 180;
  const azimuthRad = (BIRDS_EYE_AZIMUTH_DEG * Math.PI) / 180;
  const height = distance * Math.sin(elevationRad);
  const horizontal = distance * Math.cos(elevationRad);
  return [
    bounds.centerX + horizontal * Math.cos(azimuthRad),
    height,
    bounds.centerZ + horizontal * Math.sin(azimuthRad),
  ];
}

/** Panel types with real member geometry today — everything else (window,
 * door, safety-gap, and a safety-gap combined with a corner brace) falls
 * back to a plain placeholder "blob" box, since there's no member builder
 * for them yet (Tommy: "unmodeled variants such as headers and sills and
 * door headers just be blobs so its obvious they arent done yet"). */
function membersForSlot(slot: PanelSlot, thicknessIn: number, heightIn: number, includeNailer: boolean): PanelMember[] | null {
  switch (slot.type) {
    case "standard":
      return buildStandardPanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer);
    case "braced":
      return buildBracedPanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer);
    case "column":
      return buildColumnPanelMembers(thicknessIn, heightIn, includeNailer);
    case "corner":
    case "safety-oct-corner":
      return buildCornerPanelMembers(thicknessIn, heightIn, includeNailer);
    default:
      return null;
  }
}

interface Building3DViewProps {
  footprint: Footprint | null;
  wallSlots: Record<string, PanelSlot[]>;
  wallHeightFt: number;
  thicknessIn: number;
  includeNailer: boolean;
  primaryCornerIds: Set<string>;
}

/** Whole-building 3D preview, built from the SAME per-panel member geometry
 * as each Shop Drawing page's 3D view (Tommy: "is there a way that the 3D
 * Preview button can show these models in their place together on the
 * floor plan?") — one positioned/rotated group per wall slot, each
 * containing that slot's own `PanelMembersGroup`. Column/Corner panels
 * ignore the slot's own tiled width (always fabricated at
 * `COLUMN_TOTAL_WIDTH_IN`, same simplification as their Shop Drawing
 * pages) — the group is still sized/positioned to the slot's actual tiled
 * width so it doesn't visibly overlap its neighbors, just slightly
 * mismatched from the panel's true 25.5in build width. */
export default function Building3DView({
  footprint,
  wallSlots,
  wallHeightFt,
  thicknessIn,
  includeNailer,
  primaryCornerIds,
}: Building3DViewProps) {
  const heightIn = wallHeightFt * IN_PER_FT;

  const slotBoxes = useMemo(
    () => (footprint ? panelSlotBoxes3D(footprint, wallSlots, thicknessIn, wallHeightFt, primaryCornerIds) : []),
    [footprint, wallSlots, thicknessIn, wallHeightFt, primaryCornerIds],
  );

  const slotRenderData = useMemo(
    () =>
      slotBoxes.map((box) => ({
        box,
        members: membersForSlot(box.slot, thicknessIn, heightIn, includeNailer),
      })),
    [slotBoxes, thicknessIn, heightIn, includeNailer],
  );

  if (!footprint) {
    return (
      <div
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          border: "1px solid #ccc",
          background: "#fcfcfa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999",
        }}
      >
        Click and drag to draw the footprint
      </div>
    );
  }

  const bounds = footprintBounds(footprint);
  const cameraPosition = birdsEyeCameraPosition(bounds);
  const target: [number, number, number] = [bounds.centerX, 0, bounds.centerZ];
  const groundSize = bounds.maxDim * 3;

  return (
    <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: "1px solid #ccc" }}>
      <Canvas camera={{ position: cameraPosition, fov: 50, near: 0.1, far: 10000 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[bounds.maxDim, bounds.maxDim * 2, bounds.maxDim]} intensity={0.8} />
        <mesh position={[bounds.centerX, -0.05, bounds.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[groundSize, groundSize]} />
          <meshStandardMaterial color="#e8e6df" />
        </mesh>
        {slotRenderData.map(({ box, members }) => (
          <group
            key={`${box.wallId}-${box.slotIndex}`}
            position={[box.anchorX, 0, box.anchorZ]}
            rotation={[0, -box.rotationRad, 0]}
          >
            {members ? (
              <PanelMembersGroup members={members} />
            ) : (
              <mesh position={[box.widthFt / 2, box.heightFt / 2, box.depthFt / 2]}>
                <boxGeometry args={[box.widthFt, box.heightFt, box.depthFt]} />
                <meshStandardMaterial color={BLOB_COLOR} transparent opacity={0.6} />
              </mesh>
            )}
          </group>
        ))}
        <OrbitControls target={target} makeDefault />
      </Canvas>
    </div>
  );
}
