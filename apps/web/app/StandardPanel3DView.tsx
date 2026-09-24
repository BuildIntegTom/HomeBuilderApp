"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { buildPanelObj, memberBoxSizeIn, SKIN_THICKNESS_IN, type PanelMember } from "@building-integrity/panel-catalog";
import { computeStandardPanelStrawVolume } from "@building-integrity/calc-engine";
import PanelMembersGroup from "./PanelMembersGroup";
import { useBrowsing } from "./BrowseModeContext";

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 420;
const CANVAS_WIDTH_COMPACT = 220;
const CANVAS_HEIGHT_COMPACT = 130;
const IN_PER_FT = 12;
const ELEVATION_DEG = 25;
const AZIMUTH_DEG = 35;

const STRAW_COLOR = "#e0c458";

export interface StandardPanel3DViewProps {
  members: PanelMember[];
  overallDimensions: { heightIn: number; widthIn: number; depthIn: number };
  /** Used for the OBJ file's header comment + download filename. */
  displayName?: string;
  /** Shrinks the canvas and condenses the toolbar to fit SheetTitleBlock's
   * own sideDiagram zone (~230-250px wide) — Tommy: "make the image a
   * little bit smaller and squeeze it." Both controls (straw-fill toggle,
   * OBJ download) stay functional, just smaller — this is still an
   * interactive preview, not a static print image. Suppresses the straw-
   * volume explanatory paragraph (too verbose for the squeezed space);
   * the checkbox itself still toggles the visual straw fill. */
  compact?: boolean;
}

/** Real 3D model of a panel, built straight from its `members` list (see
 * `buildStandardPanelMembers` in @building-integrity/panel-catalog) — each
 * member becomes one box, sized/positioned via `memberBoxSizeIn` (the same
 * axis-mapping a future SketchUp exporter would use), colored by
 * material. Same @react-three/fiber + drei stack as Building3DView.tsx,
 * scaled to a single panel instead of a whole footprint.
 *
 * The optional straw fill is one big semi-transparent box spanning the
 * interior cavity (between the bottom/top skins) — illustrative, not a
 * true CSG cutout, so it visually overlaps the studs/girts/nailer at
 * their exact locations rather than wrapping around them. */
export default function StandardPanel3DView({ members, overallDimensions, displayName = "Panel", compact = false }: StandardPanel3DViewProps) {
  // Stage 4B: another company's design, browsed read-only. From Context, so
  // the ~3 call sites of this component need no new prop — see
  // BrowseModeContext.tsx.
  const browsing = useBrowsing();
  const [showStraw, setShowStraw] = useState(false);
  const canvasWidth = compact ? CANVAS_WIDTH_COMPACT : CANVAS_WIDTH;
  const canvasHeight = compact ? CANVAS_HEIGHT_COMPACT : CANVAS_HEIGHT;

  // R3F's own ResizeObserver-based canvas sizing can miss its container's
  // real settled size when mounted inside a StickyNote/title-block zone
  // that's still mid-open (a fresh-open animation or layout pass after
  // first paint) — the canvas silently falls back to the raw HTML <canvas>
  // default (300x150) instead of filling its parent. A follow-up window
  // resize event forces every ResizeObserver to re-measure; a small delay
  // lets the surrounding layout (StickyNote open transition, SheetTitleBlock
  // zone) settle first. Verified this actually fixes a real, reproducible
  // mis-sized canvas, not a hypothetical.
  useEffect(() => {
    const id = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    return () => window.clearTimeout(id);
  }, []);
  const widthFt = overallDimensions.widthIn / IN_PER_FT;
  const depthFt = overallDimensions.depthIn / IN_PER_FT;
  const heightFt = overallDimensions.heightIn / IN_PER_FT;
  const centerX = widthFt / 2;
  const centerY = heightFt / 2;
  const centerZ = depthFt / 2;
  const maxDim = Math.max(widthFt, heightFt, depthFt);

  const distance = maxDim * 1.7;
  const elevationRad = (ELEVATION_DEG * Math.PI) / 180;
  const azimuthRad = (AZIMUTH_DEG * Math.PI) / 180;
  const camHeight = centerY + distance * Math.sin(elevationRad);
  const camHorizontal = distance * Math.cos(elevationRad);
  const cameraPosition: [number, number, number] = [
    centerX + camHorizontal * Math.cos(azimuthRad),
    camHeight,
    centerZ + camHorizontal * Math.sin(azimuthRad),
  ];

  const strawVolume = useMemo(
    () => computeStandardPanelStrawVolume(members, overallDimensions),
    [members, overallDimensions],
  );

  // Interior cavity Z-bounds derived from the actual Z-capping skin members
  // (not a hardcoded thickness or member-name list) — matched generically by
  // role + a thin Z box size, so this works for a wall panel's own
  // "bottom/top_plate_skin" AND a header's "bottom/top_chord_ply" alike,
  // while correctly excluding a header's own full-height left/right end
  // caps (role "skin" too, but their Z size spans the whole panel, not a
  // thin cap). Falls back to the full envelope if a panel variant has no
  // Z-capping skins at all.
  const zCapSkins = members.filter((m) => m.role === "skin" && memberBoxSizeIn(m).zIn <= SKIN_THICKNESS_IN + 0.01);
  const bottomSkin = zCapSkins.reduce<PanelMember | null>((min, m) => (!min || m.position.zIn < min.position.zIn ? m : min), null);
  const topSkin = zCapSkins.reduce<PanelMember | null>((max, m) => (!max || m.position.zIn > max.position.zIn ? m : max), null);
  const interiorZStartIn = bottomSkin ? bottomSkin.position.zIn + memberBoxSizeIn(bottomSkin).zIn : 0;
  const interiorZEndIn = topSkin ? topSkin.position.zIn : overallDimensions.heightIn;
  const strawSizeFt: [number, number, number] = [widthFt, (interiorZEndIn - interiorZStartIn) / IN_PER_FT, depthFt];
  const strawCenterFt: [number, number, number] = [centerX, (interiorZStartIn + interiorZEndIn) / 2 / IN_PER_FT, centerZ];

  const handleDownloadObj = () => {
    const objText = buildPanelObj(members, displayName);
    const blob = new Blob([objText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${displayName.toLowerCase().replace(/\s+/g, "_")}.obj`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ width: "100%", maxWidth: canvasWidth }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: compact ? 3 : 6,
          marginBottom: compact ? 3 : 6,
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: compact ? 3 : 6, fontSize: compact ? 10 : 13 }}>
          <input type="checkbox" checked={showStraw} onChange={(e) => setShowStraw(e.target.checked)} />
          {compact ? "Straw" : "Show straw fill"}
        </label>
        {/* Stage 4B: no Download OBJ while a browsed design is on screen
            (decision 23). The straw-fill toggle and the model itself stay:
            they are the design, which browsing is for. */}
        {!browsing && (
          <button type="button" onClick={handleDownloadObj} style={{ fontSize: compact ? 9 : 12 }}>
            {compact ? "OBJ" : "Download OBJ"}
          </button>
        )}
      </div>
      <div style={{ width: "100%", maxWidth: canvasWidth, height: canvasHeight, border: "1px solid #ccc" }}>
        <Canvas camera={{ position: cameraPosition, fov: 45, near: 0.01, far: 1000 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[maxDim, maxDim * 2, maxDim]} intensity={0.8} />
          {showStraw && (
            <mesh position={strawCenterFt}>
              <boxGeometry args={strawSizeFt} />
              <meshStandardMaterial color={STRAW_COLOR} transparent opacity={0.55} />
            </mesh>
          )}
          <PanelMembersGroup members={members} />
          <OrbitControls target={[centerX, centerY, centerZ]} makeDefault />
        </Canvas>
      </div>
      {showStraw && !compact && (
        <p style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
          Straw fill volume: {strawVolume.strawVolumeFt3.toFixed(2)} ft³ (envelope {strawVolume.envelopeVolumeFt3.toFixed(2)} ft³ minus
          modeled wood/plywood {strawVolume.memberVolumeFt3.toFixed(2)} ft³). Illustrative — the fill isn&apos;t cut out around the
          studs/girts, so it visually overlaps them.
        </p>
      )}
    </div>
  );
}
