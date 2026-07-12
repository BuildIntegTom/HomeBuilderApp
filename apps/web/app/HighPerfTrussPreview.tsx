"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  buildEnergyHeelTrussMembers,
  buildHighPerfTrussBearingMembers,
  buildParallelChordTrussMembers,
  HIGH_PERF_TRUSS_BEARING_SHAPES,
  type HighPerfTrussBearingShapeId,
  type HighPerfTrussCavityDepthIn,
} from "@building-integrity/panel-catalog";
import PanelMembersGroup from "./PanelMembersGroup";

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 300;
const IN_PER_FT = 12;
const ELEVATION_DEG = 12;
const AZIMUTH_DEG = 25;

export type HighPerfTrussTypeId = "energy-heel" | "parallel-chord";

export interface HighPerfTrussPreviewProps {
  trussTypeId: HighPerfTrussTypeId;
  spanIn: number;
  pitchIn12: number;
  cavityDepthIn: HighPerfTrussCavityDepthIn;
  bearingShapeId: HighPerfTrussBearingShapeId;
}

/**
 * Composes a truss (Energy-Heel or Parallel Chord — see trussMembers.ts)
 * ON TOP OF its real bearing member (Tommy: "have them sit on the 2x12's
 * that are up there (or 14in LVL)") — the bearing member's own group is
 * shifted DOWN by its own depth so its top surface lands exactly at the
 * truss's local Z=0 origin, the same way the truss actually bears in real
 * construction.
 */
export default function HighPerfTrussPreview({ trussTypeId, spanIn, pitchIn12, cavityDepthIn, bearingShapeId }: HighPerfTrussPreviewProps) {
  const trussMembers =
    trussTypeId === "energy-heel"
      ? buildEnergyHeelTrussMembers(spanIn, pitchIn12, cavityDepthIn)
      : buildParallelChordTrussMembers(spanIn, pitchIn12, cavityDepthIn);
  const bearingMembers = buildHighPerfTrussBearingMembers(spanIn, bearingShapeId);
  const bearingDepthIn = HIGH_PERF_TRUSS_BEARING_SHAPES.find((b) => b.id === bearingShapeId)!.depthIn;

  const spanFt = spanIn / IN_PER_FT;
  const clampedPitchIn12 = Math.min(12, Math.max(2, pitchIn12));
  const peakFt = trussTypeId === "energy-heel" ? (cavityDepthIn + (spanIn / 2) * (clampedPitchIn12 / 12)) / IN_PER_FT : (cavityDepthIn + spanIn * (clampedPitchIn12 / 12)) / IN_PER_FT;
  const bearingFt = bearingDepthIn / IN_PER_FT;
  const totalHeightFt = peakFt + bearingFt;

  const maxDimFt = Math.max(spanFt, totalHeightFt * 2);
  const distance = maxDimFt * 1.3;
  const elevationRad = (ELEVATION_DEG * Math.PI) / 180;
  const azimuthRad = (AZIMUTH_DEG * Math.PI) / 180;
  const camHeight = totalHeightFt / 2 + distance * Math.sin(elevationRad);
  const camHorizontal = distance * Math.cos(elevationRad);
  const cameraPosition: [number, number, number] = [
    camHorizontal * Math.sin(azimuthRad),
    camHeight,
    camHorizontal * Math.cos(azimuthRad),
  ];

  return (
    <div style={{ width: "100%", maxWidth: CANVAS_WIDTH }}>
      <div style={{ width: "100%", maxWidth: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: "1px solid #ccc" }}>
        <Canvas camera={{ position: cameraPosition, fov: 45, near: 0.01, far: 1000 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[maxDimFt, maxDimFt * 2, maxDimFt]} intensity={0.8} />
          <group position={[-spanFt / 2, 0, 0]}>
            <PanelMembersGroup members={trussMembers} />
          </group>
          <group position={[-spanFt / 2, -bearingFt, 0]}>
            <PanelMembersGroup members={bearingMembers} />
          </group>
          <OrbitControls target={[0, totalHeightFt / 2 - bearingFt, 0]} makeDefault />
        </Canvas>
      </div>
    </div>
  );
}
