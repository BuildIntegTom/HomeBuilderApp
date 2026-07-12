"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { ClassicTrussTypeDef } from "@building-integrity/panel-catalog";
import PanelMembersGroup from "./PanelMembersGroup";

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 280;
const IN_PER_FT = 12;
const ELEVATION_DEG = 12;
const AZIMUTH_DEG = 25;

export interface TrussPreviewProps {
  trussType: ClassicTrussTypeDef;
}

/** A single classic truss's flat member profile (see trussMembers.ts) —
 * mostly face-on (low camera elevation, unlike OctagonRingPreview's
 * bird's-eye angle) since a truss's whole point is its own 2D silhouette,
 * with just enough azimuth/elevation to read as a real 3D object rather
 * than a flat drawing. */
export default function TrussPreview({ trussType }: TrussPreviewProps) {
  const members = trussType.build();
  const spanFt = trussType.defaultSpanIn / IN_PER_FT;
  const peakFt = trussType.peakHeightIn / IN_PER_FT;

  const maxDimFt = Math.max(spanFt, peakFt * 2);
  const distance = maxDimFt * 1.3;
  const elevationRad = (ELEVATION_DEG * Math.PI) / 180;
  const azimuthRad = (AZIMUTH_DEG * Math.PI) / 180;
  const camHeight = peakFt / 2 + distance * Math.sin(elevationRad);
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
            <PanelMembersGroup members={members} />
          </group>
          <OrbitControls target={[0, peakFt / 2, 0]} makeDefault />
        </Canvas>
      </div>
    </div>
  );
}
