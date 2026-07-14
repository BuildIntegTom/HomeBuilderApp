"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { computeStacksAcrossWidth, type TruckDims, type TruckLoad } from "@building-integrity/geometry";
import type { NamedPanelType } from "./panelInstances";
import { NAMED_PANEL_TYPE_COLORS } from "./panelColors";
import PanelLabel from "./PanelLabel";

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 320;
const IN_PER_FT = 12;
const ELEVATION_DEG = 22;
const AZIMUTH_DEG = 35;
const TRAILER_COLOR = "#999999";
const LABEL_MIN_WIDTH_FT = 0.5;
// Tommy: "double the size of the box view labeling" — same multiplier
// Building3DView's WallPanelLabel applies, for visual consistency across
// every simplified box view.
const LABEL_SIZE_MULTIPLIER = 2;

export interface TruckLoad3DViewProps {
  load: TruckLoad;
  truck: TruckDims;
  /** The single uniform stack-footprint width every stack in this load was
   * grid-packed against (see computeTruckLoads's own doc comment — every
   * stack shares one grid cell sized to the widest panel in the whole
   * shipment). */
  maxStackWidthIn: number;
  /** Fallback height for a panel absent from `panelHeightById` — matches
   * the same default computeTruckLoads itself was called with. */
  panelHeightIn: number;
  panelThicknessIn: number;
  bufferIn: number;
  /** Looks up each panel id's own named type, for its box color (Tommy:
   * "panels to appear as their respective color"). */
  panelTypeById: Map<string, NamedPanelType>;
  /** Each panel's own real width/height (Tommy: "windows and column panels
   * are not loading correctly... they are mostly loading as big blocks") —
   * a narrow Column panel or a short header/sill renders at its own true
   * size instead of the shared stack footprint every panel used to borrow. */
  panelWidthById: Map<string, number>;
  panelHeightById: Map<string, number>;
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
  panelWidthById,
  panelHeightById,
  displayName = "Truck",
}: TruckLoad3DViewProps) {
  const stacksAcross = Math.max(1, computeStacksAcrossWidth(truck.widthIn, maxStackWidthIn, bufferIn));

  // Each row's own real depth (Tommy: "you can orient the panels however
  // you want to make them space efficient") — mirrors computeTruckLoads's
  // own row-packing, so a row of short header/sill stacks reserves only as
  // much of the truck's length as its own tallest member actually needs
  // instead of a fixed uniform depth for every row.
  const rowHeightsIn: number[] = [];
  for (let i = 0; i < load.stacks.length; i += stacksAcross) {
    const row = load.stacks.slice(i, i + stacksAcross);
    rowHeightsIn.push(Math.max(...row.flatMap((stack) => stack.panelIds.map((id) => panelHeightById.get(id) ?? panelHeightIn))));
  }
  const rowZStartsIn: number[] = [];
  let cumulativeZIn = bufferIn;
  for (const rowHeightIn of rowHeightsIn) {
    rowZStartsIn.push(cumulativeZIn);
    cumulativeZIn += rowHeightIn + bufferIn;
  }

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
            const rowHeightIn = rowHeightsIn[row]!;
            const stackXStartIn = bufferIn + col * (maxStackWidthIn + bufferIn);
            const stackZStartIn = rowZStartsIn[row]!;
            const stackCenterXFt = (stackXStartIn + stack.widthIn / 2) / IN_PER_FT;
            const stackCenterZFt = (stackZStartIn + rowHeightIn / 2) / IN_PER_FT;
            return stack.panelIds.map((panelId, indexFromTop) => {
              const indexFromBottom = stack.panelIds.length - 1 - indexFromTop;
              const centerYFt = (bufferIn + (indexFromBottom + 0.5) * panelThicknessIn) / IN_PER_FT;
              const color = NAMED_PANEL_TYPE_COLORS[panelTypeById.get(panelId) ?? "standard"];
              const widthFt = (panelWidthById.get(panelId) ?? stack.widthIn) / IN_PER_FT;
              const thicknessFt = panelThicknessIn / IN_PER_FT;
              const depthFt = (panelHeightById.get(panelId) ?? panelHeightIn) / IN_PER_FT;
              // Only the topmost panel of each stack is ever actually
              // visible from above (Tommy: "the specific panel label...
              // across all models") — every panel under it is hidden face-
              // to-face, so labeling them too would just render unseen text.
              const isTopOfStack = indexFromTop === 0;
              return (
                <mesh key={panelId} position={[stackCenterXFt, centerYFt, stackCenterZFt]}>
                  <boxGeometry args={[widthFt, thicknessFt, depthFt]} />
                  <meshStandardMaterial color={color} />
                  {isTopOfStack && widthFt >= LABEL_MIN_WIDTH_FT && (
                    <PanelLabel
                      text={panelId}
                      position={[0, thicknessFt / 2 + 0.01, 0]}
                      rotation={[-Math.PI / 2, 0, 0]}
                      fontSize={Math.max(0.1, Math.min(0.3, widthFt * 0.25, depthFt * 0.2)) * LABEL_SIZE_MULTIPLIER}
                    />
                  )}
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
