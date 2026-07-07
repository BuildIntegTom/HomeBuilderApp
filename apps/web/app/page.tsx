"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  applyBracedPlacement,
  buildOctagonFootprint,
  buildRectangleFootprint,
  cornerOwnership as cornerOwnershipPure,
  dragWall,
  editWallLength,
  footprintIsAllRightAngles,
  gapEndFor,
  getOpeningAnchors,
  insertBumpOut,
  isMiteredShape,
  markSafetyCorner,
  retile as retilePure,
  retileWithOpenings,
  wallGeometryFor as wallGeometryForPure,
  type CornerId,
  type Footprint,
  type PanelSlot,
  type Wall,
} from "@building-integrity/geometry";
import {
  computeAssemblyPerm,
  computeCarbonRange,
  computePrice,
  computeStandardPanelWoodWeight,
  computeStrawWeight,
  toReviewLog,
  validateVaporOpenness,
  type Season,
} from "@building-integrity/calc-engine";
import {
  bomWidthMismatchWarning,
  carbonFractionOfDryMass,
  cornerPanelWidthIn,
  fastenerTableStatus,
  foundationTypes,
  looseDensePackDefaultThicknessIn,
  looseDensePackThicknessOptionsIn,
  looseDensePackWidthIn,
  referenceDensities,
  seismicBracedPanelSpacingFt,
  shearLoadCapacity,
  standardPanelBomReferenceWidthIn,
  standardPanelHeightIn,
  standardWindowWidthsIn,
  strawMoistureContent,
  targetDensityKgM3,
  wallAssemblyLayers,
  type SeismicZone,
} from "@building-integrity/panel-catalog";
import styles from "./page.module.css";

const FootprintCanvas = dynamic(() => import("./FootprintCanvas"), { ssr: false });
const Building3DView = dynamic(() => import("./Building3DView"), { ssr: false });

const KG_TO_LB = 2.20462;
const LB_FT3_TO_KG_M3 = 16.018463;

const interiorLayers = wallAssemblyLayers.filter((l) => l.side === "interior");
const exteriorLayers = wallAssemblyLayers.filter((l) => l.side === "exterior");

const PHASE2_ASSUMPTIONS = [
  {
    label: "Safety/gap panel pricing",
    status: "pending-BI-confirmation" as const,
    note: "No distinct price rate given for safety/gap panels — priced at the standard rate ($28/sqft) as a placeholder.",
  },
  {
    label: "Header/sill panel area",
    status: "pending-BI-confirmation" as const,
    note: "Header/sill pricing uses the opening's width x full wall height (same area convention as every other panel type) — real header/sill components are shorter than a full wall panel, but their actual dimensions aren't specified yet.",
  },
];

type ShapeTool = "rectangle" | "octagon" | "bump-out" | "edit" | "drag-wall";

export default function LayoutEditor() {
  const [viewMode, setViewMode] = useState<"plan" | "3d">("plan");
  const [shapeTool, setShapeTool] = useState<ShapeTool>("rectangle");
  const [footprint, setFootprint] = useState<Footprint | null>(null);
  // Whether the current footprint has had a bump-out added since it was
  // last drawn from scratch — a bump-out'd shape has more free parameters
  // than "2 numbers regenerate the whole footprint", so per-wall length
  // editing is out of scope for it (see isWallLengthEditable below).
  const [isBumpedOut, setIsBumpedOut] = useState(false);
  // Which corner ids are "original" (present before any bump-out) vs
  // introduced by one — drives both which corners get a least-accessible
  // dot and which wall wins a reflex (inside) corner. Remapped through each
  // bump-out's renumbering by insertBumpOut itself.
  const [primaryCornerIds, setPrimaryCornerIds] = useState<Set<string>>(new Set());
  const [offsetPx, setOffsetPx] = useState({ x: 60, y: 60 });
  const [baseWallSlots, setBaseWallSlots] = useState<Record<string, PanelSlot[]>>({});
  const [leastAccessibleCorner, setLeastAccessibleCorner] = useState<CornerId>("A");

  const [standardWidthIn, setStandardWidthIn] = useState(looseDensePackWidthIn.value);
  const [thicknessIn, setThicknessIn] = useState(looseDensePackDefaultThicknessIn.value);
  const [densityLbFt3, setDensityLbFt3] = useState(
    Math.round((targetDensityKgM3.value / LB_FT3_TO_KG_M3) * 10) / 10,
  );
  const [wallHeightFt, setWallHeightFt] = useState(standardPanelHeightIn.value / 12);
  const [includeNailer, setIncludeNailer] = useState(false);
  const [interiorId, setInteriorId] = useState(interiorLayers[1]!.id);
  const [exteriorId, setExteriorId] = useState(exteriorLayers[1]!.id);
  const [season, setSeason] = useState<Season>("winter");

  const [seismicZone, setSeismicZone] = useState<SeismicZone>("moderate");
  const [foundationTypeId, setFoundationTypeId] = useState(foundationTypes[0]!.id);
  const [zipCode, setZipCode] = useState("");

  const interior = interiorLayers.find((l) => l.id === interiorId)!;
  const exterior = exteriorLayers.find((l) => l.id === exteriorId)!;
  const foundationType = foundationTypes.find((f) => f.id === foundationTypeId)!;

  const spacingIn = seismicBracedPanelSpacingFt[seismicZone] * 12;

  // `cornerOwnership`/`retile`/`wallGeometryFor` (imported above) are pure
  // functions from the geometry package — corner-ownership rules,
  // safety/gap-panel placement, per-wall tiling (see
  // packages/geometry/src/retile.ts for the full rationale, including the
  // reflex-corner gap fix that was originally verified by direct pixel
  // measurement). They take this component's panel parameters as explicit
  // arguments rather than closing over them, so these 3 names are
  // intentionally shadowed for the rest of this component with thin
  // partial applications supplying `thicknessIn`/`standardWidthIn`/
  // `cornerPanelWidthIn` — every call site below already expects the
  // closure-capturing signature these provide.
  const cornerOwnership = (fp: Footprint, primary: Set<string>) => cornerOwnershipPure(fp, primary, thicknessIn);
  const retile = (fp: Footprint, leastAccessible: CornerId, primary: Set<string>): Record<string, PanelSlot[]> =>
    retilePure(fp, leastAccessible, primary, standardWidthIn, cornerPanelWidthIn.value, thicknessIn);
  const wallGeometryFor = (wallId: string) =>
    footprint ? wallGeometryForPure(footprint, wallId, primaryCornerIds, leastAccessibleCorner, thicknessIn) : null;

  const handleDraw = (widthFt: number, depthFt: number, origin: { x: number; y: number }) => {
    const fp =
      shapeTool === "octagon" ? buildOctagonFootprint(widthFt, depthFt) : buildRectangleFootprint(widthFt, depthFt);
    // Corner ids aren't shared across shapes (rectangle uses "A".."D",
    // octagon "0".."7") — a fresh draw always resets which corner is
    // least-accessible, same as it already resets openings via retile.
    // Every corner of a freshly-drawn shape is "primary" (nothing's been
    // bumped out yet).
    const nextLeastAccessible = fp.corners[0]!.id;
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    setFootprint(fp);
    setIsBumpedOut(false);
    setPrimaryCornerIds(nextPrimary);
    setOffsetPx(origin);
    setLeastAccessibleCorner(nextLeastAccessible);
    setBaseWallSlots(retile(fp, nextLeastAccessible, nextPrimary));
    setShapeTool("edit");
  };

  // Re-tiles the whole wall from scratch around its openings (Tommy: resizing
  // an opening was leaving the rest of the wall protruding past the drawn
  // box instead of auto-adjusting the standard count and gap/borrowed
  // panel sizing) — see `retileWithOpenings`.
  const handleToggleOpening = (wallId: Wall["id"], slotIndex: number) => {
    const currentSlots = baseWallSlots[wallId] ?? [];
    const currentSlot = currentSlots[slotIndex];
    const geometry = wallGeometryFor(wallId);
    if (!currentSlot || !geometry) return;
    const cycle: Partial<Record<PanelSlot["type"], PanelSlot["type"]>> = {
      standard: "window",
      window: "door",
      door: "standard",
    };
    const nextType = cycle[currentSlot.type];
    if (!nextType) return; // corner/safety-gap untouched

    const anchors: { beforeStandardCount: number; type: "window" | "door"; widthIn: number }[] = [];
    let standardsSeen = 0;
    currentSlots.forEach((slot, i) => {
      const type = i === slotIndex ? nextType : slot.type;
      if (type === "window" || type === "door") {
        anchors.push({ beforeStandardCount: standardsSeen, type, widthIn: slot.widthIn });
      } else if (type === "standard") {
        standardsSeen++;
      }
    });

    const slots = retileWithOpenings(
      geometry.lengthIn,
      standardWidthIn,
      cornerPanelWidthIn.value,
      geometry.gapEnd,
      geometry.hasCornerStart,
      geometry.hasCornerEnd,
      anchors,
      geometry.allowBorrow,
    ).slots;
    setBaseWallSlots((prev) => ({
      ...prev,
      [wallId]: footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots,
    }));
  };

  const handleSetLeastAccessibleCorner = (cornerId: CornerId) => {
    setLeastAccessibleCorner(cornerId);
    if (footprint) {
      setBaseWallSlots(retile(footprint, cornerId, primaryCornerIds));
    }
  };

  const handleSetWindowWidth = (wallId: string, slotIndex: number, widthIn: number) => {
    const currentSlots = baseWallSlots[wallId] ?? [];
    const geometry = wallGeometryFor(wallId);
    if (!geometry) return;
    const precedingOpenings = currentSlots
      .slice(0, slotIndex)
      .filter((s) => s.type === "window" || s.type === "door").length;
    const anchors = getOpeningAnchors(currentSlots);
    if (!anchors[precedingOpenings]) return;
    anchors[precedingOpenings] = { ...anchors[precedingOpenings]!, widthIn };

    const slots = retileWithOpenings(
      geometry.lengthIn,
      standardWidthIn,
      cornerPanelWidthIn.value,
      geometry.gapEnd,
      geometry.hasCornerStart,
      geometry.hasCornerEnd,
      anchors,
      geometry.allowBorrow,
    ).slots;
    setBaseWallSlots((prev) => ({
      ...prev,
      [wallId]: footprint && isMiteredShape(footprint) ? markSafetyCorner(slots, geometry.gapEnd) : slots,
    }));
  };

  // An octagon is still just 2 numbers (widthFt/depthFt) under the hood —
  // recover them from whatever's currently drawn by reading the clip size
  // straight off one of the mitered diagonal walls (length = clip*sqrt2)
  // and adding it back onto a straight wall's length.
  const currentOctagonDims = (fp: Footprint) => {
    const clipFt = fp.walls.find((w) => w.id === "70")!.lengthFt / Math.SQRT2;
    const widthFt = fp.walls.find((w) => w.id === "01")!.lengthFt + 2 * clipFt;
    const depthFt = fp.walls.find((w) => w.id === "23")!.lengthFt + 2 * clipFt;
    return { widthFt, depthFt, clipFt };
  };

  // Editing one wall's length resizes the whole shape so the parallel wall
  // changes to match. Rectangle: AB/CD share the width, BC/DA share the
  // depth (opposite walls are always equal). Octagon: "01"/"45" are the
  // width-driven straight walls, "23"/"67" are depth-driven — same idea,
  // regenerating the whole octagon so both walls in a pair move together.
  // The 4 mitered diagonal walls aren't independently editable yet.
  const handleEditWallLength = (wallId: Wall["id"], newLengthFt: number) => {
    if (!footprint) return;
    if (isBumpedOut) {
      // A bump-out'd shape has too many free parameters for the "regenerate
      // from 2 numbers" shortcut below — fall back to the general per-wall
      // editor, which only ever moves the wall's own end corner and the
      // next wall's end corner (see editWallLength's own docs).
      const fp = editWallLength(footprint, wallId, newLengthFt);
      setFootprint(fp);
      setBaseWallSlots(retile(fp, leastAccessibleCorner, primaryCornerIds));
      return;
    }
    if (footprint.corners.length === 4) {
      const isWidthWall = wallId === "AB" || wallId === "CD";
      const currentWidthFt = footprint.walls.find((w) => w.id === "AB")!.lengthFt;
      const currentDepthFt = footprint.walls.find((w) => w.id === "BC")!.lengthFt;
      const fp = buildRectangleFootprint(
        isWidthWall ? newLengthFt : currentWidthFt,
        isWidthWall ? currentDepthFt : newLengthFt,
      );
      const nextPrimary = new Set(fp.corners.map((c) => c.id));
      setFootprint(fp);
      setPrimaryCornerIds(nextPrimary);
      setBaseWallSlots(retile(fp, leastAccessibleCorner, nextPrimary));
      return;
    }

    const isWidthWall = wallId === "01" || wallId === "45";
    const isDepthWall = wallId === "23" || wallId === "67";
    if (!isWidthWall && !isDepthWall) return; // diagonal walls: not editable yet
    const { widthFt, depthFt, clipFt } = currentOctagonDims(footprint);
    const fp = buildOctagonFootprint(
      isWidthWall ? newLengthFt + 2 * clipFt : widthFt,
      isDepthWall ? newLengthFt + 2 * clipFt : depthFt,
    );
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    setFootprint(fp);
    setPrimaryCornerIds(nextPrimary);
    setBaseWallSlots(retile(fp, leastAccessibleCorner, nextPrimary));
  };

  const isWallLengthEditable = (wallId: string): boolean => {
    if (!footprint) return false;
    // Bump-outs only ever introduce right-angle (never mitered) corners —
    // every wall on a bumped-out shape is editable via editWallLength.
    if (isBumpedOut) return true;
    if (footprint.corners.length === 4) return true;
    return wallId === "01" || wallId === "45" || wallId === "23" || wallId === "67";
  };

  // Corner ids get renumbered "0".."n-1" by insertBumpOut (same convention
  // as buildOctagonFootprint for a non-lettered shape), so the previous
  // least-accessible-corner id may no longer exist — reset it to the first
  // remaining *primary* corner, same spirit as a fresh draw (never one of
  // the 4 new corners, which never get a least-accessible dot — see
  // FootprintCanvas's corner-marker rendering). The result stays a
  // butt-joint (all right angles), so it keeps using the least-accessible-
  // corner marker, not the octagon's per-wall safety-corner rule.
  const handleAddBumpOut = (wallId: string, spanStartFt: number, spanEndFt: number, depthFt: number) => {
    if (!footprint) return;
    const { footprint: fp, primaryCornerIds: nextPrimary } = insertBumpOut(
      footprint,
      wallId,
      spanStartFt,
      spanEndFt,
      depthFt,
      primaryCornerIds,
    );
    const nextLeastAccessible = [...nextPrimary][0] ?? fp.corners[0]!.id;
    setFootprint(fp);
    setIsBumpedOut(true);
    setPrimaryCornerIds(nextPrimary);
    setLeastAccessibleCorner(nextLeastAccessible);
    setBaseWallSlots(retile(fp, nextLeastAccessible, nextPrimary));
    setShapeTool("edit");
  };

  // Drags one wall perpendicular to itself — its 2 neighbor walls absorb
  // the change, everything else (including the "opposite" wall on a plain
  // rectangle) stays fixed. Deliberately different from the typed-length
  // editor above, which mirrors the opposite wall on a plain rectangle —
  // this uniform "neighbors absorb" rule is used for every rectilinear
  // shape (plain rectangle or bump-out'd) since there's no well-defined
  // "opposite wall" once a shape's been bumped out.
  const handleDragWall = (wallId: string, offsetFt: number) => {
    if (!footprint) return;
    if (footprintIsAllRightAngles(footprint)) {
      const fp = dragWall(footprint, wallId, offsetFt);
      setFootprint(fp);
      setBaseWallSlots(retile(fp, leastAccessibleCorner, primaryCornerIds));
      setShapeTool("edit");
      return;
    }

    // Octagon: only the 4 straight walls are draggable (isWallLengthEditable
    // enforces this at pick time); a straight wall's neighbors are 45deg
    // diagonals, not perpendicular to it, so the "neighbors absorb" rule
    // above doesn't apply — instead, map the drag straight to a width/depth
    // change and regenerate the whole octagon symmetrically, same as the
    // typed-length editor's octagon branch. A single wall's perpendicular
    // move is half of the whole shape's width/depth delta, since
    // buildOctagonFootprint grows/shrinks symmetrically about the center.
    const isWidthWall = wallId === "01" || wallId === "45";
    const isDepthWall = wallId === "23" || wallId === "67";
    if (!isWidthWall && !isDepthWall) return; // diagonal walls: not draggable
    const { widthFt, depthFt } = currentOctagonDims(footprint);
    const fp = buildOctagonFootprint(
      isWidthWall ? widthFt + 2 * offsetFt : widthFt,
      isDepthWall ? depthFt + 2 * offsetFt : depthFt,
    );
    const nextPrimary = new Set(fp.corners.map((c) => c.id));
    setFootprint(fp);
    setPrimaryCornerIds(nextPrimary);
    setBaseWallSlots(retile(fp, leastAccessibleCorner, nextPrimary));
    setShapeTool("edit");
  };

  // For rendering: butting walls' content starts inset from the actual
  // corner point by the perpendicular wall's thickness, since they don't
  // own a corner panel there and instead butt against the other wall's
  // face. A reflex-corner winner's start needs the opposite treatment —
  // its content starts *before* its own nominal corner (a negative offset)
  // so it extends the extra `extraLengthIn` back into the losing wall's
  // territory; the length side of that extension is handled by `retile`/
  // `wallGeometryFor` adding `extraLengthIn` to the tiled length, which
  // naturally overshoots the wall's *end* corner if the extension is there
  // instead, with no separate offset needed.
  const wallRenderOffsetIn = useMemo(() => {
    if (!footprint) return {};
    const ownership = cornerOwnership(footprint, primaryCornerIds);
    const offsets: Record<string, number> = {};
    for (const wall of footprint.walls) {
      const { start } = ownership[wall.id]!;
      offsets[wall.id] = start.extraLengthIn > 0 ? -start.extraLengthIn : start.insetAmount;
    }
    return offsets;
  }, [footprint, thicknessIn, primaryCornerIds]);

  // Braced-panel placement is a derived overlay, recomputed from the base
  // slots every render — never stored, so toggling an opening back to
  // standard just falls out of recomputation instead of needing to be undone.
  const overlayWallSlots = useMemo(() => {
    const next: Record<string, PanelSlot[]> = {};
    for (const [wallId, slots] of Object.entries(baseWallSlots)) {
      next[wallId] = applyBracedPlacement(slots, spacingIn);
    }
    return next;
  }, [baseWallSlots, spacingIn]);

  const windowList = useMemo(() => {
    const items: { wallId: string; slotIndex: number; widthIn: number }[] = [];
    for (const [wallId, slots] of Object.entries(baseWallSlots)) {
      slots.forEach((s, i) => {
        if (s.type === "window") items.push({ wallId, slotIndex: i, widthIn: s.widthIn });
      });
    }
    return items;
  }, [baseWallSlots]);

  const allSlots = useMemo(() => Object.values(overlayWallSlots).flat(), [overlayWallSlots]);
  const strawSlots = allSlots.filter(
    (s) =>
      s.type === "corner" ||
      s.type === "safety-oct-corner" ||
      s.type === "standard" ||
      s.type === "safety-gap" ||
      s.type === "braced",
  );
  const woodEligibleCount = allSlots.filter((s) => s.type === "standard" || s.type === "braced").length;
  const openingCounts = useMemo(
    () => ({
      windows: allSlots.filter((s) => s.type === "window").length,
      doors: allSlots.filter((s) => s.type === "door").length,
    }),
    [allSlots],
  );

  const totalStrawWidthIn = strawSlots.reduce((sum, s) => sum + s.widthIn, 0);

  const strawWeight = useMemo(
    () =>
      computeStrawWeight(
        totalStrawWidthIn,
        thicknessIn,
        wallHeightFt * 12,
        densityLbFt3 * LB_FT3_TO_KG_M3,
      ),
    [totalStrawWidthIn, thicknessIn, wallHeightFt, densityLbFt3],
  );

  const woodPerPanel = useMemo(
    () => computeStandardPanelWoodWeight(includeNailer),
    [includeNailer],
  );
  const totalWoodWeightKg = woodEligibleCount * woodPerPanel.weightKg;
  const totalWeightKg = strawWeight.weightKg + totalWoodWeightKg;
  const totalWeightLb = totalWeightKg * KG_TO_LB;

  const price = useMemo(() => {
    const areaSqFtFor = (type: PanelSlot["type"]) =>
      (allSlots.filter((s) => s.type === type).reduce((sum, s) => sum + s.widthIn, 0) / 12) *
      wallHeightFt;
    return computePrice([
      // No distinct rate given for safety/gap panels — priced at the standard rate (assumption, see Review Log).
      { type: "standard", areaSqFt: areaSqFtFor("standard") + areaSqFtFor("safety-gap") },
      // safety-oct-corner is a fabrication-ID variant of the same corner panel, priced identically.
      { type: "corner", areaSqFt: areaSqFtFor("corner") + areaSqFtFor("safety-oct-corner") },
      { type: "braced", areaSqFt: areaSqFtFor("braced") },
      { type: "opening", areaSqFt: areaSqFtFor("window") + areaSqFtFor("door") },
    ]);
  }, [allSlots, wallHeightFt]);

  const carbonRange = useMemo(
    () =>
      computeCarbonRange(strawWeight.weightKg, strawMoistureContent, carbonFractionOfDryMass.value),
    [strawWeight.weightKg],
  );

  const permResult = useMemo(() => computeAssemblyPerm(interior, exterior, season), [interior, exterior, season]);
  const vaporCheck = useMemo(
    () => validateVaporOpenness(interior, exterior, season),
    [interior, exterior, season],
  );

  const reviewLog = useMemo(() => {
    const entries = toReviewLog([
      { label: "Target density", ...targetDensityKgM3 },
      { label: "Default panel thickness", ...looseDensePackDefaultThicknessIn },
      { ...interior, label: "Interior finish: " + interior.label },
      { ...exterior, label: "Exterior finish: " + exterior.label },
      { label: "Fastener spacing table", ...fastenerTableStatus },
      { label: "Shear / load capacity", ...shearLoadCapacity },
      { label: "Carbon fraction of dry mass", ...carbonFractionOfDryMass },
      { label: "Framing lumber density", ...referenceDensities.framingLumberLbFt3 },
      { label: "Standard window widths", ...standardWindowWidthsIn },
      { label: "Foundation type: " + foundationType.label, status: foundationType.status, note: foundationType.vaporNote },
      ...(standardWidthIn !== standardPanelBomReferenceWidthIn
        ? [{ label: "Wood-weight BOM vs. selected panel width", ...bomWidthMismatchWarning }]
        : []),
      ...PHASE2_ASSUMPTIONS,
    ]);
    return entries.filter((e, i) => entries.findIndex((o) => o.note === e.note) === i);
  }, [interior, exterior, foundationType, standardWidthIn]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Layout Editor</h1>
        <p className={styles.disclaimer}>
          Reference-only. Not engineered, not fabricator-produced. Single-story,
          exterior shell only.
        </p>
        <p className={styles.note}>
          <Link href="/sandbox">Simpler single-wall-run calculation sandbox →</Link>
        </p>

        <section>
          <h2>Site</h2>
          <label>
            Zip code{" "}
            <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          </label>
          <label>
            Seismic zone{" "}
            <select value={seismicZone} onChange={(e) => setSeismicZone(e.target.value as SeismicZone)}>
              <option value="high">High ({seismicBracedPanelSpacingFt.high}ft braced spacing)</option>
              <option value="moderate">Moderate ({seismicBracedPanelSpacingFt.moderate}ft braced spacing)</option>
              <option value="low">Low ({seismicBracedPanelSpacingFt.low}ft braced spacing)</option>
            </select>
          </label>
          <label>
            Foundation type{" "}
            <select value={foundationTypeId} onChange={(e) => setFoundationTypeId(e.target.value as typeof foundationTypeId)}>
              {foundationTypes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <p className={foundationType.status === "pending-BI-confirmation" ? styles.pending : styles.note}>
            {foundationType.vaporNote}
          </p>
        </section>

        <section>
          <h2>Panel parameters</h2>
          <label>
            Standard width (in){" "}
            <input
              type="number"
              value={standardWidthIn}
              onChange={(e) => setStandardWidthIn(Number(e.target.value))}
            />
          </label>
          <label>
            Thickness (in){" "}
            <select value={thicknessIn} onChange={(e) => setThicknessIn(Number(e.target.value))}>
              {looseDensePackThicknessOptionsIn.map((t) => (
                <option key={t} value={t}>
                  {t}&quot;
                </option>
              ))}
            </select>
          </label>
          <label>
            Target density (lb/ft3){" "}
            <input
              type="number"
              value={densityLbFt3}
              onChange={(e) => setDensityLbFt3(Number(e.target.value))}
            />
          </label>
          <label>
            Wall height (ft){" "}
            <input
              type="number"
              value={wallHeightFt}
              onChange={(e) => setWallHeightFt(Number(e.target.value))}
            />
          </label>
          <p className={styles.note}>
            Default 10ft (120in) is Panel Set 1&apos;s confirmed standard panel height.
          </p>
          <label>
            <input
              type="checkbox"
              checked={includeNailer}
              onChange={(e) => setIncludeNailer(e.target.checked)}
            />{" "}
            Include exterior nailer (optional, per standard panel BOM)
          </label>
        </section>

        <section>
          <h2>Footprint</h2>
          <p className={styles.note}>
            Choose a shape, then click and drag on the canvas to draw the
            footprint. Drawing a shape (or adding a bump-out) switches to Edit
            mode automatically.{" "}
            {footprint && footprintIsAllRightAngles(footprint)
              ? "In Edit mode, click a corner marker to mark it least-accessible — safety/gap panels re-place to the far end of each wall (this also clears any openings you've placed, since re-tiling re-derives all slots)."
              : "Every wall owns its own mitered corner panels — the left-most corner of each run (standing outside the shell) is automatically the safety-oct-corner panel, so there's no corner marker to set here."}
          </p>
          <div role="group" aria-label="View mode" className={styles.toolbar}>
            <button
              type="button"
              aria-pressed={viewMode === "plan"}
              className={viewMode === "plan" ? styles.toolActive : styles.tool}
              onClick={() => setViewMode("plan")}
            >
              2D Plan
            </button>
            <button
              type="button"
              aria-pressed={viewMode === "3d"}
              className={viewMode === "3d" ? styles.toolActive : styles.tool}
              onClick={() => setViewMode("3d")}
              disabled={!footprint}
            >
              3D Preview
            </button>
          </div>
          {viewMode === "plan" && (
            <>
              <div role="group" aria-label="Shape tool" className={styles.toolbar}>
                <button
                  type="button"
                  aria-pressed={shapeTool === "rectangle"}
                  className={shapeTool === "rectangle" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("rectangle")}
                >
                  Rectangle
                </button>
                <button
                  type="button"
                  aria-pressed={shapeTool === "octagon"}
                  className={shapeTool === "octagon" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("octagon")}
                >
                  Octagon
                </button>
                <button
                  type="button"
                  aria-pressed={shapeTool === "bump-out"}
                  className={shapeTool === "bump-out" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("bump-out")}
                  disabled={!footprint}
                >
                  Add Bump-out
                </button>
                <button
                  type="button"
                  aria-pressed={shapeTool === "drag-wall"}
                  className={shapeTool === "drag-wall" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("drag-wall")}
                  disabled={!footprint}
                >
                  Drag Wall
                </button>
                <button
                  type="button"
                  aria-pressed={shapeTool === "edit"}
                  className={shapeTool === "edit" ? styles.toolActive : styles.tool}
                  onClick={() => setShapeTool("edit")}
                  disabled={!footprint}
                >
                  Edit
                </button>
              </div>
              {shapeTool === "bump-out" && (
                <p className={styles.note}>
                  Drag along a wall to pick the span it attaches to, then drag
                  outward (an addition) or inward (a notch) to set the depth.
                </p>
              )}
              {shapeTool === "drag-wall" && (
                <p className={styles.note}>
                  Drag a wall to move it — its 2 neighbor walls stretch or
                  shrink to absorb the change; everything else stays fixed.
                  {footprint && !footprintIsAllRightAngles(footprint)
                    ? " On an octagon, only the 4 straight walls can be dragged (the mitered corners can't)."
                    : ""}
                </p>
              )}
            </>
          )}
          {viewMode === "3d" && (
            <p className={styles.note}>
              Drag to orbit, scroll to zoom — a rough bird's-eye starting
              angle, not a fixed camera. Walls are extruded to wall height
              only; no roof yet.
            </p>
          )}
          {viewMode === "plan" ? (
            <FootprintCanvas
              footprint={footprint}
              shapeTool={shapeTool}
              offsetPx={offsetPx}
              wallSlots={overlayWallSlots}
              wallStartOffsetIn={wallRenderOffsetIn}
              wallThicknessIn={thicknessIn}
              leastAccessibleCorner={leastAccessibleCorner}
              primaryCornerIds={primaryCornerIds}
              isWallLengthEditable={isWallLengthEditable}
              onDraw={handleDraw}
              onToggleOpening={handleToggleOpening}
              onSetLeastAccessibleCorner={handleSetLeastAccessibleCorner}
              onEditWallLength={handleEditWallLength}
              onAddBumpOut={handleAddBumpOut}
              onDragWall={handleDragWall}
            />
          ) : (
            <Building3DView
              footprint={footprint}
              wallHeightFt={wallHeightFt}
              thicknessIn={thicknessIn}
              primaryCornerIds={primaryCornerIds}
            />
          )}
          {viewMode === "plan" && (
            <p className={styles.note}>
              {shapeTool === "edit"
                ? "Click a tan panel to cycle it: standard → window → door → standard."
                : "Switch to Edit mode, then click a tan panel to cycle it: standard → window → door → standard."}{" "}
              Gray = corner, dark brown = safety-oct-corner, purple = braced,
              orange = safety/gap.{" "}
              {isBumpedOut ? (
                <>Red circle = least-accessible corner. Click a wall&apos;s
                  length label to type an exact value — editing one wall moves
                  its far corner and shifts the next wall to match, leaving
                  the rest of the shape in place.</>
              ) : footprint?.corners.length === 4 ? (
                <>Red circle = least-accessible corner. Click a wall&apos;s
                  length label to type an exact value (e.g. 40 or
                  40&apos;-6&quot;) — editing one wall resizes the whole
                  rectangle since opposite walls stay equal.</>
              ) : footprint && footprintIsAllRightAngles(footprint) ? (
                "Red circle = least-accessible corner."
              ) : (
                <>Click a straight wall&apos;s length label to resize it — the
                  parallel wall changes to match. The 4 mitered corner walls
                  aren&apos;t independently editable yet.</>
              )}{" "}
              Or switch to Drag Wall and drag a wall directly instead of
              typing a length.
            </p>
          )}
        </section>

        {windowList.length > 0 && (
          <section>
            <h2>Windows</h2>
            {windowList.map(({ wallId, slotIndex, widthIn }) => (
              <label key={`${wallId}-${slotIndex}`}>
                Wall {wallId}, window #{slotIndex}{" "}
                <select
                  id={`window-size-${wallId}-${slotIndex}`}
                  value={widthIn}
                  onChange={(e) => handleSetWindowWidth(wallId, slotIndex, Number(e.target.value))}
                >
                  {standardWindowWidthsIn.value.map((w) => (
                    <option key={w} value={w}>
                      {w}&quot;
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </section>
        )}

        <section>
          <h2>Wall assembly (vapor check)</h2>
          <label>
            Interior finish{" "}
            <select value={interiorId} onChange={(e) => setInteriorId(e.target.value)}>
              {interiorLayers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Exterior finish{" "}
            <select value={exteriorId} onChange={(e) => setExteriorId(e.target.value)}>
              {exteriorLayers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Season{" "}
            <select value={season} onChange={(e) => setSeason(e.target.value as Season)}>
              <option value="winter">Winter</option>
              <option value="summer">Summer</option>
            </select>
          </label>
        </section>

        <section>
          <h2>Project totals</h2>
          <table className={styles.results}>
            <tbody>
              <tr>
                <td>Panels (excl. openings)</td>
                <td>{strawSlots.length}</td>
              </tr>
              <tr>
                <td>Openings</td>
                <td>
                  {openingCounts.windows} window{openingCounts.windows === 1 ? "" : "s"}, {openingCounts.doors} door
                  {openingCounts.doors === 1 ? "" : "s"}
                </td>
              </tr>
              <tr>
                <td>Total weight</td>
                <td>
                  {totalWeightLb.toFixed(1)} lb ({totalWeightKg.toFixed(1)} kg)
                  <br />
                  <span className={styles.note}>
                    Straw: {strawWeight.weightLb.toFixed(1)} lb. Wood ({woodEligibleCount} standard/braced
                    panels{includeNailer ? ", with nailer" : ""}): {(totalWoodWeightKg * KG_TO_LB).toFixed(1)} lb.
                    Corner and safety-gap panels&apos; wood not modeled (no BOM yet). Fasteners not modeled.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Price</td>
                <td>
                  ${price.toFixed(2)}
                  <span className={styles.note}>
                    {" "}
                    — priced per panel type (standard/corner/braced/opening rates), see Review Log
                  </span>
                </td>
              </tr>
              <tr>
                <td>Carbon sequestered</td>
                <td>
                  {carbonRange.atStandardMoisture.carbonLb.toFixed(1)} lb (
                  {carbonRange.atStandardMoisture.carbonKg.toFixed(1)} kg) @{" "}
                  {(strawMoistureContent.standard * 100).toFixed(0)}% moisture (standard)
                  <br />
                  <span className={styles.note}>
                    Range {(strawMoistureContent.min * 100).toFixed(0)}%–
                    {(strawMoistureContent.max * 100).toFixed(0)}% moisture:{" "}
                    {carbonRange.atMaxMoisture.carbonLb.toFixed(1)}–
                    {carbonRange.atMinMoisture.carbonLb.toFixed(1)} lb. Straw only — wood carbon not included.
                  </span>
                </td>
              </tr>
              <tr>
                <td>Shear / load capacity</td>
                <td className={styles.pending}>not yet modeled — {shearLoadCapacity.note}</td>
              </tr>
              <tr>
                <td>Assembly permeance ({season})</td>
                <td>
                  {permResult.computable
                    ? `${permResult.permTotal!.toFixed(2)} perm`
                    : "not computable — one or both finishes lack a numeric perm rating"}
                </td>
              </tr>
              <tr>
                <td>Vapor-openness rule</td>
                <td className={vaporCheck.passes === false ? styles.fail : undefined}>
                  {vaporCheck.computable
                    ? vaporCheck.passes
                      ? "PASS — exterior is more vapor-open than interior"
                      : "FAIL — exterior is not more vapor-open than interior"
                    : "not computable — one or both finishes lack a numeric perm rating"}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Review Log — Items for Engineer/Contractor Review</h2>
          {reviewLog.length === 0 ? (
            <p>No pending values used in this calculation.</p>
          ) : (
            <ul>
              {reviewLog.map((entry, i) => (
                <li key={i}>
                  <strong>{entry.label}:</strong> {entry.note}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
