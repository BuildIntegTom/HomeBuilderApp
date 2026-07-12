"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  buildOctagonRingSegmentMembers,
  computeOctagonRingSegmentPlacements,
  OCTAGON_RING_DEPTH_IN,
} from "@building-integrity/panel-catalog";
import PanelMembersGroup from "./PanelMembersGroup";

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 360;
const IN_PER_FT = 12;
const ELEVATION_DEG = 35;
const AZIMUTH_DEG = 35;

export interface OctagonRingPreviewProps {
  outsideDiameterFt: number;
}

/**
 * 8 mitered LVL segments arranged into the octagon roof-catcher ring (see
 * octagonRingMembers.ts) — each segment is an identical `PanelMember[]`
 * (built once, reused 8x) wrapped in its own rotated/positioned `<group>`
 * per `computeOctagonRingSegmentPlacements`, since (unlike every other
 * combined-member preview in this app) a ring's segments sit at 8 different
 * yaws, not one shared local frame.
 */
export default function OctagonRingPreview({ outsideDiameterFt }: OctagonRingPreviewProps) {
  const outsideDiameterIn = outsideDiameterFt * IN_PER_FT;
  const segmentMembers = buildOctagonRingSegmentMembers(outsideDiameterIn);
  const placements = computeOctagonRingSegmentPlacements(outsideDiameterIn);

  const maxDimFt = Math.max(outsideDiameterFt, OCTAGON_RING_DEPTH_IN / IN_PER_FT);
  const distance = maxDimFt * 2;
  const elevationRad = (ELEVATION_DEG * Math.PI) / 180;
  const azimuthRad = (AZIMUTH_DEG * Math.PI) / 180;
  const camHeight = distance * Math.sin(elevationRad);
  const camHorizontal = distance * Math.cos(elevationRad);
  const cameraPosition: [number, number, number] = [
    camHorizontal * Math.cos(azimuthRad),
    camHeight,
    camHorizontal * Math.sin(azimuthRad),
  ];

  return (
    <div style={{ width: "100%", maxWidth: CANVAS_WIDTH }}>
      <div style={{ width: "100%", maxWidth: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: "1px solid #ccc" }}>
        <Canvas camera={{ position: cameraPosition, fov: 45, near: 0.01, far: 1000 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[maxDimFt, maxDimFt * 2, maxDimFt]} intensity={0.8} />
          {placements.map((p) => (
            <group key={p.index} position={[p.centerXIn / IN_PER_FT, 0, p.centerZIn / IN_PER_FT]} rotation={[0, (-p.rotationDeg * Math.PI) / 180, 0]}>
              <PanelMembersGroup members={segmentMembers} />
            </group>
          ))}
          <OrbitControls target={[0, 0, 0]} makeDefault />
        </Canvas>
      </div>
    </div>
  );
}
