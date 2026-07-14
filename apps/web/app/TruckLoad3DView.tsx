"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { TruckDims, TruckLoad } from "@building-integrity/geometry";
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
  /** Fallback height for a panel absent from `panelHeightById` — matches
   * the same default computeTruckLoads itself was called with. */
  panelHeightIn: number;
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
 * Same 3-face convention as Building3DView's WallPanelLabel (top, front,
 * right — Tommy: "the panel ID labels that we have on the 3D Framed
 * model") adapted to a truck-loaded panel's own axes: width (X) x
 * thickness (Y, the stacking direction) x depth (Z, the panel's own real
 * height, running along the trailer's length). "Front" sits on the thin
 * end closest to the trailer's own exterior/rear opening; "right" sits on
 * the panel's own tall edge — its largest side face (thickness x depth is
 * bigger than width x thickness for every panel type this app ships).
 * Both are visible for every panel in a stack (each occupies its own Y-
 * slice, never obscured by its neighbors from these angles) — only "top"
 * is gated to the stack's own topmost panel, since every panel below it is
 * hidden top-to-bottom.
 */
function TruckPanelLabel({
  text,
  widthFt,
  thicknessFt,
  depthFt,
  isTopOfStack,
}: {
  text: string | undefined;
  widthFt: number;
  thicknessFt: number;
  depthFt: number;
  isTopOfStack: boolean;
}) {
  if (!text || widthFt < LABEL_MIN_WIDTH_FT) return null;
  const topFontSize = Math.max(0.1, Math.min(0.3, widthFt * 0.25, depthFt * 0.2)) * LABEL_SIZE_MULTIPLIER;
  const frontFontSize = Math.max(0.06, Math.min(0.2, widthFt * 0.2, thicknessFt * 0.5)) * LABEL_SIZE_MULTIPLIER;
  const rightFontSize = Math.max(0.06, Math.min(0.2, thicknessFt * 0.5, depthFt * 0.2)) * LABEL_SIZE_MULTIPLIER;
  return (
    <>
      {isTopOfStack && (
        <PanelLabel text={text} position={[0, thicknessFt / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={topFontSize} />
      )}
      <PanelLabel text={text} position={[0, 0, -depthFt / 2 - 0.01]} rotation={[0, Math.PI, 0]} fontSize={frontFontSize} />
      <PanelLabel text={text} position={[widthFt / 2 + 0.01, 0, 0]} rotation={[0, Math.PI / 2, 0]} fontSize={rightFontSize} />
    </>
  );
}

/**
 * One trailer's own load, rendered as simple flat-colored boxes — always
 * simplified (Tommy: "for these drawings, lets not see all the wooden
 * pieces... just appear as the primary 3D shapes that they are"), since a
 * full truckload of panels shown member-by-member would be unreadable
 * clutter. Renders `load.rows` exactly as `computeTruckLoads`/
 * `packRowsByWidth` packed them (a row can hold 2+ narrower stacks side by
 * side, Tommy: "its very very handy to be able to have 2 rows of panels"),
 * so the render can never drift out of sync with the real capacity
 * calculation.
 */
export default function TruckLoad3DView({
  load,
  truck,
  panelHeightIn,
  bufferIn,
  panelTypeById,
  panelWidthById,
  panelHeightById,
  displayName = "Truck",
}: TruckLoad3DViewProps) {
  // Each row's own real depth (Tommy: "you can orient the panels however
  // you want to make them space efficient") — mirrors computeTruckLoads's
  // own row-packing, so a row of short header/sill stacks reserves only as
  // much of the truck's length as its own tallest member actually needs
  // instead of a fixed uniform depth for every row.
  const rowHeightsIn = load.rows.map((row) => Math.max(...row.map((stack) => stack.heightIn)));
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
          {load.rows.map((row, rowIndex) => {
            const rowHeightIn = rowHeightsIn[rowIndex]!;
            const rowZStartIn = rowZStartsIn[rowIndex]!;
            const stackCenterZFt = (rowZStartIn + rowHeightIn / 2) / IN_PER_FT;
            let stackXStartIn = bufferIn;
            return row.map((stack) => {
              const stackCenterXFt = (stackXStartIn + stack.widthIn / 2) / IN_PER_FT;
              stackXStartIn += stack.widthIn + bufferIn;
              const thicknessFt = stack.thicknessIn / IN_PER_FT;
              return stack.panelIds.map((panelId, indexFromTop) => {
                const indexFromBottom = stack.panelIds.length - 1 - indexFromTop;
                const centerYFt = (bufferIn + (indexFromBottom + 0.5) * stack.thicknessIn) / IN_PER_FT;
                const color = NAMED_PANEL_TYPE_COLORS[panelTypeById.get(panelId) ?? "standard"];
                const widthFt = (panelWidthById.get(panelId) ?? stack.widthIn) / IN_PER_FT;
                const depthFt = (panelHeightById.get(panelId) ?? panelHeightIn) / IN_PER_FT;
                // Only the topmost panel of each stack ever has its own top
                // face actually visible from above (Tommy: "the specific
                // panel label... across all models") — every panel under it
                // is hidden face-to-face there, though its front/right
                // faces are still visible (see TruckPanelLabel's own doc
                // comment).
                const isTopOfStack = indexFromTop === 0;
                return (
                  <mesh key={panelId} position={[stackCenterXFt, centerYFt, stackCenterZFt]}>
                    <boxGeometry args={[widthFt, thicknessFt, depthFt]} />
                    <meshStandardMaterial color={color} />
                    <TruckPanelLabel text={panelId} widthFt={widthFt} thicknessFt={thicknessFt} depthFt={depthFt} isTopOfStack={isTopOfStack} />
                  </mesh>
                );
              });
            });
          })}
          <OrbitControls target={[centerX, centerY, centerZ]} makeDefault />
        </Canvas>
      </div>
    </div>
  );
}
