"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, TransformControls } from "@react-three/drei";
import type { Mesh } from "three";
import { computeSillRunWidths, panelSlotBoxes3D, type Footprint, type PanelSlot } from "@building-integrity/geometry";
import {
  buildBracedPanelMembers,
  buildBuildingObj,
  buildColumnPanelMembers,
  buildCornerPanelMembers,
  buildOpeningAssemblyMembers,
  buildSafetyGapMembers,
  buildSquareBaleCornerPanelMembers,
  buildSquareBalePanelMembers,
  buildStandardPanelMembers,
  computeDoorRoughOpeningHeightIn,
  computeHeaderHeightIn,
  computeRoughOpeningWidthIn,
  doorRoughOpeningSelectedHeightIn,
  sillDefaultHeightIn,
  sillHeaderHeightInRange,
  standardWindowHeightDefaultIn,
  toeUpHeightIn,
  type JackStudConfig,
  type PanelMember,
  type StudConfig,
  type WorldPlacedPanel,
} from "@building-integrity/panel-catalog";
import PanelMembersGroup from "./PanelMembersGroup";
import { PANEL_TYPE_COLORS } from "./panelColors";

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

/** Real, real-height door Rough Opening height — see
 * computeDoorRoughOpeningHeightIn's own doc comment. A window's RO height is
 * its own `PanelSlot.heightIn` instead (Tommy: "i want each window
 * individually adjustable"), falling back to `standardWindowHeightDefaultIn`
 * when uncustomized — both openings' headers fill the real remaining space
 * up to the wall's own top plate, via `computeHeaderHeightIn`. */
const DOOR_RO_HEIGHT_IN = computeDoorRoughOpeningHeightIn(doorRoughOpeningSelectedHeightIn.value, toeUpHeightIn.value);

/** Real member geometry for every panel type, including window/door
 * openings (Tommy: "why arent the RO's, headers, and sills spawning into
 * the 3d drawing... fill them in") — a whole opening (header + both jack
 * studs + sill(s) for windows) via buildOpeningAssemblyMembers, correctly
 * Z-positioned within the slot's own box. Safety/Gap (including one
 * combined with a corner brace — its bracing itself still isn't modeled in
 * 3D, only its own plywood sheet) is just a single 3/4in plywood sheet now,
 * not an altered Standard Panel. Under Square Bale Panels (Tommy's
 * panelization type), a "standard"-typed slot is actually a Square Bale
 * Panel (blocking-girt construction), not a loose-pack Standard Panel. */
function membersForSlot(
  slot: PanelSlot,
  thicknessIn: number,
  heightIn: number,
  includeNailer: boolean,
  isSquareBalePanelization: boolean,
  squareBaleStudConfig: StudConfig,
  nailerOffsetIn: number,
  jackStudConfig: JackStudConfig,
  standardWidthIn: number,
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
      // Square Bale Panels' corner is a wider, asymmetric-stud construction
      // (Tommy: "standard size at 39in") matching the 39in slot the tiling
      // system already reserves for it under this panelization type (see
      // cornerWidthInForTiling in page.tsx) — the plain fixed-25.5in
      // Column/Corner unit only applies to every other panelization type.
      return isSquareBalePanelization
        ? buildSquareBaleCornerPanelMembers(thicknessIn, heightIn, includeNailer, nailerOffsetIn)
        : buildCornerPanelMembers(thicknessIn, heightIn, includeNailer);
    case "safety-gap":
      return buildSafetyGapMembers(thicknessIn, heightIn);
    case "window":
    case "door": {
      const isDoor = slot.type === "door";
      // Each window carries its own sill height (Tommy: "manipulate sill
      // and header height with the drag tool") — falls back to the
      // project default when this particular slot hasn't been customized.
      const sillHeightIn = isDoor ? 0 : (slot.sillHeightIn ?? sillDefaultHeightIn.value);
      const bottomZIn = sillHeightIn;
      // Each window carries its own height (Tommy: "i want each window
      // individually adjustable") — falls back to the project default
      // when this particular slot hasn't been customized.
      const jackStudSpanIn = isDoor ? DOOR_RO_HEIGHT_IN : (slot.heightIn ?? standardWindowHeightDefaultIn.value);
      const roTopZIn = bottomZIn + jackStudSpanIn;
      const headerHeightIn = computeHeaderHeightIn(heightIn, roTopZIn);
      const sillWidthsIn = isDoor
        ? []
        : computeSillRunWidths(computeRoughOpeningWidthIn(slot.widthIn, jackStudConfig), standardWidthIn);
      return buildOpeningAssemblyMembers(
        slot.widthIn,
        thicknessIn,
        isDoor ? "door" : "window",
        jackStudConfig,
        bottomZIn,
        jackStudSpanIn,
        headerHeightIn,
        sillHeightIn,
        sillWidthsIn,
        includeNailer,
      );
    }
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
  /** Jack stud construction + standard panel width — feed window/door
   * opening assemblies (header/jack-studs/sill) via buildOpeningAssemblyMembers. */
  jackStudConfig: JackStudConfig;
  standardWidthIn: number;
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
  /** Renders every panel as a single flat-colored box (its own panel-type
   * legend color) instead of its full member-by-member geometry (Tommy:
   * "lets simplify... for panels to appear as their respective color and
   * just appear as the primary 3D shapes that they are") — meant for
   * scenes with many panels at once (e.g. TruckLoad3DView's stacked
   * shipping view) where full wood-member detail would be unreadable
   * clutter, but available as a general toggle here too. Off by default. */
  simplified?: boolean;
  /** Which 3D-only editor tool is active (Tommy: "build the 3d viewer into
   * an editor with all the same tools as the 2d plan editor" — Phase 1
   * scope: just Edit-cycle parity + the Sill & Header drag tool; draw/
   * bump-out/drag-wall are deferred, so this is a deliberately separate,
   * smaller vocabulary from the 2D `ShapeTool` union, not a reuse of it).
   * "orbit" (default) leaves every slot non-interactive so OrbitControls
   * has the pointer to itself. */
  tool3D?: "orbit" | "edit" | "sill-header";
  /** Cycles one panel slot's type the same way the 2D Edit tool's
   * `onToggleOpening` does — only wired up when `tool3D === "edit"`. The
   * `story` param is accepted now (not yet meaningfully different from the
   * caller's point of view, since ground/second story share the same
   * underlying wallSlots today) so a future independent per-story data
   * model can slot in without changing this component's interaction code. */
  onToggleOpening?: (story: "ground" | "second", wallId: string, slotIndex: number) => void;
  /** Commits the bottom handle's dragged position (floor to RO-bottom) —
   * only wired up when `tool3D === "sill-header"`. Same story-forwarding
   * rationale as `onToggleOpening`. */
  onSetWindowSillHeight?: (story: "ground" | "second", wallId: string, slotIndex: number, sillHeightIn: number) => void;
  /** Commits the top handle's dragged position, expressed as the window's
   * own RO height (top edge relative to the bottom handle) — same field
   * `handleSetWindowHeight` already writes for the 2D dropdown. */
  onSetWindowHeight?: (story: "ground" | "second", wallId: string, slotIndex: number, heightIn: number) => void;
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
 * ignore the slot's own tiled width and instead always build at their own
 * fixed fabrication width (`COLUMN_TOTAL_WIDTH_IN`, or 39in for a Square
 * Bale Panels corner) — the group is still sized/positioned to the slot's
 * tiled width, which the tiling system (page.tsx/retile.ts/tiling.ts) keeps
 * exactly equal to that same fixed width, so there's no unrendered gap
 * (Tommy: "we cannot have this type of error happening"). */
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
  jackStudConfig,
  standardWidthIn,
  captureMode = false,
  onCapture,
  compassRef,
  simplified = false,
  tool3D = "orbit",
  onToggleOpening,
  onSetWindowSillHeight,
  onSetWindowHeight,
}: Building3DViewProps) {
  const heightIn = wallHeightFt * IN_PER_FT;
  // Sill & Header drag tool's own selection + drag-in-progress state — a
  // pure 3D-view interaction concern (mirrors how FootprintCanvas.tsx keeps
  // its own pan/zoom fully local rather than lifting it to page.tsx).
  const [selectedWindow, setSelectedWindow] = useState<{ wallId: string; slotIndex: number; story: "ground" | "second" } | null>(
    null,
  );
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  useEffect(() => {
    if (tool3D !== "sill-header") setSelectedWindow(null);
  }, [tool3D]);
  // Only one window can be selected at a time, so one pair of refs (rather
  // than a ref per rendered slot) is enough to read each handle's own
  // dragged position back out on release.
  const sillHandleRef = useRef<Mesh>(null);
  const headerHandleRef = useRef<Mesh>(null);

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
          jackStudConfig,
          standardWidthIn,
        ),
      })),
    [
      slotBoxes,
      thicknessIn,
      heightIn,
      includeNailer,
      isSquareBalePanelization,
      squareBaleStudConfig,
      nailerOffsetIn,
      jackStudConfig,
      standardWidthIn,
    ],
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
          jackStudConfig,
          standardWidthIn,
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
      jackStudConfig,
      standardWidthIn,
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

  // Sill & Header drag tool (Tommy: "manipulate sill and header height with
  // the drag tool") — only rendered for the currently-selected window slot,
  // as 2 small Y-axis-only TransformControls handles at its RO's bottom
  // (sill) and top (header) edges. The scene's Y axis is in FEET (see the
  // second-story stacking above, which uses `wallHeightFt` directly as a Y
  // offset) while sill/window heights are stored in INCHES — every
  // conversion here divides/multiplies by IN_PER_FT accordingly.
  const renderSillHeaderHandles = (box: (typeof slotBoxes)[number], story: "ground" | "second") => {
    if (
      tool3D !== "sill-header" ||
      box.slot.type !== "window" ||
      !selectedWindow ||
      selectedWindow.story !== story ||
      selectedWindow.wallId !== box.wallId ||
      selectedWindow.slotIndex !== box.slotIndex
    ) {
      return null;
    }
    const sillHeightIn = box.slot.sillHeightIn ?? sillDefaultHeightIn.value;
    const windowHeightIn = box.slot.heightIn ?? standardWindowHeightDefaultIn.value;
    const xLocal = box.widthFt / 2;
    const zLocal = box.depthFt / 2;
    const sillYFt = sillHeightIn / IN_PER_FT;
    const headerYFt = (sillHeightIn + windowHeightIn) / IN_PER_FT;

    const commitSill = () => {
      setIsDraggingHandle(false);
      const draggedYFt = sillHandleRef.current?.position.y;
      if (draggedYFt === undefined) return;
      const rawIn = draggedYFt * IN_PER_FT;
      const maxSillHeightIn = wallHeightFt * IN_PER_FT - windowHeightIn;
      const clampedIn = Math.min(Math.max(rawIn, sillHeaderHeightInRange.minIn), Math.min(sillHeaderHeightInRange.maxIn, maxSillHeightIn));
      onSetWindowSillHeight?.(story, box.wallId, box.slotIndex, clampedIn);
    };
    const commitHeader = () => {
      setIsDraggingHandle(false);
      const draggedYFt = headerHandleRef.current?.position.y;
      if (draggedYFt === undefined) return;
      const rawTopIn = draggedYFt * IN_PER_FT;
      onSetWindowHeight?.(story, box.wallId, box.slotIndex, Math.max(1, rawTopIn - sillHeightIn));
    };

    return (
      <>
        <TransformControls mode="translate" showX={false} showZ={false} onMouseDown={() => setIsDraggingHandle(true)} onMouseUp={commitSill}>
          <mesh ref={sillHandleRef} position={[xLocal, sillYFt, zLocal]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#2f8f4e" />
          </mesh>
        </TransformControls>
        <TransformControls mode="translate" showX={false} showZ={false} onMouseDown={() => setIsDraggingHandle(true)} onMouseUp={commitHeader}>
          <mesh ref={headerHandleRef} position={[xLocal, headerYFt, zLocal]}>
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshStandardMaterial color="#c0392b" />
          </mesh>
        </TransformControls>
      </>
    );
  };

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
              onClick={
                tool3D === "edit"
                  ? (e) => {
                      e.stopPropagation();
                      onToggleOpening?.("ground", box.wallId, box.slotIndex);
                    }
                  : tool3D === "sill-header" && box.slot.type === "window"
                    ? (e) => {
                        e.stopPropagation();
                        setSelectedWindow({ wallId: box.wallId, slotIndex: box.slotIndex, story: "ground" });
                      }
                    : undefined
              }
            >
              {members && !simplified ? (
                <PanelMembersGroup
                  members={members}
                  colorOverride={box.slot.type === "safety-gap" ? PANEL_TYPE_COLORS["safety-gap"] : undefined}
                />
              ) : (
                <mesh position={[box.widthFt / 2, box.heightFt / 2, box.depthFt / 2]}>
                  <boxGeometry args={[box.widthFt, box.heightFt, box.depthFt]} />
                  <meshStandardMaterial color={simplified ? PANEL_TYPE_COLORS[box.slot.type] : BLOB_COLOR} transparent opacity={0.6} />
                </mesh>
              )}
              {renderSillHeaderHandles(box, "ground")}
            </group>
          ))}
          {secondStorySlotRenderData.map(({ box, members }) => (
            <group
              key={`story2-${box.wallId}-${box.slotIndex}`}
              position={[box.anchorX, wallHeightFt, box.anchorZ]}
              rotation={[0, -box.rotationRad, 0]}
              onClick={
                tool3D === "edit"
                  ? (e) => {
                      e.stopPropagation();
                      onToggleOpening?.("second", box.wallId, box.slotIndex);
                    }
                  : tool3D === "sill-header" && box.slot.type === "window"
                    ? (e) => {
                        e.stopPropagation();
                        setSelectedWindow({ wallId: box.wallId, slotIndex: box.slotIndex, story: "second" });
                      }
                    : undefined
              }
            >
              {members && !simplified ? (
                <PanelMembersGroup
                  members={members}
                  colorOverride={box.slot.type === "safety-gap" ? PANEL_TYPE_COLORS["safety-gap"] : undefined}
                />
              ) : (
                <mesh position={[box.widthFt / 2, box.heightFt / 2, box.depthFt / 2]}>
                  <boxGeometry args={[box.widthFt, box.heightFt, box.depthFt]} />
                  <meshStandardMaterial color={simplified ? PANEL_TYPE_COLORS[box.slot.type] : BLOB_COLOR} transparent opacity={0.6} />
                </mesh>
              )}
              {renderSillHeaderHandles(box, "second")}
            </group>
          ))}
          {!captureMode && <OrbitControls target={target} makeDefault enabled={!isDraggingHandle} />}
          {!captureMode && compassRef && <CompassTracker compassRef={compassRef} target={target} />}
        </Canvas>
      </div>
    </div>
  );
}
