/**
 * ROOF BRACING, PHASE 3 STRIDE 2 — cutting the plane-wide figure into the
 * pieces that individual roof panels are actually built with.
 *
 * Stride 1 drew the figure on the whole plane: one X per bay plus four
 * carrots, in plane coordinates. Nothing in it knows that a roof plane is
 * delivered as a row of panels. **A brace drawn across a plane is not a
 * part.** The parts are the pieces of it that fall inside each panel, because
 * a panel is what the shop builds and what the truck carries, and a member
 * cannot span two of them.
 *
 * ⚠ **A PIECE PER PANEL IS NOT A WEAKER FIGURE, IT IS THE SAME FIGURE WITH
 * ITS SEAMS MADE VISIBLE.** The plane diagonal was always going to be
 * interrupted at every panel seam it crossed — stride 1 says so at the top of
 * its own file: *"a plane-wide X on a twelve-panel plane crosses ELEVEN
 * seams, and a diagonal is only as strong as the weakest seam it crosses."*
 * Slicing does not introduce that; it is what writes the interruptions down,
 * so phase 4 has something to put a force against.
 *
 * ⚠ **WHY NOT `clipSegmentToPolygon`.** That clips one segment against an
 * arbitrary closed polygon, in FEET, and returns the spans inside it. Every
 * part of its machinery — the inside/outside midpoint classification, the
 * boundary-coincidence test — exists for a shape that can be concave and can
 * be grazed. A panel band is a vertical strip in plane inches, the bands are
 * sorted and contiguous, and each one's membership test is two comparisons on
 * x. Running this through a polygon clipper would be slower, less exact, and
 * would lose the thing that matters most here: WHICH panel each piece landed
 * in. That is the output, not a by-product.
 *
 * Coordinates are stride 1's plane coordinates in inches throughout: x along
 * the eave from 0, y up the slope.
 */

import type { RoofBraceSegment, RoofPlaneBracing } from "./roofPlaneBracing";
import { roofBraceSegmentLengthIn } from "./roofPlaneBracing";

/**
 * Below this, in inches, two positions along the eave are the same position.
 *
 * ⚠ **Purely numerical, and deliberately NOT a building value.** A panel band
 * ends exactly where the next begins and the X legs start exactly on bay
 * edges, so the overlaps this has to classify are frequently exactly zero —
 * computed as differences between doubles that came from `planeWidthIn / bays`
 * and a run plan's own accumulation. Real floating-point noise there sits
 * around 1e-12in; no roof feature is a millionth of an inch. Nothing is
 * decided by this except whether a zero-length overlap is emitted as a piece.
 */
const BAND_TOLERANCE_IN = 1e-6;

/**
 * One roof panel's share of the eave, as the run plan laid it out.
 *
 * ⚠ **It is passed IN rather than computed here, and that is a package
 * boundary, not laziness.** `planFloorRoofPanelRun` lives in
 * `@building-integrity/panel-catalog`, which this package does not depend on
 * (and must not — the dependency runs the other way). Taking the bands as
 * input also means this works unchanged on the run the catalog plans for a
 * box building AND on the `forcedWidthsIn` run a mitred building needs, where
 * a joint is pinned to every corner and the 24in module is already a
 * casualty.
 */
export interface RoofBracePanelBand {
  /** The panel's name as the run plan named it — `R3`, and so on. */
  name: string;
  /** Distance from the run's start to this panel's near edge. */
  atIn: number;
  widthIn: number;
}

/** One buildable piece of one brace, inside one panel. */
export interface RoofBraceSlice extends RoofBraceSegment {
  /** Index into the bands array it was sliced against. */
  panelIndex: number;
  panelName: string;
  /** Which segment of the plane figure this is a piece of. */
  segmentIndex: number;
  /**
   * Where this piece starts and ends along its parent, 0 at the parent's
   * first point and 1 at its last. A shop sheet can say "piece 2 of 3 of the
   * same brace" from these, which is the difference between a member and an
   * offcut.
   */
  startFraction: number;
  endFraction: number;
}

/** What one panel ends up holding. */
export interface RoofBracePanelSliceGroup {
  panelIndex: number;
  panelName: string;
  slices: RoofBraceSlice[];
  totalLengthIn: number;
  /** Null on a panel no brace reaches. */
  shortestSliceIn: number | null;
}

export interface RoofBracePanelSlicing {
  slices: RoofBraceSlice[];
  /** One entry per band, in band order, including any panel with no brace. */
  perPanel: RoofBracePanelSliceGroup[];
  /**
   * ⚠ **This must equal the unsliced plane's `totalLengthIn`.** Slicing moves
   * cut length between panels; it never creates or destroys any, and a
   * takeoff built from the pieces has to come to the same board footage as
   * the figure it was cut from. A test holds the two against each other.
   */
  totalLengthIn: number;
  /**
   * The headline against Tommy's *"4 diagonals per roof panel"*, now measured
   * on the panels the run actually plans rather than on an idealised 24in
   * band.
   *
   * ⚠ **IT COMES OUT ABOVE FOUR ON A REAL RUN, AND THE REASON IS ALIGNMENT,
   * NOT EXTRA BRACING.** Stride 1's test measures exactly 4.0 crossings per
   * panel — on a plane whose bay quarter-points all land on 24in multiples.
   * A real roof run starts with a 15.5in edge panel (the wall thickness, his
   * 2026-10-23 rule) and can end on a narrow tail, so the seams no longer
   * line up with the figure's quarter-points. A brace that used to stop at a
   * seam now runs a little past it, and that overhang is a second piece in
   * the next panel. The braces are the same braces; the PIECE count rises
   * because the figure and the panels disagree about where their joints are.
   */
  meanSlicesPerPanel: number;
  minSlicesPerPanel: number;
  maxSlicesPerPanel: number;
  /**
   * The shortest piece anywhere on the plane, which is where the alignment
   * above has a cost.
   *
   * ⚠ **REPORTED AS A MEASUREMENT, WITH NO LIMIT ATTACHED.** Nobody has given
   * a roof brace a minimum buildable length — walls have
   * `fabricationMinPanelWidthIn` because Tommy set it, and no equivalent
   * exists here. So this states the number and stops. Inventing a threshold
   * to flag it against would be exactly the plausible-looking approximation
   * the flags convention exists to prevent, and a caller that needs one has
   * to be given it by him.
   */
  shortestSliceIn: number | null;
  /** Panels the figure never reaches, by name. Empty on every plane measured
   * so far, and worth surfacing rather than assuming. */
  unbracedPanelNames: string[];
}

/**
 * Check the bands tile the plane exactly, and say precisely how they do not.
 *
 * ⚠ **IT REFUSES RATHER THAN COPING, which is Tommy's standing rule applied
 * to the one place it can still be honoured.** *Dimensional tightness*: the
 * run must come out exact. A gap between two bands would silently drop every
 * piece that fell in it, so the takeoff would be short by a brace or two and
 * nothing on screen would look wrong. An overlap would count the same piece
 * in two panels and the shop would cut it twice.
 *
 * ⚠ **A CALLER WIRING THIS INTO A RENDER MUST NOT LET THE THROW REACH THE
 * VIEWPORT.** An uncaught throw in the 3D path has blanked this app's tab
 * before (see the gable-window crash and the Infinity-peak hang). The bands
 * and the plane width have to come from the same roof deck, which is the
 * caller's job; this is here to make a mismatch loud during that wiring, not
 * to be caught and ignored afterwards.
 */
function assertBandsTilePlane(bands: readonly RoofBracePanelBand[], planeWidthIn: number): void {
  if (bands.length === 0) {
    throw new Error(
      `A roof plane ${planeWidthIn}in wide cannot be sliced against zero panel bands. The caller must plan the run before slicing the bracing into it.`,
    );
  }
  bands.forEach((band, index) => {
    if (!(band.widthIn > 0)) {
      throw new Error(
        `Roof panel band ${index} (${band.name}) is ${band.widthIn}in wide. A panel with no width holds no brace and cannot be built.`,
      );
    }
  });
  if (Math.abs(bands[0]!.atIn) > BAND_TOLERANCE_IN) {
    throw new Error(
      `The first roof panel band (${bands[0]!.name}) starts at ${bands[0]!.atIn}in, not at the eave's 0in. Brace pieces falling before it would be dropped without a trace.`,
    );
  }
  for (let i = 1; i < bands.length; i += 1) {
    const previous = bands[i - 1]!;
    const expected = previous.atIn + previous.widthIn;
    const delta = bands[i]!.atIn - expected;
    if (Math.abs(delta) > BAND_TOLERANCE_IN) {
      throw new Error(
        `Roof panel bands ${previous.name} and ${bands[i]!.name} ${delta > 0 ? "leave a gap of" : "overlap by"} ${Math.abs(delta)}in: ${previous.name} ends at ${expected}in and ${bands[i]!.name} starts at ${bands[i]!.atIn}in. The run has to be exact before the bracing is cut into it.`,
      );
    }
  }
  const last = bands[bands.length - 1]!;
  const covered = last.atIn + last.widthIn;
  if (Math.abs(covered - planeWidthIn) > BAND_TOLERANCE_IN) {
    throw new Error(
      `The roof panel run covers ${covered}in but the braced plane is ${planeWidthIn}in wide, a difference of ${Math.abs(covered - planeWidthIn)}in. The bands and the plane must come from the same roof deck.`,
    );
  }
}

/**
 * Every seam position along the eave, the plane's two ends included — so a
 * run of `n` panels gives `n + 1` positions, 0 first and `planeWidthIn` last.
 *
 * ⚠ **This is the list the bracing figure snaps ONTO** (`snapRoofBracingToSeams`),
 * which is why it is built here rather than there: the same accumulation that
 * decides which panel a piece lands in decides where a station may sit, and
 * two accumulations of the same widths are two chances to disagree by a
 * thousandth of an inch. It validates the run on the way through, so a caller
 * cannot snap onto a run that does not tile the plane.
 */
export function roofBracePanelSeamsIn(
  bands: readonly RoofBracePanelBand[],
  planeWidthIn: number,
): number[] {
  assertBandsTilePlane(bands, planeWidthIn);
  const seams = bands.map((band) => band.atIn);
  seams.push(planeWidthIn);
  return seams;
}

/**
 * Which band a position on the eave falls in, by its own boundaries.
 *
 * The far end of the last band is inclusive, so a brace ending exactly at the
 * plane's edge belongs to the last panel rather than to none.
 */
function bandIndexAt(bands: readonly RoofBracePanelBand[], xIn: number): number {
  for (let i = 0; i < bands.length; i += 1) {
    const band = bands[i]!;
    const isLast = i === bands.length - 1;
    const withinFar = isLast
      ? xIn <= band.atIn + band.widthIn + BAND_TOLERANCE_IN
      : xIn < band.atIn + band.widthIn;
    if (xIn >= band.atIn - BAND_TOLERANCE_IN && withinFar) return i;
  }
  return bands.length - 1;
}

/**
 * The pieces one segment of the plane figure becomes, one per panel it
 * crosses, left to right along the eave.
 *
 * ⚠ **THE PIECES COME BACK IN THE PARENT'S OWN DIRECTION, not left to right.**
 * One leg of every X runs eave-right to ridge-left, so its x decreases as it
 * is walked. Emitting its pieces in x order would reverse the brace, and
 * `startFraction`/`endFraction` would count backwards — which matters as soon
 * as a sheet says "piece 1 of 3" about a member whose first point is the one
 * the installer starts from.
 */
export function sliceRoofBraceSegment(
  segment: RoofBraceSegment,
  segmentIndex: number,
  bands: readonly RoofBracePanelBand[],
): RoofBraceSlice[] {
  const dx = segment.x2In - segment.x1In;
  const dy = segment.y2In - segment.y1In;

  const pieceAt = (
    panelIndex: number,
    startFraction: number,
    endFraction: number,
  ): RoofBraceSlice => ({
    x1In: segment.x1In + dx * startFraction,
    y1In: segment.y1In + dy * startFraction,
    x2In: segment.x1In + dx * endFraction,
    y2In: segment.y1In + dy * endFraction,
    figure: segment.figure,
    bayIndex: segment.bayIndex,
    panelIndex,
    panelName: bands[panelIndex]!.name,
    segmentIndex,
    startFraction,
    endFraction,
  });

  /* ⚠ A segment with no run along the eave cannot be divided by vertical
     boundaries, and dividing by its dx would make every fraction NaN — a
     brace of length NaN that no test on positions would catch. The figure
     stride 1 builds has no such member (its own test asserts nothing in it is
     axis-aligned), so this is a guard against a later figure, not a case
     that occurs today: such a member lies wholly in whichever panel it
     stands in. */
  if (Math.abs(dx) <= BAND_TOLERANCE_IN) {
    return [pieceAt(bandIndexAt(bands, segment.x1In), 0, 1)];
  }

  const sLo = Math.min(segment.x1In, segment.x2In);
  const sHi = Math.max(segment.x1In, segment.x2In);

  const pieces: RoofBraceSlice[] = [];
  for (let i = 0; i < bands.length; i += 1) {
    const band = bands[i]!;
    const overlapLo = Math.max(sLo, band.atIn);
    const overlapHi = Math.min(sHi, band.atIn + band.widthIn);
    if (overlapHi - overlapLo <= BAND_TOLERANCE_IN) continue;

    /* Back to the parent's own parameter. On a right-to-left segment the low
       x is the LATER fraction, so these are sorted rather than assumed. */
    const tA = (overlapLo - segment.x1In) / dx;
    const tB = (overlapHi - segment.x1In) / dx;
    pieces.push(pieceAt(i, Math.min(tA, tB), Math.max(tA, tB)));
  }

  /* Left-to-right in x is the parent's direction only when it runs that way.
     Walking the parent is what the fractions mean, so sort by them. */
  pieces.sort((a, b) => a.startFraction - b.startFraction);
  return pieces;
}

/**
 * The whole plane's bracing, cut into the pieces each panel is built with.
 *
 * ⚠ **The plane's own width is used, not one the caller supplies**, which is
 * why `RoofPlaneBracing` carries `planeWidthIn`. There is then exactly one
 * number for how wide this plane is, and the band check below compares the
 * run against it rather than against a second opinion.
 */
export function sliceRoofPlaneBracing(
  bracing: RoofPlaneBracing,
  bands: readonly RoofBracePanelBand[],
): RoofBracePanelSlicing {
  assertBandsTilePlane(bands, bracing.planeWidthIn);

  const perPanel: RoofBracePanelSliceGroup[] = bands.map((band, panelIndex) => ({
    panelIndex,
    panelName: band.name,
    slices: [],
    totalLengthIn: 0,
    shortestSliceIn: null,
  }));

  const slices: RoofBraceSlice[] = [];
  bracing.segments.forEach((segment, segmentIndex) => {
    for (const piece of sliceRoofBraceSegment(segment, segmentIndex, bands)) {
      slices.push(piece);
      const group = perPanel[piece.panelIndex]!;
      group.slices.push(piece);
      const lengthIn = roofBraceSegmentLengthIn(piece);
      group.totalLengthIn += lengthIn;
      group.shortestSliceIn =
        group.shortestSliceIn === null ? lengthIn : Math.min(group.shortestSliceIn, lengthIn);
    }
  });

  const counts = perPanel.map((group) => group.slices.length);
  const shortest = perPanel
    .map((group) => group.shortestSliceIn)
    .filter((value): value is number => value !== null);

  return {
    slices,
    perPanel,
    totalLengthIn: perPanel.reduce((sum, group) => sum + group.totalLengthIn, 0),
    meanSlicesPerPanel: slices.length / bands.length,
    minSlicesPerPanel: Math.min(...counts),
    maxSlicesPerPanel: Math.max(...counts),
    shortestSliceIn: shortest.length === 0 ? null : Math.min(...shortest),
    unbracedPanelNames: perPanel.filter((g) => g.slices.length === 0).map((g) => g.panelName),
  };
}

/**
 * Panel bands straight from a list of widths, named the way the run plan
 * names a roof run.
 *
 * A convenience for callers and tests that have the widths but not the
 * catalog's instances — it accumulates the positions once, in one place,
 * instead of every caller re-deriving `atIn` and getting the rounding
 * slightly different.
 */
export function roofBracePanelBandsFromWidths(
  widthsIn: readonly number[],
  namePrefix = "R",
): RoofBracePanelBand[] {
  let atIn = 0;
  return widthsIn.map((widthIn, index) => {
    const band = { name: `${namePrefix}${index + 1}`, atIn, widthIn };
    atIn += widthIn;
    return band;
  });
}
