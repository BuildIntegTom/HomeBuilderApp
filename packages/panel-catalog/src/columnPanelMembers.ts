import type { PanelComponentSchema, PanelMember, PanelSpacePoint2D } from "./componentSchema";
import { ROOF_CATCHER_BEAM_DEPTH_IN } from "./roofCatcherBeamMembers";
import { buildGableCornerStuds } from "./gablePanelMembers";
import {
  LUMBER_SPECIES_GRADE,
  PLATE_2X4_THICKNESS_IN,
  PLATE_2X4_WIDTH_IN,
  PLATE_END_CLEARANCE_IN,
  SKIN_THICKNESS_IN,
  buildCornerStuds,
  LEGACY_GIRT_STYLE,
  buildGirtRows,
  type GirtStyle,
  buildNailer,
  buildPlates,
  buildSkins,
  shiftTrapezoidCorners,
  cutRingGirtsAroundVerticals,
} from "./panelMemberHelpers";

/**
 * Shared construction behind both the Column Panel and the Corner Panel
 * (Tommy: "corner panels are just like this too actually, so let's copy
 * everything over for them too") — a 24in-wide Standard Panel core with a
 * 3/4in plywood face glued/nailed onto both tall/long (vertical) sides,
 * full height x panel thickness each, making the overall unit 25.5in wide.
 * Tommy: "keeps measurements easy in the shop."
 */
export const COLUMN_CORE_WIDTH_IN = 24;
export const COLUMN_SIDE_PLY_THICKNESS_IN = 0.75;
export const COLUMN_TOTAL_WIDTH_IN = COLUMN_CORE_WIDTH_IN + 2 * COLUMN_SIDE_PLY_THICKNESS_IN; // 25.5
export const COLUMN_SIDE_PLY_SPEC = "3/4in_5ply_CDX";
const COLUMN_GIRT_ROW_COUNT = 2; // same as the Standard Panel core it's built from
const COLUMN_BLOCKING_SPACING_IN = 16; // Tommy: 2x4 blocking every 16in, both sides, in addition to girts

/** Default beam-depth allowance (Tommy) for a Column Panel used as roof-
 * catcher-beam bearing at a Gable End (when the roof is structural panels
 * rather than trusses — see the gable-multistory-roof-strategy memory).
 * ⚠ **READ FROM THE BEAM, not written out again.** It is a real 2x12's
 * actual depth (11.25in, not the 12in nominal) — Tommy: "spawn in 3 2x12
 * dimensional lumber pieces" for the roof-catcher beam itself (see
 * buildRoofCatcherBeamMembers), which bears directly on top of the column,
 * its own top face flush with the gable peak.
 *
 * It was its own literal 11.25 until 2026-11-01. That made FOUR numbers for
 * one joint, and the one the gable row actually used was the nominal 12, so
 * the beam floated 0.75in above the panel carrying it (B9). Deriving it means
 * a change to the beam cannot leave this behind. */
export const DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN = ROOF_CATCHER_BEAM_DEPTH_IN;

/**
 * Column Panel height when bearing a roof-catcher beam between two Gable
 * End Panels (Tommy: "column panel...11.25in down from the peak (so it can
 * catch a beam)" — shorter than the peak by the beam's own depth). Real
 * geometry now — see WallElevationView.tsx, which spawns a Column Panel
 * centered under the peak whenever a wall has "Add Gable End" on and isn't
 * snapped to a shed roof.
 */
export function computeGableColumnHeightIn(
  gablePeakHeightIn: number,
  offsetIn: number = DEFAULT_GABLE_COLUMN_HEIGHT_OFFSET_IN,
): number {
  return gablePeakHeightIn - offsetIn;
}

/** Shifts every member's X position by `deltaXIn` — used to slide the
 * 24in-wide core over so it sits centered between the two side plywood
 * faces, without needing every helper in panelMemberHelpers.ts to accept
 * an X offset of its own. Also shifts `trapezoidCornersIn` (a true beveled
 * brace's actual rendered geometry, stored as absolute panel-space
 * corners — see memberLocalCornersIn) when present — no diagonal-braced
 * member passes through here today (Column Panels have no bracing), but
 * this mirrors the fix applied to openingAssemblyMembers.ts's own
 * shiftAndPrefix, which shipped exactly this same bug for header braces
 * by only shifting position.xIn/zIn and leaving the corners stale. */
function shiftMembersX(members: PanelMember[], deltaXIn: number): PanelMember[] {
  return members.map((m) => ({
    ...m,
    position: {
      ...m.position,
      xIn: m.position.xIn + deltaXIn,
      trapezoidCornersIn: shiftTrapezoidCorners(m.position.trapezoidCornersIn, deltaXIn, 0),
    },
  }));
}

/**
 * Number of 2x4 blocking rows spaced `COLUMN_BLOCKING_SPACING_IN` apart,
 * starting one spacing up from the bottom of the stud span (matching
 * ordinary "blocking every 16in o.c." framing convention) — an
 * interpretation of Tommy's spec, not independently confirmed against a
 * shop drawing.
 *
 * ⚠ **A ROW IS ONLY COUNTED IF IT FITS UNDER THE TOP PLATE, and until
 * 2026-11-13 that was not checked.** This read `floor(studSpanIn / 16)`,
 * which is wrong twice over:
 *
 *   - `studSpanIn` is the height less the two SKINS only (`heightIn - 1.5`),
 *     so it is 3in longer than the clear space between the two plate 2x4s
 *     that the blocking actually has to live in.
 *   - A row is itself `PLATE_2X4_WIDTH_IN` (3 1/2in) tall, laid on edge, and
 *     the count never allowed for its own width.
 *
 * Together those put the last row through the top plate at some heights and
 * clean at others, which is why the one height `memberOverlap.test.ts`
 * sampled never saw it. Measured on a plain Column Panel: at 50in, row 3 sat
 * at z 48.75-52.25 on a 50in panel — through the top plate 2x4, through the
 * top skin, and 2 1/4in out of the top of the panel. At 84in, row 5 did the
 * same. At 40, 60, 72, 96 and 120in nothing was wrong.
 *
 * A row that does not fit is simply not built, which is what a framer does:
 * the top plate is the backing at the top of the face, so the last short
 * interval needs no blocking of its own. The correction therefore only ever
 * REMOVES a row that could not be built, and it changes the count at exactly
 * those two heights — every other height above is unmoved.
 */
export function computeColumnBlockingRowCount(studSpanIn: number): number {
  /* Row `n`'s far face sits at `SKIN + SPACING*n + WIDTH`, and the top plate
     2x4's near face at `height - SKIN - PLATE`. With `studSpanIn = height -
     2*SKIN`, requiring the former to clear the latter reduces to this. */
  const usableIn = studSpanIn - PLATE_2X4_THICKNESS_IN - PLATE_2X4_WIDTH_IN;
  return Math.max(0, Math.floor(usableIn / COLUMN_BLOCKING_SPACING_IN));
}

/** 2x4 blocking between the vertical corner studs, on both the interior
 * and exterior face, stacked every 16in up the stud span — backing/lateral
 * bracing for the side plywood faces, in addition to (not instead of) the
 * core's own girt rows. Tommy: "blocking...need to be on the interior and
 * exterior face - between the studs going the other way (parallel to the
 * primary perimeter line) and are the same length (but on edge rather than
 * flat) as the 2x4 runners of the top and bottom plates." Runs along X
 * (`orientation: "horizontal"`, `rotationDeg: 0` — per `memberBoxSizeIn`'s
 * own vocabulary, "on edge, spanning X": X=length, Y=thickness, Z=width),
 * matching `buildPlates`' own plate-runner orientation exactly, not the
 * old "on edge, spanning Y" (rotationDeg 90) that ran front-to-back at the
 * panel's 2 X-extremes instead of side-to-side between the studs.
 *
 * Length/position reuse `PLATE_END_CLEARANCE_IN` directly — the exact same
 * constant `buildPlates` uses for its own `plateLengthIn` — so blocking's
 * length is guaranteed to track the plate runners' length ("same length...
 * as the runners") rather than an independently-derived formula that could
 * drift from it. `PLATE_END_CLEARANCE_IN` (1.5) happens to numerically
 * equal `PLATE_2X4_THICKNESS_IN` (1.5) for this core, so this also lands
 * exactly on the studs' own inner faces ("same distance between the studs
 * horizontally") — flagged here so an independent future change to either
 * constant doesn't silently break that framing unnoticed. */
function buildColumnBlocking(depthIn: number, studSpanIn: number, coreWidthIn: number = COLUMN_CORE_WIDTH_IN): PanelMember[] {
  const lengthIn = coreWidthIn - 2 * PLATE_END_CLEARANCE_IN;
  const rowCount = computeColumnBlockingRowCount(studSpanIn);
  const members: PanelMember[] = [];
  for (let row = 1; row <= rowCount; row++) {
    const zIn = SKIN_THICKNESS_IN + COLUMN_BLOCKING_SPACING_IN * row;
    for (const [face, yIn] of [
      ["exterior", 0],
      ["interior", depthIn - PLATE_2X4_THICKNESS_IN],
    ] as const) {
      members.push({
        memberId: `blocking_${row}_${face}`,
        material: "dimensional_lumber",
        speciesGrade: LUMBER_SPECIES_GRADE,
        plySpec: null,
        nominalSize: "2x4",
        actualDimsIn: { thicknessIn: PLATE_2X4_THICKNESS_IN, widthIn: PLATE_2X4_WIDTH_IN, lengthIn },
        orientation: "horizontal",
        position: { xIn: PLATE_END_CLEARANCE_IN, yIn, zIn, rotationDeg: 0 },
        role: "blocking",
        qty: 1,
        notes: `Blocking row ${row} of ${rowCount}, ${face} face — between the corner studs, on edge, matching the plate runners' own length.`,
      });
    }
  }
  return members;
}

/** 3/4in plywood faces on both tall/long sides, full height x panel
 * thickness — the "safety buffer"-style side cladding that makes the core
 * 25.5in wide overall. */
function buildColumnSidePly(
  depthIn: number,
  heightIn: number,
  coreWidthIn: number = COLUMN_CORE_WIDTH_IN,
): PanelMember[] {
  return (["left", "right"] as const).map((side) => ({
    memberId: `side_ply_${side}`,
    material: "plywood",
    speciesGrade: null,
    plySpec: COLUMN_SIDE_PLY_SPEC,
    nominalSize: null,
    actualDimsIn: { thicknessIn: COLUMN_SIDE_PLY_THICKNESS_IN, widthIn: depthIn, lengthIn: heightIn },
    orientation: "vertical",
    position: {
      xIn: side === "left" ? 0 : coreWidthIn + COLUMN_SIDE_PLY_THICKNESS_IN,
      yIn: 0,
      zIn: 0,
      rotationDeg: 0,
    },
    role: "skin",
    qty: 1,
    notes: `${side} face, full height x panel thickness.`,
  }));
}

/**
 * Every physical member of a Column Panel: a 24in-wide Standard Panel core
 * (skins, plate 2x4s, 4 corner studs, 2 girt rows, optional nailer) shifted
 * over by `COLUMN_SIDE_PLY_THICKNESS_IN` so it sits between two 3/4in
 * plywood side faces, plus 2x4 blocking every 16in on both edges. Overall
 * width = `COLUMN_TOTAL_WIDTH_IN` (25.5in), independent of the app's
 * user-selected `standardWidthIn` — a Column Panel is always this size.
 */
export function buildColumnPanelMembers(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  /** The project's girt style. Defaults to `LEGACY_GIRT_STYLE`, which is what
   * this app built before girts had styles — never to the project default,
   * so an un-taught call site draws a stale panel rather than a wrong one. */
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
): PanelMember[] {
  return buildColumnStyleMembers(COLUMN_TOTAL_WIDTH_IN, depthIn, heightIn, includeNailer, girtStyle);
}

/**
 * ⚠ **A COLUMN BODY WHOSE TOP IS NOT FLAT — one shared top assembly, supplied
 * by the caller.**
 *
 * This exists for exactly one part: the five-sided Gable Peak Panel, whose top
 * is two sloped planes meeting at a ridge. That panel cannot be composed from
 * a finished column plus a finished cap, because **each prefab piece carries
 * its own skins**: stack them and the joint has two 3/4in sheets of plywood in
 * it; drop the cap's and it has a 3/4in void. Both were measured.
 *
 * So the body stops bringing a top assembly at all and the caller's spans the
 * whole panel. What the body still needs to know is where that assembly sits:
 *
 *   - `topSurfaceAtXIn` — the panel's finished top FACE, which the two side
 *     plywood faces are cut to. (On a flat column the side ply runs to the
 *     panel's full height and is flush with the top skin; raked, it is the
 *     same sheet with a raked top edge.)
 *   - `undersideAtXIn` — the BOTTOM of that assembly, which the corner studs
 *     are cut to, the way a gable panel's are.
 *   - `lowestUndersideZIn` — the lowest that underside gets anywhere across
 *     the panel. Girts and blocking are laid out to clear it, which is the
 *     same answer `gableGirtPlan` gives by spacing a gable's girts off its
 *     SHORT edge.
 *
 * ⚠ **`lowestUndersideZIn` is what resolves the 0.12in nobody should accept.**
 * A sloped skin-and-plate assembly cut plumb stands `(3/4 + 1 1/2) / cos θ`
 * tall — 2.372in at 4:12, not 2.25in. Simply filtering the body's three top
 * members out would leave its studs stopping at `height - 2.25` while the
 * assembly above them wants `height - 2.372`: a 0.122in gap, small and
 * perfectly real. Reading the studs off `undersideAtXIn` lands them on the
 * assembly exactly, at every pitch.
 *
 * Both x arguments are in FULL-PANEL coordinates (0 at the left side ply's
 * outer face), not the 24in core's.
 */
export interface ColumnRakedTop {
  topSurfaceAtXIn: (xIn: number) => number;
  undersideAtXIn: (xIn: number) => number;
  lowestUndersideZIn: number;
}

/** The two side plywood faces, cut to a raked top edge instead of a square
 * one. Same sheet, same thickness, same role — `trapezoidCornersIn` carries
 * the rake, exactly as a gable's corner studs and top boards do. */
function buildRakedColumnSidePly(depthIn: number, coreWidthIn: number, rakedTop: ColumnRakedTop): PanelMember[] {
  return (["left", "right"] as const).map((side) => {
    const nearXIn = side === "left" ? 0 : coreWidthIn + COLUMN_SIDE_PLY_THICKNESS_IN;
    const farXIn = nearXIn + COLUMN_SIDE_PLY_THICKNESS_IN;
    const nearTopZIn = rakedTop.topSurfaceAtXIn(nearXIn);
    const farTopZIn = rakedTop.topSurfaceAtXIn(farXIn);
    return {
      memberId: `side_ply_${side}`,
      material: "plywood" as const,
      speciesGrade: null,
      plySpec: COLUMN_SIDE_PLY_SPEC,
      nominalSize: null,
      /* The LONG POINT, like every other angle-cut member in this app. */
      actualDimsIn: {
        thicknessIn: COLUMN_SIDE_PLY_THICKNESS_IN,
        widthIn: depthIn,
        lengthIn: Math.max(nearTopZIn, farTopZIn),
      },
      orientation: "vertical" as const,
      position: {
        xIn: nearXIn,
        /* The CENTRE of the depth — `trapezoidDepthIn`'s own convention. */
        yIn: depthIn / 2,
        zIn: 0,
        rotationDeg: 0,
        trapezoidCornersIn: [
          { xIn: nearXIn, zIn: 0 },
          { xIn: farXIn, zIn: 0 },
          { xIn: farXIn, zIn: farTopZIn },
          { xIn: nearXIn, zIn: nearTopZIn },
        ] as [PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D, PanelSpacePoint2D],
        trapezoidDepthIn: depthIn,
      },
      role: "skin" as const,
      qty: 1,
      notes:
        `${side} face, panel thickness x full height, top edge cut to the roof rake so it finishes flush with the ` +
        `shared top assembly. Long point ${Math.max(nearTopZIn, farTopZIn).toFixed(3)}in, short point ${Math.min(nearTopZIn, farTopZIn).toFixed(3)}in.`,
    };
  });
}


/**
 * The same construction at a GIVEN overall width — the Corner Panel's builder
 * (see `buildCornerPanelMembers`), and the only reason this is separate from
 * `buildColumnPanelMembers`.
 *
 * **Why a corner panel needs it and a column panel does not.** A Column Panel
 * is always `COLUMN_TOTAL_WIDTH_IN`; nothing in the app ever asks for another
 * one. A **corner** slot is not fixed at all: the tiler clamps it down on a
 * wall too short for it, merges two of them into one, and — since corner
 * absorb — widens a pair to share a wall in the 51in-75.5in band. So a corner
 * slot's real width runs the whole `panelWidthInRange`, and Tommy confirmed
 * (2026-09-25) that the part can be built that way: *"Yes — any width in the
 * 24-48in band."*
 *
 * **The defect this fixes, which was live before it.** `buildCornerPanelMembers`
 * was `buildColumnPanelMembers` re-exported, so a 36in corner slot was framed
 * with 25.5in of members — **10.5in short in Framed 3D, in the OBJ export, and
 * on the per-unique-panel shop fabrication page, which described a 25.5in panel
 * for a 36in part.** A shop sheet describing the wrong width is a part cut
 * wrong.
 *
 * Nothing about the construction is invented here: every member that scales
 * with width already took a width argument (`buildSkins`/`buildPlates`/
 * `buildCornerStuds`/`buildGirtRows` — a Standard Panel has used them at any
 * width from 15.75in to 48in since it existed), the blocking length tracks the
 * plate runners exactly as Tommy specified, and the two 3/4in side plywood
 * faces stay 3/4in. The core is simply `totalWidthIn` less those two faces.
 *
 * ⚠ **Structural estimates deliberately do NOT use this.** A wider section
 * reports a HIGHER built-up bearing capacity (see
 * `computeBuiltUpColumnBearingCapacityLb`, which derives I and r from these
 * members' real positions), and nobody has confirmed that a widened corner's
 * cladding braces the section the same way. Bearing is still taken from the
 * nominal 25.5in build, which is the conservative direction. Recorded in the
 * spec's `## Open Items` — *"Does a WIDER corner panel carry more axial
 * load?"* — rather than quietly improved. (That item was added to the list
 * 2026-09-26; this pointer previously named an Open Items list the question was
 * not actually in.)
 */
export function buildColumnStyleMembers(
  totalWidthIn: number,
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  /** The project's girt style. Defaults to `LEGACY_GIRT_STYLE`, which is what
   * this app built before girts had styles — never to the project default,
   * so an un-taught call site draws a stale panel rather than a wrong one. */
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
  /** ⚠ **Off by default, and ordinary wall columns must keep it that way.**
   * See `ColumnRakedTop`. Omitted, every member below is byte-identical to
   * what this builder has always returned — `columnPanelMembers.test.ts`
   * holds that, because a Column Panel and a Corner Panel both come through
   * here and neither has any business changing shape for the Gable Peak. */
  rakedTop?: ColumnRakedTop,
): PanelMember[] {
  /* ⚠ **The span girts and blocking are laid out in, which a raked top
     SHORTENS.** On a flat panel it is skin face to skin face. Raked, the top
     assembly hangs lower than a flat one at its lowest point, so the
     equivalent flat panel is the one whose top plate's underside sits there —
     `lowestUndersideZIn + PLATE + SKIN` tall, giving this span. That is what
     keeps `computeColumnBlockingRowCount`'s own "does the last row clear the
     top plate" check honest under a slope; it only ever removes a row. */
  const studSpanIn = rakedTop
    ? rakedTop.lowestUndersideZIn + PLATE_2X4_THICKNESS_IN - SKIN_THICKNESS_IN
    : heightIn - 2 * SKIN_THICKNESS_IN;
  const coreWidthIn = totalWidthIn - 2 * COLUMN_SIDE_PLY_THICKNESS_IN;
  // A width at or under the two side faces leaves no core to build. Defensive
  // only — no caller can produce it today (the narrowest corner slot the tiler
  // emits is a clamped corner on a wall the run-stop refusal already rejects
  // below 24in) — and it returns the faces that DO fit rather than lumber of
  // negative length, which would reach the cut list as a real part.
  if (coreWidthIn <= 0) return buildColumnSidePly(depthIn, heightIn, Math.max(0, coreWidthIn));
  /* ⚠ **A RAKED BODY BRINGS NO TOP ASSEMBLY — the caller's spans the whole
     panel.** Exactly three members go: the top skin and the two top plate
     2x4s. Everything below them is unchanged, which is why the bottom
     assembly still comes straight out of the shared helpers. */
  const core: PanelMember[] = [
    ...buildSkins(coreWidthIn, depthIn, heightIn).filter((m) => !rakedTop || m.memberId !== "top_plate_skin"),
    ...buildPlates(coreWidthIn, depthIn, heightIn).filter((m) => !rakedTop || !m.memberId.startsWith("top_plate_")),
    /* ⚠ Cut to the rake, by the GABLE's own corner-stud builder — see
       `ColumnRakedTop`. Its x is core-local and the profile's is full-panel,
       so the function is composed with the side ply's thickness here and the
       studs are shifted by the same amount with the rest of the core below. */
    ...(rakedTop
      ? buildGableCornerStuds(
          coreWidthIn,
          depthIn,
          rakedTop.undersideAtXIn(COLUMN_SIDE_PLY_THICKNESS_IN) - SKIN_THICKNESS_IN,
          rakedTop.undersideAtXIn(totalWidthIn - COLUMN_SIDE_PLY_THICKNESS_IN) - SKIN_THICKNESS_IN,
          (xIn) => rakedTop.undersideAtXIn(xIn + COLUMN_SIDE_PLY_THICKNESS_IN),
        )
      : buildCornerStuds(coreWidthIn, depthIn, heightIn)),
    ...buildGirtRows(COLUMN_GIRT_ROW_COUNT, coreWidthIn, depthIn, studSpanIn, undefined, girtStyle),
  ];
  /* A raked panel's nailer is sized off its SHORT point, the same answer
     `buildGablePanelMembers` gives (`Math.min` of its two edges). No caller
     asks for one today — the Gable Peak Panel refuses a centre nailer
     outright, because the furring box stands where it would. */
  if (includeNailer) {
    core.push(
      buildNailer(
        coreWidthIn,
        /* The flat panel this one is equivalent to at its SHORT point: the
           nailer's length is taken off a panel height, and under a rake the
           honest height is the one whose top plate sits on the lowest part of
           the shared assembly. */
        rakedTop ? rakedTop.lowestUndersideZIn + SKIN_THICKNESS_IN + PLATE_2X4_THICKNESS_IN : heightIn,
      ),
    );
  }

  /* ⚠ Cut AFTER the shift, not before: the ring and the verticals it is cut
     around both move by the side ply's thickness, and the pass reads real
     positions. See `cutRingGirtsAroundVerticals`. */
  return cutRingGirtsAroundVerticals(
    [
      ...shiftMembersX(core, COLUMN_SIDE_PLY_THICKNESS_IN),
      ...shiftMembersX(buildColumnBlocking(depthIn, studSpanIn, coreWidthIn), COLUMN_SIDE_PLY_THICKNESS_IN),
      ...(rakedTop
        ? buildRakedColumnSidePly(depthIn, coreWidthIn, rakedTop)
        : buildColumnSidePly(depthIn, heightIn, coreWidthIn)),
    ],
    depthIn,
  );
}

/**
 * Wraps `buildColumnPanelMembers` in the full shared component schema —
 * see `buildStandardPanelSchema`'s doc comment for the same rationale.
 */
export function buildColumnPanelSchema(
  depthIn: number,
  heightIn: number,
  includeNailer: boolean,
  /** The project's girt style. Defaults to `LEGACY_GIRT_STYLE`, which is what
   * this app built before girts had styles — never to the project default,
   * so an un-taught call site draws a stale panel rather than a wrong one. */
  girtStyle: GirtStyle = LEGACY_GIRT_STYLE,
): PanelComponentSchema {
  return {
    schemaVersion: "0.1",
    componentType: "panel",
    id: "column_panel",
    displayName: "Column Panel",
    status: "draft",
    derivedFrom: "standard_panel",
    overallDimensions: { heightIn, widthIn: COLUMN_TOTAL_WIDTH_IN, depthIn },
    members: buildColumnPanelMembers(depthIn, heightIn, includeNailer, girtStyle),
    fasteners: [],
    notes: [
      {
        type: "deviation",
        text: "Blocking row count/spacing (every 16in o.c.) is an interpretation of Tommy's spec, not independently confirmed against a shop drawing.",
      },
    ],
    disclaimer: "Reference only — not engineered, not for construction.",
  };
}
