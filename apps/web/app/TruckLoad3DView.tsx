"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { computeStacksAcrossWidth, type TruckDims, type TruckLoad } from "@building-integrity/geometry";
import type { NamedPanelType } from "./panelInstances";
import { NAMED_PANEL_TYPE_COLORS } from "./panelColors";

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 320;
const IN_PER_FT = 12;
const ELEVATION_DEG = 22;
const AZIMUTH_DEG = 35;
const TRAILER_COLOR = "#999999";

export interface TruckLoad3DViewProps {
  load: TruckLoad;
  truck: TruckDims;
  /** The single uniform stack-footprint width every stack in this load was
   * grid-packed against (see computeTruckLoads's own doc comment — every
   * stack shares one grid cell sized to the widest panel in the whole
   * shipment). */
  maxStackWidthIn: number;
  panelHeightIn: number;
  panelThicknessIn: number;
  bufferIn: number;
  /** Looks up each panel id's own named type, for its box color (Tommy:
   * "panels to appear as their respective color"). */
  panelTypeById: Map<string, NamedPanelType>;
  displayName?: string;
}

/**
 * One trailer's own load, rendered as simple flat-colored boxes — always
 * simplified (Tommy: "for these drawings, lets not see all the wooden
 * pieces... just appear as the primary 3D shapes that they are"), since a
 * full truckload of panels shown member-by-member would be unreadable
 * clutter. Reuses the exact grid math `computeTruckLoads` itself used
 * (`computeStacksAcrossWidth`) so the render can never drift out of sync
 * with the real capacity calculation.
 */
export default function TruckLoad3DView({
  load,
  truck,
  maxStackWidthIn,
  panelHeightIn,
  panelThicknessIn,
  bufferIn,
  panelTypeById,
  displayName = "Truck",
}: TruckLoad3DViewProps) {
  const stacksAcross = Math.max(1, computeStacksAcrossWidth(truck.widthIn, maxStackWidthIn, bufferIn));

  const truckWidthFt = truck.widthIn / IN_PER_FT;
  const truckHeightFt = truck.heightIn / IN_PER_FT;
  const truckLengthFt = truck.lengthIn / IN_PER_FT;
  const centerX = truckWidthFt / 2;
  const centerY = truckHeightFt / 2;
  const centerZ = truckLengthFt / 2;
  const maxDim = Math.max(truckWidthFt, truckHeightFt, truckLengthFt);

  const distance = maxDim * 1.6;
  const elevationRad = (ELEVATION_DEG * Math.PI) / 180;
  const azimuthRad = (AZIMUTH_DEG * Math.PI) / 180;
  const camHeight = centerY + distance * Math.sin(elevationRad);
  const camHorizontal = distance * Math.cos(elevationRad);
  const cameraPosition: [number, number, number] = [
    centerX + camHorizontal * Math.cos(azimuthRad),
    camHeight,
    centerZ + camHorizontal * Math.sin(azimuthRad),
  ];

  return (
    <div style={{ width: "100%", maxWidth: CANVAS_WIDTH }}>
      <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>{displayName}</p>
      <div style={{ width: "100%", maxWidth: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: "1px solid #ccc" }}>
        <Canvas camera={{ position: cameraPosition, fov: 45, near: 0.01, far: 2000 }}>
          <ambientLight intensity={0.75} />
          <directionalLight position={[maxDim, maxDim * 2, maxDim]} intensity={0.8} />
          <mesh position={[centerX, centerY, centerZ]}>
            <boxGeometry args={[truckWidthFt, truckHeightFt, truckLengthFt]} />
            <meshBasicMaterial color={TRAILER_COLOR} wireframe />
          </mesh>
          {load.stacks.map((stack, stackIndex) => {
            const col = stackIndex % stacksAcross;
            const row = Math.floor(stackIndex / stacksAcross);
            const stackXStartIn = bufferIn + col * (maxStackWidthIn + bufferIn);
            const stackZStartIn = bufferIn + row * (panelHeightIn + bufferIn);
            const stackCenterXFt = (stackXStartIn + stack.widthIn / 2) / IN_PER_FT;
            const stackCenterZFt = (stackZStartIn + panelHeightIn / 2) / IN_PER_FT;
            return stack.panelIds.map((panelId, indexFromTop) => {
              const indexFromBottom = stack.panelIds.length - 1 - indexFromTop;
              const centerYFt = (bufferIn + (indexFromBottom + 0.5) * panelThicknessIn) / IN_PER_FT;
              const color = NAMED_PANEL_TYPE_COLORS[panelTypeById.get(panelId) ?? "standard"];
              return (
                <mesh key={panelId} position={[stackCenterXFt, centerYFt, stackCenterZFt]}>
                  <boxGeometry args={[stack.widthIn / IN_PER_FT, panelThicknessIn / IN_PER_FT, panelHeightIn / IN_PER_FT]} />
                  <meshStandardMaterial color={color} />
                </mesh>
              );
            });
          })}
          <OrbitControls target={[centerX, centerY, centerZ]} makeDefault />
        </Canvas>
      </div>
    </div>
  );
}
