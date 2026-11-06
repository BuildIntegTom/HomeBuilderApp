import type { AddedMemberSpec, PanelRecipe, PanelWythe } from "./panelRecipe";
import { buildPanelFromRecipe, recipeClearHeightIn } from "./panelRecipe";
import { overlappingMemberPairs } from "./memberPrism";
import { PLATE_2X4_THICKNESS_IN, PLATE_2X4_WIDTH_IN, memberBoxSizeIn } from "./panelMemberHelpers";
import type { PanelMember } from "./componentSchema";

/**
 * **THE PANEL EDITOR'S ARITHMETIC — B19's last stride.**
 *
 * > *"This panel editor isolates the panel in question in its own 3d framed
 * > view and the left bar is dedicated to having options such as change panel
 * > type, add diagonal, add vertical, add horizontal. Once spawned, it is easy
 * > to click and drag a member ... because it snaps to center and flush with
 * > either side of other members, corners, and intersections. ... Left bar also
 * > has an option to rotate 90 or custom degrees."* — Tommy, 2026-11-02
 *
 * Everything in here is pure: a spec in, a spec out. The editor's React
 * component decides WHEN to call these; what a rotation means, where a new
 * board starts and what counts as flush are decided here, under test, because
 * those are the parts that are wrong quietly.
 */

/** The app's own dimension grid — every length in this project is on eighths. */
export const EDITOR_GRID_IN = 0.125;

/**
 * ⚠ A corner post is 1.5in across the panel's WIDTH, and an added member must
 * stop at its face rather than run to the panel edge.
 *
 * > *"Braces should be flush with the post, not the edge of the panel. No
 * > overlapping."*
 *
 * Same constant `bracePairPatterns` uses for the same reason, and the reason
 * it is a constant in both places rather than imported from one: a corner post
 * is a 2x4 on its flat, so its 1.5in dimension is the one that eats into the
 * width. `PLATE_2X4_THICKNESS_IN` is that number, and naming it here says
 * which of a 2x4's two dimensions is meant.
 */
const CORNER_POST_THICKNESS_IN = PLATE_2X4_THICKNESS_IN;

export interface EditorPanelSize {
  widthIn: number;
  depthIn: number;
  heightIn: number;
}

/** The rectangle inside a panel that an added member may occupy: between the
 * corner posts across, and between the plate faces up. */
export interface EditorClearArea {
  minXIn: number;
  maxXIn: number;
  minZIn: number;
  maxZIn: number;
}

export function editorClearArea(panel: EditorPanelSize): EditorClearArea {
  const { bottomZIn, topZIn } = recipeClearHeightIn(panel.heightIn);
  return {
    minXIn: CORNER_POST_THICKNESS_IN,
    maxXIn: Math.max(CORNER_POST_THICKNESS_IN, panel.widthIn - CORNER_POST_THICKNESS_IN),
    minZIn: bottomZIn,
    maxZIn: Math.max(bottomZIn, topZIn),
  };
}

export function snapToGridIn(valueIn: number, gridIn: number = EDITOR_GRID_IN): number {
  return Math.round(valueIn / gridIn) * gridIn;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** How long a board this spec cuts, measured between its anchors.
 *
 * ⚠ Not the same number the cut list reports for a DIAGONAL, and that is not a
 * bug here. A diagonal's cut length is taken across its longest edge — *"For
 * 2x4 length counts just count the longest tips' length"* — which is longer
 * than the centreline by the mitre. This is the anchor-to-anchor length, which
 * is what the editor's own readout is about: where the user put the two ends.
 * `computePanelCutList` stays the authority on what gets cut. */
export function specAnchorLengthIn(spec: AddedMemberSpec): number {
  return Math.hypot(spec.toXIn - spec.fromXIn, spec.toZIn - spec.fromZIn);
}

/** The angle of a spec's run, in degrees, measured from the panel's own
 * horizontal and counter-clockwise, in (-180, 180]. */
export function specAngleDeg(spec: AddedMemberSpec): number {
  return (Math.atan2(spec.toZIn - spec.fromZIn, spec.toXIn - spec.fromXIn) * 180) / Math.PI;
}

/**
 * ⚠ **Where a new board goes depends on what is already there, and the first
 * version of this did not ask.**
 *
 * `newVerticalSpec` put a stud at the panel's centre, which is the right place
 * for his reason — *"walls 48in with a centre nailer, so load bears straight
 * down"* onto the seam between the two 24in deck panels below. On a 48in panel
 * that is also exactly where `buildStandardPanelMembers` has ALREADY put the
 * intermediate stud, so the editor's own default member overlapped a base
 * member of his own standard panel. Caught by the overlap check in this file's
 * test, which is the check his *no overlapping members* rule is enforced by.
 *
 * So `existing` is how the caller says what the panel holds. With it, a new
 * board lands in the middle of the widest run of clear space instead of on top
 * of something; without it, the old centre/mid-height behaviour stands, which
 * is what an empty panel wants anyway.
 */
export interface NewMemberOptions {
  wythe: PanelWythe;
  /** The panel's members as they stand. */
  existing?: readonly PanelMember[];
  id?: string;
}

/**
 * The intervals along one axis that a new board cannot have, because a member
 * already standing in the same depth and crossing the same line occupies them.
 *
 * ⚠ **Both other axes have to be checked, and the first version checked one.**
 * Filtering on shared depth alone made the plate SKINS an obstacle — they span
 * the whole width and the whole depth — so nothing was ever clear and the
 * search fell back to the panel's centre, which was the overlap it was written
 * to avoid. A skin is at z 0..0.75, nowhere near a stud's span, so the test
 * that matters is whether the two members would actually meet.
 */
function obstacleIntervals(
  members: readonly PanelMember[],
  depthIn: [number, number],
  crossIn: [number, number],
  axis: "x" | "z",
): [number, number][] {
  const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] - 0.001 && a[1] > b[0] + 0.001;
  const out: [number, number][] = [];
  for (const m of members) {
    /* A tilted board has no axis-aligned footprint — an upright box around it
       claims space it does not fill — so it is not treated as an obstacle
       here. It still shows up in the overlap report if the two really do
       collide, which is the authority on that question. */
    if (m.position.trapezoidCornersIn) continue;
    const size = memberBoxSizeIn(m);
    const y: [number, number] = [m.position.yIn, m.position.yIn + size.yIn];
    const x: [number, number] = [m.position.xIn, m.position.xIn + size.xIn];
    const z: [number, number] = [m.position.zIn, m.position.zIn + size.zIn];
    if (!overlaps(y, depthIn)) continue;
    if (!overlaps(axis === "x" ? z : x, crossIn)) continue;
    out.push(axis === "x" ? x : z);
  }
  return out;
}

/** The depth range a straight added member of this kind occupies — the same
 * arithmetic `buildStraightFromSpec` does, and the reason it is repeated here
 * rather than inferred: two members only fight if they share depth, so an
 * exterior stud is free to cross an interior one and a mid-depth girt web.
 *
 * ⚠ **1.5in now, whichever way it runs** — B30 lays a new vertical FLAT, so
 * the depth it occupies no longer depends on its direction or its size. `_`
 * keeps the parameter, because `onEdge` makes the old 3.5in reachable again
 * and the one caller reads better naming the axis it asked about. */
function straightDepthRangeIn(panel: EditorPanelSize, wythe: PanelWythe, _vertical: boolean): [number, number] {
  const throughIn = PLATE_2X4_THICKNESS_IN;
  const y0 = wythe === "exterior" ? 0 : panel.depthIn - throughIn;
  return [y0, y0 + throughIn];
}

/**
 * The widest clear run between `min` and `max`, given the occupied intervals.
 * Ties go to the first run, so the result is stable.
 *
 * ⚠ An interval that swallows the whole range is dropped rather than obeyed —
 * a corner post or a full-height stud crosses every height, so a horizontal tie
 * measured against one would find nowhere at all to go. What it IS in the way
 * of is the tie's length, and that is handled by trimming the run rather than
 * by refusing the height.
 */
function widestClearRunIn(minIn: number, maxIn: number, occupied: [number, number][]): [number, number] {
  const span = maxIn - minIn;
  const sorted = occupied.filter(([from, to]) => to - from < span - 0.001).sort((a, b) => a[0] - b[0]);
  let cursor = minIn;
  let best: [number, number] = [minIn, maxIn];
  let bestSpan = -1;
  const consider = (from: number, to: number) => {
    if (to - from > bestSpan + 0.001) {
      bestSpan = to - from;
      best = [from, to];
    }
  };
  for (const [from, to] of sorted) {
    if (from > cursor) consider(cursor, Math.min(from, maxIn));
    cursor = Math.max(cursor, to);
    if (cursor >= maxIn) break;
  }
  if (cursor < maxIn) consider(cursor, maxIn);
  return best;
}

/** Grid rounding that never grows the interval it is rounding — a snap outward
 * would put the end of a board back inside the member it was just kept out of. */
function snapInwardIn(valueIn: number, direction: "up" | "down"): number {
  const n = valueIn / EDITOR_GRID_IN;
  return (direction === "up" ? Math.ceil(n - 1e-9) : Math.floor(n + 1e-9)) * EDITOR_GRID_IN;
}

/**
 * Where a new straight board goes: **the widest clear run, on both axes.**
 *
 * ⚠ **Its LENGTH is trimmed as well as its position, and that is the part the
 * first version got wrong.** A horizontal tie asked for at mid-height ran post
 * face to post face across the whole panel — straight through the intermediate
 * stud standing in the same wythe. Real blocking is cut per bay, and the same
 * rule now cuts a RING GIRT's rails around those studs (see
 * `buildRingGirtRow`), reading the spans from `centreNailerStudSpansIn`. So
 * the tie fills one bay: the widest clear run at the height it landed on.
 *
 * ⚠ **A spec's `from`/`to` are the member's MIN FACE, not its centreline** —
 * `buildStraightFromSpec` takes `Math.min` of the two and grows the member's
 * cross-section upward from there. So centring a board means offsetting by
 * half its own width.
 *
 * ⚠ On an empty 48in panel that now lands a new vertical at x=22.25, not the
 * 23.25 this comment used to record: a board laid flat is 3.5in across the
 * width where one on edge was 1.5in. The panel's own centre stud is still at
 * 23.25 and still on edge — the two no longer coincide, and the clear-run
 * search is what keeps them out of each other rather than the arithmetic
 * happening to agree.
 */
function newStraightSpec(panel: EditorPanelSize, opts: NewMemberOptions, vertical: boolean): AddedMemberSpec {
  const area = editorClearArea(panel);
  const existing = opts.existing ?? [];
  const depthIn = straightDepthRangeIn(panel, opts.wythe, vertical);
  /* The member's own cross-section on the axis it is POSITIONED along. ⚠ 3.5in
     EITHER WAY since B30: a new vertical lies flat, so its wide face runs
     across the panel's width exactly as a horizontal tie's runs up its
     height. A vertical stood back on edge is 1.5in across again, which is why
     `setMemberOnEdge` re-checks for overlaps rather than assuming the board
     only ever gets thinner. */
  const acrossIn = PLATE_2X4_WIDTH_IN;
  const [lineMin, lineMax] = vertical ? [area.minXIn, area.maxXIn] : [area.minZIn, area.maxZIn];
  const [runMin, runMax] = vertical ? [area.minZIn, area.maxZIn] : [area.minXIn, area.maxXIn];

  const lineRun = widestClearRunIn(lineMin, lineMax, obstacleIntervals(existing, depthIn, [runMin, runMax], vertical ? "x" : "z"));
  const lineIn = snapInwardIn(
    Math.max(lineMin, Math.min((lineRun[0] + lineRun[1] - acrossIn) / 2, lineMax - acrossIn)),
    "up",
  );
  const run = widestClearRunIn(runMin, runMax, obstacleIntervals(existing, depthIn, [lineIn, lineIn + acrossIn], vertical ? "z" : "x"));
  const from = snapInwardIn(run[0], "up");
  const to = snapInwardIn(run[1], "down");
  const id = opts.id ?? newEditorMemberId();
  return vertical
    ? { kind: "straight", id, fromXIn: lineIn, fromZIn: from, toXIn: lineIn, toZIn: to, wythe: opts.wythe }
    : { kind: "straight", id, fromXIn: from, fromZIn: lineIn, toXIn: to, toZIn: lineIn, wythe: opts.wythe };
}

let idCounter = 0;

/** A fresh member id. Prefixed so an edited member is identifiable in a cut
 * list, an OBJ file or an overlap report without a lookup. */
export function newEditorMemberId(): string {
  idCounter += 1;
  return `edit_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/**
 * A new diagonal, corner to corner of the clear area, rising left to right.
 *
 * ⚠ Both anchors sit ON the clear area's corners, which is what makes a brace
 * flush with the posts and the plates rather than overlapping them — the same
 * rule the carrot legs follow. `buildDiagonalFromSpec` then grows the real
 * trapezoid around that centreline.
 */
export function newDiagonalSpec(panel: EditorPanelSize, opts: NewMemberOptions): AddedMemberSpec {
  const area = editorClearArea(panel);
  return {
    kind: "diagonal",
    id: opts.id ?? newEditorMemberId(),
    fromXIn: area.minXIn,
    fromZIn: area.minZIn,
    toXIn: area.maxXIn,
    toZIn: area.maxZIn,
    wythe: opts.wythe,
  };
}

/** A new vertical stud, standing in the widest clear bay of the panel. */
export function newVerticalSpec(panel: EditorPanelSize, opts: NewMemberOptions): AddedMemberSpec {
  return newStraightSpec(panel, opts, true);
}

/** A new horizontal tie, lying in the widest clear bay of the panel. */
export function newHorizontalSpec(panel: EditorPanelSize, opts: NewMemberOptions): AddedMemberSpec {
  return newStraightSpec(panel, opts, false);
}

/**
 * Move a spec bodily, clamped so the whole board stays in the clear area.
 *
 * ⚠ **The board is clamped, not its endpoints.** Clamping each end on its own
 * would change the angle — a diagonal dragged off the top would come back
 * shallower than the user drew it. The shift is reduced instead, so the member
 * slides until it touches and then stops, which is what a board does.
 */
export function translateSpec(spec: AddedMemberSpec, dxIn: number, dzIn: number, area: EditorClearArea): AddedMemberSpec {
  const minX = Math.min(spec.fromXIn, spec.toXIn);
  const maxX = Math.max(spec.fromXIn, spec.toXIn);
  const minZ = Math.min(spec.fromZIn, spec.toZIn);
  const maxZ = Math.max(spec.fromZIn, spec.toZIn);
  const dx = clamp(dxIn, area.minXIn - minX, area.maxXIn - maxX);
  const dz = clamp(dzIn, area.minZIn - minZ, area.maxZIn - maxZ);
  return {
    ...spec,
    fromXIn: snapToGridIn(spec.fromXIn + dx),
    fromZIn: snapToGridIn(spec.fromZIn + dz),
    toXIn: snapToGridIn(spec.toXIn + dx),
    toZIn: snapToGridIn(spec.toZIn + dz),
  };
}

/** Move one END of a spec, clamped into the clear area. The other end stays
 * exactly where it is, so this is what changes a member's angle and length. */
export function moveSpecEnd(
  spec: AddedMemberSpec,
  end: "from" | "to",
  xIn: number,
  zIn: number,
  area: EditorClearArea,
): AddedMemberSpec {
  const x = snapToGridIn(clamp(xIn, area.minXIn, area.maxXIn));
  const z = snapToGridIn(clamp(zIn, area.minZIn, area.maxZIn));
  const moved = end === "from" ? { ...spec, fromXIn: x, fromZIn: z } : { ...spec, toXIn: x, toZIn: z };
  return retypeByAngle(moved);
}

/**
 * ⚠ **A straight board at an angle is a diagonal, and this is where that is
 * enforced.**
 *
 * The two kinds are not labels, they are two different builders.
 * `buildStraightFromSpec` reads the dominant run, decides the member is
 * vertical or horizontal, and then draws an AXIS-ALIGNED box of that length —
 * so a `straight` spec whose ends are off-axis renders as a board that is not
 * where its own numbers say it is, and cuts at the wrong length. Rotating a
 * horizontal tie by 30 degrees has to change its kind, not just its numbers.
 *
 * The reverse is allowed and deliberate: a `diagonal` that lands exactly on an
 * axis stays a diagonal, because its mitre is 0 either way and because it is
 * what the user drew. Only `straight` is at risk of lying about itself.
 */
function retypeByAngle(spec: AddedMemberSpec): AddedMemberSpec {
  if (spec.kind !== "straight") return spec;
  const runX = Math.abs(spec.toXIn - spec.fromXIn);
  const runZ = Math.abs(spec.toZIn - spec.fromZIn);
  const axisAligned = runX < EDITOR_GRID_IN / 2 || runZ < EDITOR_GRID_IN / 2;
  return axisAligned ? spec : { ...spec, kind: "diagonal" };
}

/**
 * Rotate a spec about its own midpoint — *"rotate 90 or custom degrees"*.
 *
 * ⚠ **The angle is kept and the LENGTH gives way.** A board rotated inside a
 * panel usually will not fit at its old length: a full-height vertical turned
 * 90 degrees is longer than the panel is wide. Both halves are shortened
 * equally until both ends are inside the clear area, which keeps the rotation
 * exactly on the axis the user asked for and keeps the member centred where it
 * was. The alternative — clamping each end — silently changes the angle, so the
 * board would come back from a 90 degree rotation at 84.
 *
 * The result is reported: `shortenedBy` is how much length the fit cost, so
 * the editor can say so rather than letting a board quietly shrink.
 */
export function rotateSpec(
  spec: AddedMemberSpec,
  deltaDeg: number,
  area: EditorClearArea,
): { spec: AddedMemberSpec; shortenedByIn: number } {
  const midX = (spec.fromXIn + spec.toXIn) / 2;
  const midZ = (spec.fromZIn + spec.toZIn) / 2;
  const lengthIn = specAnchorLengthIn(spec);
  const angleRad = ((specAngleDeg(spec) + deltaDeg) * Math.PI) / 180;
  const ux = Math.cos(angleRad);
  const uz = Math.sin(angleRad);
  /* How far the midpoint can travel along the new direction before leaving the
     area, in each of the four directions that bound it. A zero component means
     that axis cannot limit anything, hence the Infinity. */
  const limits = [
    ux > 0 ? (area.maxXIn - midX) / ux : ux < 0 ? (area.minXIn - midX) / ux : Infinity,
    uz > 0 ? (area.maxZIn - midZ) / uz : uz < 0 ? (area.minZIn - midZ) / uz : Infinity,
    ux > 0 ? (midX - area.minXIn) / ux : ux < 0 ? (midX - area.maxXIn) / ux : Infinity,
    uz > 0 ? (midZ - area.minZIn) / uz : uz < 0 ? (midZ - area.maxZIn) / uz : Infinity,
  ];
  const halfIn = Math.min(lengthIn / 2, ...limits.map((l) => Math.max(0, l)));
  const rotated = retypeByAngle({
    ...spec,
    fromXIn: snapToGridIn(midX - ux * halfIn),
    fromZIn: snapToGridIn(midZ - uz * halfIn),
    toXIn: snapToGridIn(midX + ux * halfIn),
    toZIn: snapToGridIn(midZ + uz * halfIn),
  });
  return { spec: rotated, shortenedByIn: Math.max(0, lengthIn - specAnchorLengthIn(rotated)) };
}

/**
 * Where a dragged member wants to land — *"it snaps to center and flush with
 * either side of other members, corners, and intersections."*
 *
 * Three kinds of target per axis, which is exactly his three words:
 *
 * - **flush with either side** — a member's two faces on that axis.
 * - **center** — the line through its middle.
 * - **corners and intersections** — a corner IS the meeting of a plate face
 *   and a post face, and an intersection IS the meeting of two members'
 *   faces, so both fall out of the per-axis face list without being hunted
 *   for separately: snapping x to one member's face and z to another's lands
 *   the board on their intersection.
 *
 * Read off the panel's REAL members rather than a list of nominal positions,
 * so a panel with a nailer, a girt row or an existing carrot offers those too.
 */
export function snapTargetsIn(members: readonly PanelMember[], area: EditorClearArea): { xIn: number[]; zIn: number[] } {
  const xs = new Set<number>([area.minXIn, area.maxXIn]);
  const zs = new Set<number>([area.minZIn, area.maxZIn]);
  for (const member of members) {
    const size = memberBoxSizeIn(member);
    /* A diagonal is skipped on purpose: it stores its CENTRE rather than its
       min corner, and an axis-aligned box around a tilted board has faces that
       are nowhere on the real member. Snapping to those would be snapping to a
       shape that is not there. */
    if (member.position.trapezoidCornersIn) continue;
    const x0 = member.position.xIn;
    const z0 = member.position.zIn;
    xs.add(x0).add(x0 + size.xIn).add(x0 + size.xIn / 2);
    zs.add(z0).add(z0 + size.zIn).add(z0 + size.zIn / 2);
  }
  const inRange = (v: number, min: number, max: number) => v >= min - 0.001 && v <= max + 0.001;
  return {
    xIn: [...xs].filter((v) => inRange(v, area.minXIn, area.maxXIn)).sort((a, b) => a - b),
    zIn: [...zs].filter((v) => inRange(v, area.minZIn, area.maxZIn)).sort((a, b) => a - b),
  };
}

/** Half a 2x4's width — the default snap reach, so a board snaps when its face
 * is within its own width of a target rather than at some unrelated tolerance. */
export const SNAP_TOLERANCE_IN = PLATE_2X4_WIDTH_IN / 2;

/** The nearest target within reach, or the value unchanged. */
export function snapValueIn(valueIn: number, targets: readonly number[], toleranceIn = SNAP_TOLERANCE_IN): number {
  let best = valueIn;
  let bestGap = toleranceIn;
  for (const target of targets) {
    const gap = Math.abs(target - valueIn);
    if (gap <= bestGap) {
      best = target;
      bestGap = gap;
    }
  }
  return best;
}

/* ──────────────────────────────────────────────────────────────────────────
   STRIDE 2 — dragging a member, and the four things the right-click menu does.

   Interviewed 2026-11-05. His four answers, in effect:

   1. A dragged member snaps to **neighbour faces, then the 1/8in grid**.
   2. A diagonal dragged until it stands plumb **converts** to a vertical
      nailer, and the editor says so.
   3. The member menu offers **delete, duplicate, change lumber size, move to
      the other wythe**.
   4. A drop that would overlap another board is **refused** and snaps back.

   Every one of these is pure and tested here rather than in the component,
   because each is a rule about the building rather than about the UI.
   ────────────────────────────────────────────────────────────────────────── */

/** What a drag or a menu action did, in the terms the editor has to report. */
export interface EditorOpResult {
  /** The recipe to keep — unchanged when `accepted` is false. */
  recipe: PanelRecipe;
  accepted: boolean;
  /**
   * What to put on screen. Set on a refusal (why it was refused) AND on an
   * accepted op that changed something the user did not ask for — a retype.
   * Null means "it did exactly what you did".
   */
  message: string | null;
}

/** Inside an eighth of plumb or level IS plumb or level — measured over the
 * board's own run rather than as an angle, so a long board is judged by where
 * its ends actually are. */
const AXIS_TOLERANCE_IN = EDITOR_GRID_IN;

function specById(recipe: PanelRecipe, specId: string): AddedMemberSpec | undefined {
  return recipe.added.find((s) => s.id === specId);
}

function withSpec(recipe: PanelRecipe, specId: string, next: AddedMemberSpec): PanelRecipe {
  return { ...recipe, added: recipe.added.map((s) => (s.id === specId ? next : s)) };
}

function panelSizeOf(recipe: PanelRecipe): EditorPanelSize {
  return { widthIn: recipe.widthIn, heightIn: recipe.heightIn, depthIn: recipe.depthIn };
}

/**
 * ⚠ **The symmetric half of `retypeByAngle`, and the reason stride 2 needed
 * it.**
 *
 * `retypeByAngle` turns a `straight` dragged off-axis into a `diagonal`, one
 * direction only, *"because it is what the user drew"* — which was true when
 * the only way to move a member was to TYPE its ends. A drag changes that: you
 * can land on plumb by accident. Two things are wrong if it stays a diagonal:
 *
 * 1. **It seats differently through the depth.** `buildStraightFromSpec` gives
 *    a vertical a `throughDepthIn` of 3.5in — a stud on edge. A diagonal seats
 *    on the brace's own flat inset, 1.5in deep. Same lumber, same cut length,
 *    a board turned 90 degrees about its own long axis. A different part.
 * 2. **Its role stays `brace`**, so the shear check keeps crediting it while a
 *    plumb board resists no racking. That is the live hazard, and it is why
 *    his answer was *"convert it, and say so"* rather than *"flag it"*.
 *
 * A board that lands LEVEL is not a nailer — it is blocking — so only the
 * plumb case takes the nailer role.
 */
export function retypeDiagonalOnAxis(spec: AddedMemberSpec): { spec: AddedMemberSpec; message: string | null } {
  if (spec.kind !== "diagonal") return { spec, message: null };
  const runX = Math.abs(spec.toXIn - spec.fromXIn);
  const runZ = Math.abs(spec.toZIn - spec.fromZIn);
  if (runX >= AXIS_TOLERANCE_IN && runZ >= AXIS_TOLERANCE_IN) return { spec, message: null };
  const plumb = runX < AXIS_TOLERANCE_IN;
  const { wythe, id, fromXIn, fromZIn, toXIn, toZIn } = spec;
  return {
    spec: {
      kind: "straight",
      id,
      wythe,
      fromXIn,
      fromZIn,
      toXIn,
      toZIn,
      ...(plumb ? { role: "nailer" as const } : {}),
      notes: plumb
        ? "was a brace; dragged plumb, so it is a vertical nailer now"
        : "was a brace; dragged level, so it is blocking now",
    },
    message: plumb
      ? "That brace is standing plumb, so it is a vertical nailer now — reseated on edge through the depth, and out of the shear count. A plumb board resists no racking."
      : "That brace is lying level, so it is blocking now — reseated flat through the depth, and out of the shear count.",
  };
}

/**
 * Slide the whole board by one snap delta per axis.
 *
 * ⚠ **The board moves rigidly.** Snapping each end to its own nearest target
 * would change the angle and the cut length of a diagonal — the same mistake
 * `translateSpec` already refuses to make when it clamps. So each axis gets
 * ONE delta, chosen from whichever of the board's two faces lands closest to a
 * target, and both ends take it.
 */
function snapDeltaIn(loIn: number, hiIn: number, targets: readonly number[], toleranceIn: number): number {
  let best = 0;
  let bestGap = toleranceIn;
  for (const edge of [loIn, hiIn]) {
    const snapped = snapValueIn(edge, targets, toleranceIn);
    const gap = Math.abs(snapped - edge);
    if (gap < bestGap) {
      best = snapped - edge;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * Which pairs overlap that did not overlap before, naming the member we moved.
 *
 * ⚠ Measured as a DELTA against the recipe as it stood, not as an absolute
 * count. A panel can arrive carrying an overlap that is not this drag's fault
 * — a stored file from before a builder changed, say — and refusing every drag
 * on such a panel would make it uneditable. Only a pair this op created counts
 * against it.
 */
function newOverlapsFor(before: PanelRecipe, after: PanelRecipe, specId: string): string[] {
  const was = new Set(overlappingMemberPairs(buildPanelFromRecipe(before)));
  return overlappingMemberPairs(buildPanelFromRecipe(after)).filter((pair) => !was.has(pair) && pair.includes(specId));
}

/**
 * **Drag one member by (dx, dz).** His rules 1 and 4, in one call.
 *
 * The order is his: translate (clamped into the clear area), then snap the
 * board's faces to its neighbours' faces and centres if any are within reach,
 * then fall back to the 1/8in grid — which `translateSpec` has already
 * applied, so the fallback costs nothing. Then retype if it landed on an axis.
 * Then, and only then, check for overlaps: a drag that snapped flush against a
 * stud has not overlapped it, and checking before the snap would refuse
 * exactly the drops the snapping exists to make easy.
 */
export function dragMemberSpec(recipe: PanelRecipe, specId: string, dxIn: number, dzIn: number): EditorOpResult {
  const spec = specById(recipe, specId);
  if (!spec) return { recipe, accepted: false, message: "That member is not part of this panel." };
  const area = editorClearArea(panelSizeOf(recipe));
  const others = buildPanelFromRecipe({ ...recipe, added: recipe.added.filter((s) => s.id !== specId) });
  const targets = snapTargetsIn(others, area);

  const moved = translateSpec(spec, dxIn, dzIn, area);
  const dX = snapDeltaIn(
    Math.min(moved.fromXIn, moved.toXIn),
    Math.max(moved.fromXIn, moved.toXIn),
    targets.xIn,
    SNAP_TOLERANCE_IN,
  );
  const dZ = snapDeltaIn(
    Math.min(moved.fromZIn, moved.toZIn),
    Math.max(moved.fromZIn, moved.toZIn),
    targets.zIn,
    SNAP_TOLERANCE_IN,
  );
  const snapped = dX === 0 && dZ === 0 ? moved : translateSpec(moved, dX, dZ, area);
  const { spec: retyped, message: retypeMessage } = retypeDiagonalOnAxis(snapped);

  const next = withSpec(recipe, specId, retyped);
  const clashes = newOverlapsFor(recipe, next, specId);
  if (clashes.length > 0) {
    return {
      recipe,
      accepted: false,
      message: `That lands on ${clashes.length === 1 ? "another board" : `${clashes.length} other boards`} — ${clashes.join(", ")}. Two solids cannot share a volume, so it snapped back.`,
    };
  }
  return { recipe: next, accepted: true, message: retypeMessage };
}

/** Take a board out. A panel with one fewer member is a different part, which
 * `recipeFingerprint` works out on its own. */
export function deleteMemberSpec(recipe: PanelRecipe, specId: string): EditorOpResult {
  if (!specById(recipe, specId)) return { recipe, accepted: false, message: "That member is not part of this panel." };
  return { recipe: { ...recipe, added: recipe.added.filter((s) => s.id !== specId) }, accepted: true, message: null };
}

/**
 * Drop an identical board beside the one you right-clicked.
 *
 * ⚠ **Offset, not on top.** A copy placed exactly over its original is two
 * solids in one volume — the standing rule — so it would be refused the moment
 * it was created. It lands one 2x4 width away along the panel's width, or back
 * the other way if that would not fit, and is refused outright if neither
 * does, which is honest rather than stacking boards.
 */
export function duplicateMemberSpec(recipe: PanelRecipe, specId: string, newId: string): EditorOpResult {
  const spec = specById(recipe, specId);
  if (!spec) return { recipe, accepted: false, message: "That member is not part of this panel." };
  const area = editorClearArea(panelSizeOf(recipe));
  for (const offsetIn of [PLATE_2X4_WIDTH_IN, -PLATE_2X4_WIDTH_IN]) {
    const copy = translateSpec({ ...spec, id: newId }, offsetIn, 0, area);
    const next = { ...recipe, added: [...recipe.added, copy] };
    if (newOverlapsFor(recipe, next, newId).length === 0) return { recipe: next, accepted: true, message: null };
  }
  return {
    recipe,
    accepted: false,
    message: "There is no room beside that board for a copy — move it first, or add a new member instead.",
  };
}

/**
 * Change a board's lumber size in place.
 *
 * ⚠ **STRAIGHT boards only, and a diagonal is refused with its reason rather
 * than approximated.** `buildDiagonalFromSpec` builds a brace through
 * `computeBraceBoardCornersIn` and `braceLongestEdgeIn`, which carry the
 * settled trapezoid geometry — the rigid shift that keeps a long point flush
 * with the panel edge, and the cut length taken across the longest edge. Those
 * are written around a 2x4's own width; handing them 5.5in would move the
 * mitres and the bearing point of every brace in the app, which is a building
 * decision and not a menu item.
 */
export function setMemberNominalSize(recipe: PanelRecipe, specId: string, nominalSize: "2x4" | "2x6"): EditorOpResult {
  const spec = specById(recipe, specId);
  if (!spec) return { recipe, accepted: false, message: "That member is not part of this panel." };
  if (spec.kind === "diagonal") {
    return {
      recipe,
      accepted: false,
      message:
        "A brace is built on the 2x4 brace geometry — its mitres, its flush long point and its cut length all measure off that width. Changing a diagonal to a 2x6 is a building decision, not a menu item.",
    };
  }
  const next = withSpec(recipe, specId, { ...spec, nominalSize });
  const clashes = newOverlapsFor(recipe, next, specId);
  if (clashes.length > 0) {
    return { recipe, accepted: false, message: `A ${nominalSize} there would run into ${clashes.join(", ")}. Move it clear first.` };
  }
  return { recipe: next, accepted: true, message: null };
}

/**
 * Send a board to the other face of the panel.
 *
 * ⚠ **The one move that is almost impossible to do by dragging**, which is why
 * it is on the menu: the editor draws the panel in elevation, and a wythe
 * change moves the board through the screen rather than across it.
 */
export function setMemberWythe(recipe: PanelRecipe, specId: string, wythe: PanelWythe): EditorOpResult {
  const spec = specById(recipe, specId);
  if (!spec) return { recipe, accepted: false, message: "That member is not part of this panel." };
  if (spec.wythe === wythe) return { recipe, accepted: true, message: null };
  const next = withSpec(recipe, specId, { ...spec, wythe });
  const clashes = newOverlapsFor(recipe, next, specId);
  if (clashes.length > 0) {
    return { recipe, accepted: false, message: `The ${wythe} face is already occupied there — ${clashes.join(", ")}.` };
  }
  return { recipe: next, accepted: true, message: null };
}

/* ──────────────────────────────────────────────────────────────────────────
   B30 — WHICH WAY THE BOARD IS TURNED, 2026-11-05.

   > *"A full height vertical should be 90 degrees plan view rotated - and
   > should only protrude into the panel it's 1.5in depth. You should very
   > easily be able to put a 2x6 and other sizes of nailers in. Not really sure
   > why you would put such a fat nailer in. There should be an option to
   > rotate it, and unable to do so if it overlaps or would hit the girt."*

   The default moved in `buildStraightFromSpec`; this is the "option to rotate
   it", and the refusal he asked for is the one the rest of this file already
   uses — `newOverlapsFor`, measured on the real prisms.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Turn a straight board through the panel's depth: flat against the face
 * (1.5in in, wide face out — a nailer) or standing on edge (wide face through
 * the depth — a stud).
 *
 * ⚠ **The refusal is the whole feature, not a guard on it.** Standing a board
 * on edge is the one member change in the editor that grows what it occupies
 * *through the depth* rather than across the face, and the thing it grows into
 * is the girt web lying across the middle of that depth. His sentence says so
 * directly: *"unable to do so if it overlaps or would hit the girt."* So the
 * message names what it hit, which on a 15.5in panel is almost always a web.
 *
 * ⚠ **A diagonal is refused outright and for a different reason than its
 * lumber size is.** A brace does not have two seatings to choose between: it
 * is let into the straw on its own flat inset and its trapezoid geometry is
 * written around that one depth. Turning one on edge is not a rotation of a
 * board, it is a different part.
 */
export function setMemberOnEdge(recipe: PanelRecipe, specId: string, onEdge: boolean): EditorOpResult {
  const spec = specById(recipe, specId);
  if (!spec) return { recipe, accepted: false, message: "That member is not part of this panel." };
  if (spec.kind === "diagonal") {
    return {
      recipe,
      accepted: false,
      message:
        "A brace is let into the straw on one flat inset, and its mitres are cut for that seating. Standing one on edge is a different part, not a rotation.",
    };
  }
  if ((spec.onEdge === true) === onEdge) return { recipe, accepted: true, message: null };
  const next = withSpec(recipe, specId, { ...spec, onEdge: onEdge ? true : undefined });
  const clashes = newOverlapsFor(recipe, next, specId);
  if (clashes.length > 0) {
    return {
      recipe,
      accepted: false,
      message: onEdge
        ? `On edge that board reaches ${(spec.nominalSize === "2x6" ? 5.5 : 3.5).toFixed(1)}″ into the panel and runs into ${clashes.join(", ")}. It stays flat.`
        : `Laid flat that board runs into ${clashes.join(", ")}.`,
    };
  }
  return { recipe: next, accepted: true, message: null };
}

/** Which way a spec is turned through the depth, as the editor labels it. */
export function memberDepthSeating(spec: AddedMemberSpec): "flat" | "on-edge" | "brace" {
  if (spec.kind === "diagonal") return "brace";
  return spec.onEdge === true ? "on-edge" : "flat";
}
