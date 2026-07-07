"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { wallBoxes3D, type Footprint } from "@building-integrity/geometry";

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 480;
const BIRDS_EYE_ELEVATION_DEG = 50;
const BIRDS_EYE_AZIMUTH_DEG = 45; // a corner/3-quarter starting view, not straight-on

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

interface Building3DViewProps {
  footprint: Footprint | null;
  wallHeightFt: number;
  thicknessIn: number;
  primaryCornerIds: Set<string>;
}

export default function Building3DView({ footprint, wallHeightFt, thicknessIn, primaryCornerIds }: Building3DViewProps) {
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
  const boxes = wallBoxes3D(footprint, thicknessIn, wallHeightFt, primaryCornerIds);
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
        {boxes.map((box) => (
          <mesh
            key={box.wallId}
            position={[box.centerX, box.heightFt / 2, box.centerZ]}
            rotation={[0, -box.rotationRad, 0]}
          >
            <boxGeometry args={[box.lengthFt, box.heightFt, box.thicknessFt]} />
            <meshStandardMaterial color="#d9c9a3" />
          </mesh>
        ))}
        <OrbitControls target={target} makeDefault />
      </Canvas>
    </div>
  );
}
