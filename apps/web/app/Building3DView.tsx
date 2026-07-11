"use client";

import { useEffect, useMemo, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { panelSlotBoxes3D, type Footprint, type PanelSlot } from "@building-integrity/geometry";
import {
  buildBracedPanelMembers,
  buildBuildingObj,
  buildColumnPanelMembers,
  buildCornerPanelMembers,
  buildSafetyGapMembers,
  buildSquareBalePanelMembers,
  buildStandardPanelMembers,
  type PanelMember,
  type StudConfig,
  type WorldPlacedPanel,
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
 * door) falls back to a plain placeholder "blob" box, since there's no
 * member builder for them yet (Tommy: "unmodeled variants such as headers
 * and sills and door headers just be blobs so its obvious they arent done yet").
 * Safety/Gap (including one combined with a corner brace — its bracing
 * itself still isn't modeled in 3D, only its own plywood sheet) is just a
 * single 3/4in plywood sheet now, not an altered Standard Panel. Under
 * Square Bale Panels (Tommy's panelization type), a "standard"-typed slot
 * is actually a Square Bale Panel (blocking-girt construction), not a
 * loose-pack Standard Panel. */
function membersForSlot(
  slot: PanelSlot,
  thicknessIn: number,
  heightIn: number,
  includeNailer: boolean,
  isSquareBalePanelization: boolean,
  squareBaleStudConfig: StudConfig,
  nailerOffsetIn: number,
): PanelMember[] | null {
  switch (slot.type) {
    case "standard":
      return isSquareBalePanelization
        ? buildSquareBalePanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer, squareBaleStudConfig, nailerOffsetIn)
        : buildStandardPanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer);
    case "braced":
      return buildBracedPanelMembers(slot.widthIn, thicknessIn, heightIn, includeNailer);
    case "column":
      return buildColumnPanelMembers(thicknessIn, heightIn, includeNailer);
    case "corner":
    case "safety-oct-corner":
      return buildCornerPanelMembers(thicknessIn, heightIn, includeNailer);
    case "safety-gap":
      return buildSafetyGapMembers(thicknessIn, heightIn);
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
  /** A second story stacked at `wallHeightFt`'s top-plate height, sharing
   * the ground floor's footprint (Tommy: "an option for adding a second
   * level of panels" — full independent per-story footprints aren't wired
   * up yet, so this reuses the same footprint/wallSlots shape at its own
   * wall height). Undefined/null = single story, unchanged from before. */
  secondStory?: { wallHeightFt: number; wallSlots: Record<string, PanelSlot[]> } | null;
  /** Square Bale Panels panelization type (Tommy) — "standard"-typed slots
   * are Square Bale Panels (blocking-girt construction), not loose-pack
   * Standard Panels, when true. */
  isSquareBalePanelization?: boolean;
  /** Square Bale Panel-only stud config + nailer slide offset — ignored
   * when `isSquareBalePanelization` is false. */
  squareBaleStudConfig?: StudConfig;
  nailerOffsetIn?: number;
  /** Renders a static, non-interactive SE bird's-eye frame instead of the
   * normal orbit-able preview — used to capture a PNG for the Project
   * Summary page's static rendering (Tommy: "a static 3d rendering image
   * from a SE birdseye view"). Reuses the exact same camera math
   * (birdsEyeCameraPosition) as the interactive preview's own default
   * starting angle, so the two stay visually consistent. */
  captureMode?: boolean;
  /** Called once, shortly after the capture-mode frame first renders, with
   * a `data:image/png` URL of that frame — `captureMode`'s Canvas needs
   * `gl={{ preserveDrawingBuffer: true }}` for `toDataURL` to read back a
   * real image (off by default for the interactive view, since it has a
   * small perf cost not worth paying there). */
  onCapture?: (dataUrl: string) => void;
  /** Forwarded to CompassWidget's rotating face — see CompassTracker below. */
  compassRef?: RefObject<HTMLDivElement | null>;
}

/** Mounted only in `captureMode` — reads the Canvas's own `gl` via
 * `useThree` and grabs one frame as a PNG shortly after mount (a rAF tick
 * lets the scene's first real draw call land before reading pixels back). */
function CaptureFrame({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      onCapture(gl.domElement.toDataURL("image/png"));
    });
    return () => cancelAnimationFrame(id);
  }, [gl, onCapture]);
  return null;
}

/** Drives the CompassWidget (Tommy: "the compass should always be
 * corresponding to the camera angle, even rotating in 3D") — every frame,
 * computes the camera's azimuthal angle around `target` and writes it
 * straight to the compass face's `style.transform` via the forwarded ref.
 * Deliberately NOT React state: a state update here would re-render
 * page.tsx up to 60x/second for a value nothing else needs. */
function CompassTracker({ compassRef, target }: { compassRef: RefObject<HTMLDivElement | null>; target: [number, number, number] }) {
  useFrame(({ camera }) => {
    if (!compassRef.current) return;
    const azimuthRad = Math.atan2(camera.position.x - target[0], camera.position.z - target[2]);
    const azimuthDeg = (azimuthRad * 180) / Math.PI;
    compassRef.current.style.transform = `rotate(${-azimuthDeg}deg)`;
  });
  return null;
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
  secondStory,
  isSquareBalePanelization = false,
  squareBaleStudConfig = "single-2x4",
  nailerOffsetIn = 0,
  captureMode = false,
  onCapture,
  compassRef,
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
        members: membersForSlot(
          box.slot,
          thicknessIn,
          heightIn,
          includeNailer,
          isSquareBalePanelization,
          squareBaleStudConfig,
          nailerOffsetIn,
        ),
      })),
    [slotBoxes, thicknessIn, heightIn, includeNailer, isSquareBalePanelization, squareBaleStudConfig, nailerOffsetIn],
  );

  // Second story: same XZ anchor positions as the ground floor (shares its
  // footprint), just its own wall height for member geometry + a Y offset
  // by the ground floor's own top-plate height.
  const secondStoryHeightIn = secondStory ? secondStory.wallHeightFt * IN_PER_FT : 0;
  const secondStorySlotBoxes = useMemo(
    () =>
      footprint && secondStory
        ? panelSlotBoxes3D(footprint, secondStory.wallSlots, thicknessIn, secondStory.wallHeightFt, primaryCornerIds)
        : [],
    [footprint, secondStory, thicknessIn, primaryCornerIds],
  );
  const secondStorySlotRenderData = useMemo(
    () =>
      secondStorySlotBoxes.map((box) => ({
        box,
        members: membersForSlot(
          box.slot,
          thicknessIn,
          secondStoryHeightIn,
          includeNailer,
          isSquareBalePanelization,
          squareBaleStudConfig,
          nailerOffsetIn,
        ),
      })),
    [
      secondStorySlotBoxes,
      thicknessIn,
      secondStoryHeightIn,
      includeNailer,
      isSquareBalePanelization,
      squareBaleStudConfig,
      nailerOffsetIn,
    ],
  );

  const handleDownloadObj = () => {
    const toWorldPlacedPanel =
      (labelPrefix: string, worldYIn: number) =>
      ({ box, members }: { box: (typeof slotRenderData)[number]["box"]; members: PanelMember[] | null }): WorldPlacedPanel => ({
        label: `${labelPrefix}${box.wallId}_${box.slotIndex}`,
        worldXIn: box.anchorX * IN_PER_FT,
        worldZIn: box.anchorZ * IN_PER_FT,
        worldYIn,
        rotationRad: box.rotationRad,
        members,
        blobSizeIn: members
          ? undefined
          : { widthIn: box.widthFt * IN_PER_FT, heightIn: box.heightFt * IN_PER_FT, depthIn: box.depthFt * IN_PER_FT },
      });
    const panels: WorldPlacedPanel[] = [
      ...slotRenderData.map(toWorldPlacedPanel("", 0)),
      ...secondStorySlotRenderData.map(toWorldPlacedPanel("story2_", heightIn)),
    ];
    const objText = buildBuildingObj(panels, "Building");
    const blob = new Blob([objText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "building.obj";
    link.click();
    URL.revokeObjectURL(url);
  };

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

  const footprintBoundsRaw = footprintBounds(footprint);
  // A second story makes the building taller without making the footprint
  // any wider — factor total height into the camera distance too, so the
  // default starting view doesn't come in cropped against the roofline.
  const totalHeightFt = wallHeightFt + (secondStory ? secondStory.wallHeightFt : 0);
  const bounds: Bounds = { ...footprintBoundsRaw, maxDim: Math.max(footprintBoundsRaw.maxDim, totalHeightFt) };
  const cameraPosition = birdsEyeCameraPosition(bounds);
  const target: [number, number, number] = [footprintBoundsRaw.centerX, totalHeightFt / 2, footprintBoundsRaw.centerZ];
  const groundSize = bounds.maxDim * 3;

  return (
    <div style={{ width: CANVAS_WIDTH }}>
      {!captureMode && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button type="button" onClick={handleDownloadObj} style={{ fontSize: 12 }}>
            Export as OBJ
          </button>
        </div>
      )}
      <div style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, border: captureMode ? "none" : "1px solid #ccc" }}>
        <Canvas
          camera={{ position: cameraPosition, fov: 50, near: 0.1, far: 10000 }}
          gl={captureMode ? { preserveDrawingBuffer: true } : undefined}
        >
          {captureMode && onCapture && <CaptureFrame onCapture={onCapture} />}
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
          {secondStorySlotRenderData.map(({ box, members }) => (
            <group
              key={`story2-${box.wallId}-${box.slotIndex}`}
              position={[box.anchorX, wallHeightFt, box.anchorZ]}
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
          {!captureMode && <OrbitControls target={target} makeDefault />}
          {!captureMode && compassRef && <CompassTracker compassRef={compassRef} target={target} />}
        </Canvas>
      </div>
    </div>
  );
}
