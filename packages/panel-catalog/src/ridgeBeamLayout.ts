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
  /** ⚠ INTERIOR columns only — free-standing posts inside the building.
   * The beam's two ENDS are `endBearings` below, which are panels in the
   * gable walls rather than posts. */
  columns: RidgeColumn[];
  /**
   * ⚠ **THE TWO ENDS OF THE RIDGE, WHICH ARE REAL COLUMN PANELS.**
   *
   * > *"the ridge beam should land on top of a Gable column panel. Gable
   * > column panels are especially strong and they are 15 and 1/2 in
   * > rectangular boxes by 15 and 1/2 in. If there is a Gable column panel
   * > that spawns, there must be a column panel directly below it in the
   * > main level wall and all the way down spawning two extra structural
   * > girts in the floor panels, one underneath each side of the panel."* —
   * > Tommy, 2026-10-29
   *
   * This file used to say the ends needed nothing, because *"the gable
   * walls... are already carrying roof load"*. That was a reading, and he
   * has now replaced it: the beam lands on a column panel, the same
   * 15 1/2in box as an interior post, and the load path below it is the
   * same too — a column panel on every story and two extra structural girts
   * in the floor under each side.
   *
   * Kept SEPARATE from `columns` rather than folded in, because the two are
   * not interchangeable: an interior column is a free-standing post whose
   * spacing the beam's segmentation decides, while these two are fixed at
   * the ridge's ends and live inside a wall. A caller spacing posts wants
   * `columns`; a caller tracing load to the foundation wants both.
   */
  endBearings: RidgeColumn[];
  ridgeLengthIn: number;
  /** ⚠ Segments that came out longer than the maximum because a column was
   * dragged. Empty unless somebody moved one. */
  overlongSegments: RidgeBeamSegment[];
  refusal: string | null;
}

export interface RidgeBeamOptions {
  ridgeStartFt: PlanPoint;
  ridgeEndFt: PlanPoint;
  maxSpanIn?: number;
  columnWidthIn?: number;
  /**
   * Columns the user has dragged, by index, as a distance from the ridge's
   * start in inches. Tommy: *"they should be moveable."*
   *
   * ⚠ Moving one re-cuts the BEAM, because a beam segment runs between the
   * posts that carry it. The even spacing is only a default; once a post
   * moves, the spans either side of it change and one of them may go over
   * the maximum — which `overlongSegments` reports rather than silently
   * drawing a beam nobody should build.
   */
  columnOverridesAlongIn?: Record<number, number>;
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
    return {
      segments: [],
      columns: [],
      endBearings: [],
      ridgeLengthIn: 0,
      overlongSegments: [],
      refusal: "This roof has no ridge to run a beam along.",
    };
  }
  if (!(maxSpanIn > 0)) {
    return {
      segments: [],
      columns: [],
      endBearings: [],
      ridgeLengthIn,
      overlongSegments: [],
      refusal: "A beam needs a maximum span before it can be split.",
    };
  }

  const ux = dxFt / ridgeLengthFt;
  const uy = dyFt / ridgeLengthFt;
  const alongTo = (inches: number): PlanPoint => ({
    x: ridgeStartFt.x + (ux * inches) / 12,
    y: ridgeStartFt.y + (uy * inches) / 12,
  });

  /* Even spacing is the default; a dragged column replaces its own position
     and everything is re-sorted, because dragging one past another should
     renumber the beam's bays rather than cross them over. */
  const overrides = options.columnOverridesAlongIn ?? {};
  const columnAlongIn = computeRoofCatcherBeamPostPositions(ridgeLengthIn, maxSpanIn)
    .map((defaultAlongIn, index) => {
      const moved = overrides[index];
      return moved === undefined ? defaultAlongIn : Math.min(Math.max(moved, 0), ridgeLengthIn);
    })
    .sort((a, b) => a - b);

  const columns = columnAlongIn.map((alongIn, index) => ({
    index,
    atFt: alongTo(alongIn),
    alongIn,
    widthIn: columnWidthIn,
  }));

  /* ⚠ The beam is cut BETWEEN its posts, so the segments come from the
     columns rather than the other way round. With no overrides this
     reproduces the even division exactly. */
  const cuts = [0, ...columnAlongIn, ridgeLengthIn];
  const segments: RidgeBeamSegment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const startIn = cuts[i]!;
    const endIn = cuts[i + 1]!;
    if (endIn - startIn <= 1e-9) continue;
    segments.push({ index: segments.length, startFt: alongTo(startIn), endFt: alongTo(endIn), spanIn: endIn - startIn });
  }

  /* ⚠ Indexed -1 and -2 so an end bearing can never be mistaken for an
     interior column by index — `columnOverridesAlongIn` is keyed by that
     index, and these two do not move: they are where the gable walls are. */
  const endBearings: RidgeColumn[] = [
    { index: -1, atFt: alongTo(0), alongIn: 0, widthIn: columnWidthIn },
    { index: -2, atFt: alongTo(ridgeLengthIn), alongIn: ridgeLengthIn, widthIn: columnWidthIn },
  ];

  return {
    segments,
    columns,
    endBearings,
    ridgeLengthIn,
    overlongSegments: segments.filter((segment) => segment.spanIn > maxSpanIn + 1e-9),
    refusal: null,
  };
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
