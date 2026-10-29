import {
  ROOF_CATCHER_BEAM_MAX_SPAN_IN,
  computeRoofCatcherBeamPostPositions,
  computeRoofCatcherBeamSegments,
} from "./roofCatcherBeamMembers";
import { STRUCTURAL_COLUMN_WIDTH_IN } from "./structuralColumnMembers";

/**
 * Where the ridge beam and its columns actually land on a building.
 *
 * > *"two sets of roof panels sitting on each of the long wall spans and
 * > resting on a center beam... the center beam now must be supported by
 * > column panels directly below it all the way to the foundation."* — Tommy,
 * > 2026-10-23
 *
 * The beam's own segmentation already existed and already matches what he
 * later asked for: `computeRoofCatcherBeamSegments` splits a run so no
 * segment exceeds 12ft, and his *"default to 12' spacing"* for the columns is
 * the same number arrived at twice. This puts that run on a real ridge line.
 */

export interface PlanPoint {
  x: number;
  y: number;
}

export interface RidgeBeamSegment {
  index: number;
  startFt: PlanPoint;
  endFt: PlanPoint;
  spanIn: number;
}

export interface RidgeColumn {
  index: number;
  atFt: PlanPoint;
  /** Distance from the ridge's start, in inches. */
  alongIn: number;
  widthIn: number;
}

export interface RidgeBeamLayout {
  segments: RidgeBeamSegment[];
  /** ⚠ INTERIOR columns only. The beam's two ends bear on the gable walls,
   * which are already carrying roof load — a column there would be a post
   * standing inside a wall that does the same job. */
  columns: RidgeColumn[];
  ridgeLengthIn: number;
  refusal: string | null;
}

export interface RidgeBeamOptions {
  ridgeStartFt: PlanPoint;
  ridgeEndFt: PlanPoint;
  maxSpanIn?: number;
  columnWidthIn?: number;
}

/**
 * Lay the beam along the ridge and stand its columns under it.
 *
 * ⚠ **The columns are evenly spaced, not placed every 12ft from one end.**
 * `computeRoofCatcherBeamSegments` divides the run into equal segments no
 * longer than the maximum, so a 30ft ridge gets three 10ft segments rather
 * than 12 + 12 + 6. Even spans are what a built-up beam wants — the short
 * leftover span of a "every 12ft then whatever is left" layout is the one
 * that governs nothing and wastes a post.
 */
export function ridgeBeamLayout(options: RidgeBeamOptions): RidgeBeamLayout {
  const { ridgeStartFt, ridgeEndFt } = options;
  const maxSpanIn = options.maxSpanIn ?? ROOF_CATCHER_BEAM_MAX_SPAN_IN;
  const columnWidthIn = options.columnWidthIn ?? STRUCTURAL_COLUMN_WIDTH_IN;

  const dxFt = ridgeEndFt.x - ridgeStartFt.x;
  const dyFt = ridgeEndFt.y - ridgeStartFt.y;
  const ridgeLengthFt = Math.hypot(dxFt, dyFt);
  const ridgeLengthIn = ridgeLengthFt * 12;

  if (!(ridgeLengthIn > 0)) {
    return { segments: [], columns: [], ridgeLengthIn: 0, refusal: "This roof has no ridge to run a beam along." };
  }
  if (!(maxSpanIn > 0)) {
    return { segments: [], columns: [], ridgeLengthIn, refusal: "A beam needs a maximum span before it can be split." };
  }

  const ux = dxFt / ridgeLengthFt;
  const uy = dyFt / ridgeLengthFt;
  const alongTo = (inches: number): PlanPoint => ({
    x: ridgeStartFt.x + (ux * inches) / 12,
    y: ridgeStartFt.y + (uy * inches) / 12,
  });

  const segments = computeRoofCatcherBeamSegments(ridgeLengthIn, maxSpanIn).map((segment, index) => ({
    index,
    startFt: alongTo(segment.xStartIn),
    endFt: alongTo(segment.xEndIn),
    spanIn: segment.spanIn,
  }));

  const columns = computeRoofCatcherBeamPostPositions(ridgeLengthIn, maxSpanIn).map((alongIn, index) => ({
    index,
    atFt: alongTo(alongIn),
    alongIn,
    widthIn: columnWidthIn,
  }));

  return { segments, columns, ridgeLengthIn, refusal: null };
}

/**
 * ⚠ Where a column crosses a floor below it, so that floor panel can be given
 * the extra bearing he asked for.
 *
 * > *"When a column panel is resting on a floor box, that floor box also needs
 * > a couple extra structural pieces such as more structural girts, one under
 * > each side of the panel resting above it."* — Tommy, 2026-10-23
 *
 * Returns the two positions, one under each side of the column, measured
 * along whatever run the caller is working in. ⚠ A column is 15.5in and a
 * floor panel is 24in, so a column usually lands within ONE panel but can
 * straddle a seam — the caller has to handle both, and `straddlesSeam` says
 * which happened rather than leaving it to be discovered.
 */
export function columnBearingGirtPositionsIn(
  columnCentreAlongIn: number,
  columnWidthIn: number,
  panelSeamsAlongIn: readonly number[],
): { girtAtIn: [number, number]; straddlesSeam: boolean } {
  const half = columnWidthIn / 2;
  const left = columnCentreAlongIn - half;
  const right = columnCentreAlongIn + half;
  const straddlesSeam = panelSeamsAlongIn.some((seam) => seam > left + 1e-9 && seam < right - 1e-9);
  return { girtAtIn: [left, right], straddlesSeam };
}

export interface ColumnStorySegment {
  storyIndex: number;
  /** Height of this segment's base above the foundation, in feet. */
  baseFt: number;
  heightIn: number;
  /** ⚠ True when this segment lands on a FLOOR rather than on the
   * foundation — which is the case that needs the extra girts under it. */
  landsOnFloor: boolean;
}

/**
 * A column, broken at every floor it passes.
 *
 * > *"the center beam now must be supported by column panels directly below
 * > it all the way to the foundation."* — Tommy, 2026-10-23
 *
 * ⚠ **Continuous load path does not mean one continuous stick.** A single
 * column drawn from the foundation to the beam would pass straight THROUGH
 * every floor deck on the way, which is both unbuildable and exactly the kind
 * of overlap this app is not allowed to have. What has to be continuous is
 * the path: a segment per story, each bearing on the floor below it, each one
 * directly over the one beneath.
 *
 * `landsOnFloor` marks the segments whose bearing is a floor panel rather
 * than the foundation — those are the ones that need *"more structural
 * girts, one under each side"* in the deck below.
 */
export function columnStorySegments(storyHeightsFt: readonly number[], beamUnderFt: number): ColumnStorySegment[] {
  const segments: ColumnStorySegment[] = [];
  let baseFt = 0;
  for (const [storyIndex, storyHeightFt] of storyHeightsFt.entries()) {
    const topFt = Math.min(baseFt + storyHeightFt, beamUnderFt);
    if (topFt - baseFt <= 1e-9) break;
    segments.push({
      storyIndex,
      baseFt,
      heightIn: (topFt - baseFt) * 12,
      landsOnFloor: storyIndex > 0,
    });
    baseFt = topFt;
  }
  /* Whatever is left between the topmost story and the beam — the gable
     wall's own height above the top plate. */
  if (beamUnderFt - baseFt > 1e-9) {
    segments.push({
      storyIndex: storyHeightsFt.length,
      baseFt,
      heightIn: (beamUnderFt - baseFt) * 12,
      landsOnFloor: storyHeightsFt.length > 0,
    });
  }
  return segments;
}
