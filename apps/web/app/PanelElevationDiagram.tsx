import { computePanelCutList, memberBoxSizeIn } from "@building-integrity/panel-catalog";
import type { PanelMember } from "@building-integrity/panel-catalog";
import { MATERIAL_FILL, MATERIAL_STROKE, projectMemberShapes, type ProjectedShape } from "./MemberElevationShapes";
import { projectPanelAxonometric, shadeHex } from "./panelAxonometric";
import styles from "./DiagramLegend.module.css";

export interface PanelElevationDiagramProps {
  members: PanelMember[];
  widthIn: number;
  heightIn: number;
  /** Shrinks the drawing to fit SheetTitleBlock's own sideDiagram zone
   * (~230-250px wide) — Tommy: "make the image a little bit smaller and
   * squeeze it, still adequately labeled." Only the panel geometry itself
   * gets more "zoomed out" (a smaller MAX_CANVAS_HEIGHT_PX); the lettered
   * badges shrink much less (10px radius -> 8px), so they stay a fixed,
   * legible size regardless of how small the drawing gets — the same
   * convention real technical drawings use. */
  compact?: boolean;
  /**
   * `"elevation"` (default) draws the flat, to-scale front view.
   * `"axonometric"` draws the panel as it sits in 3D — exterior face, tilted up
   * and to the left — with the SAME lettered badges on it.
   *
   * Tommy, 2026-10-11: *"the shop drawing image of each panel should be what
   * that panel looks like from the exterior up and left tilted as it would
   * appear when isolated in the 3D view"*, and, offered the choice between that
   * and keeping the letters, he asked for both.
   *
   * ⚠ **The elevation is still the right default and is not going away.** It is
   * the to-scale view, so it is the one you can measure off; the axonometric
   * shows form and cannot be measured. Panels where the shape is obvious lose
   * nothing by staying flat.
   */
  view?: "elevation" | "axonometric";
}

// Same navy-badge/white-text/dashed-leader convention already established
// by DiagramLegend.module.css's 8 other consumers (e.g. SlabFoundationDiagram.tsx).
/* ⚠ BADGES GREW ON 2026-10-11. Tommy, on the reference cut-list document he
   likes the shape of: *"very clear and large view of the panel with labels
   (although I don't like how the labels are small font here)"*. Ours were
   smaller than the ones he was complaining about — 11px full and 9px compact,
   and the fabrication sheet uses compact.

   The radius grows with the text rather than staying put, because a badge can
   carry TWO letters (`toSpreadsheetLetters` runs past Z on a dense header or
   gable truss) and 12px bold "AA" is about 14px wide — it would spill out of
   the old 16px-diameter circle. `collisionRadiusPx` and `badgeSpreadPx` are
   both derived from the radius, so the placement algorithm adapts to the larger
   badges on its own and nothing else needed retuning. */
const BADGE_RADIUS_PX = 12;
const INSIDE_THRESHOLD_PX = 30; // badge diameter (24px) + clearance
const LEADER_OFFSET_IN = 3.5; // in real inches, so it scales with the drawing like everything else

const MAX_CANVAS_HEIGHT_PX = 480;
const MIN_CANVAS_WIDTH_PX = 170; // a Safety/Gap panel is only 0.75in wide — floor so it isn't an unreadable sliver
const MARGIN_PX = 44; // room for leader-line badges to sit outside the panel's own outline

// compact mode's own equivalents — see the `compact` prop's own doc comment.
const BADGE_RADIUS_PX_COMPACT = 10;
const INSIDE_THRESHOLD_PX_COMPACT = 24; // badge diameter (20px) + clearance
const MAX_CANVAS_HEIGHT_PX_COMPACT = 190;
const MIN_CANVAS_WIDTH_PX_COMPACT = 90;
const MARGIN_PX_COMPACT = 20;
const WRAP_MAX_WIDTH_PX = 420;
const WRAP_MAX_WIDTH_PX_COMPACT = 230;
/** The width the axonometric fits itself into. Named rather than inlined so
 * the fit and the rendered max-width can never disagree. */
const WRAP_MAX_WIDTH_PX_FOR_FIT = (compact: boolean) => (compact ? WRAP_MAX_WIDTH_PX_COMPACT : WRAP_MAX_WIDTH_PX);

interface LetteredShape extends ProjectedShape {
  letter: string;
}

interface BadgePlacement {
  shape: LetteredShape;
  centroid: { xPx: number; yPx: number };
  inside: boolean;
  badgeX: number;
  badgeY: number;
  lineEndX: number;
  lineEndY: number;
}

// Two badges land within this many px of each other counts as a collision
// worth spreading apart — roughly 2 badge diameters, enough clearance that
// neither circle nor its text overlaps the other's. Derived from whichever
// badge radius is actually in play (see placeBadges's own badgeRadiusPx
// param), not always the full-size BADGE_RADIUS_PX.
function collisionRadiusPx(badgeRadiusPx: number): number {
  return badgeRadiusPx * 2 + 4;
}
function badgeSpreadPx(badgeRadiusPx: number): number {
  return badgeRadiusPx * 2 + 6;
}

/**
 * Places a badge for every shape — centered inside wide/tall shapes, or
 * outside on a dashed leader line for thin ones (see the module doc comment
 * for the general heuristic). Two members that are both thin, full-width Z
 * bands stacked at nearly the same panel edge (e.g. a top plate and its
 * immediately-adjacent skin cap, or a plate's own ext/int-wythe pair, which
 * project to the identical rectangle since they only differ in the
 * (invisible-in-2D) Y depth) push their leader-line badges toward nearly
 * the identical target, since both computations start from a near-
 * identical centroid and the same outward direction — Tommy: "when
 * labeling the plywood skin of the top and bottom plate... A and E
 * overlap... off center one or both of these labels." Resolved with a
 * second pass: badges pushing the same direction whose (pre-spread)
 * targets are within COLLISION_RADIUS_PX of ANY other badge in the same
 * connected group (transitively — not just their own nearest neighbor, so
 * a 3-way collision spreads as one group of 3 rather than 2 overlapping
 * pairs) are spread apart along the axis perpendicular to their shared
 * push direction, centered on the group's own average position — not a
 * full collision solver, just enough to separate the cases this diagram
 * actually produces (2-4 members capping the same panel edge).
 */
function placeBadges(
  shapes: LetteredShape[],
  panelCenterPx: { xPx: number; yPx: number },
  pxPerIn: number,
  badgeRadiusPx: number = BADGE_RADIUS_PX,
  insideThresholdPx: number = INSIDE_THRESHOLD_PX,
): BadgePlacement[] {
  const collisionRadius = collisionRadiusPx(badgeRadiusPx);
  const spreadPx = badgeSpreadPx(badgeRadiusPx);
  const placements = shapes.map((shape) => {
    const centroid = shape.centroidPx;
    const inside = shape.minorDimIn * pxPerIn >= insideThresholdPx;
    if (inside) {
      return { shape, centroid, inside: true, badgeX: centroid.xPx, badgeY: centroid.yPx, dirX: 0, dirY: 0 };
    }
    // Push outward from the member's own centroid, away from the panel's
    // center, along whichever axis has less room (the member's own short
    // axis).
    const dx = centroid.xPx - panelCenterPx.xPx;
    const dy = centroid.yPx - panelCenterPx.yPx;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const dirX = horizontal ? Math.sign(dx) || 1 : 0;
    const dirY = horizontal ? 0 : Math.sign(dy) || 1;
    const offsetPx = LEADER_OFFSET_IN * pxPerIn;
    return { shape, centroid, inside: false, badgeX: centroid.xPx + dirX * offsetPx, badgeY: centroid.yPx + dirY * offsetPx, dirX, dirY };
  });

  // Connected-components clustering via union-find: two same-direction
  // badges within COLLISION_RADIUS_PX of each other join one cluster,
  // transitively — a plain nearest-neighbor/grid-bucket check can miss a
  // genuinely-close pair that happens to straddle a bucket boundary.
  const outsideIdx: number[] = [];
  placements.forEach((p, i) => {
    if (!p.inside) outsideIdx.push(i);
  });
  const parent = new Map<number, number>(outsideIdx.map((i) => [i, i]));
  const find = (i: number): number => {
    let root = i;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = i;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (let a = 0; a < outsideIdx.length; a++) {
    for (let b = a + 1; b < outsideIdx.length; b++) {
      const i = outsideIdx[a]!;
      const j = outsideIdx[b]!;
      const p1 = placements[i]!;
      const p2 = placements[j]!;
      if (p1.dirX !== p2.dirX || p1.dirY !== p2.dirY) continue;
      if (Math.hypot(p2.badgeX - p1.badgeX, p2.badgeY - p1.badgeY) < collisionRadius) union(i, j);
    }
  }
  const clusters = new Map<number, number[]>();
  for (const i of outsideIdx) {
    const root = find(i);
    const existing = clusters.get(root);
    if (existing) existing.push(i);
    else clusters.set(root, [i]);
  }
  for (const idxs of clusters.values()) {
    if (idxs.length < 2) continue;
    const first = placements[idxs[0]!]!;
    // Spread along the axis perpendicular to the shared push direction —
    // pushing vertically (dirY set) spreads horizontally, and vice versa —
    // centered on the group's own average (pre-spread) position, in a
    // deterministic left-to-right / top-to-bottom order.
    const spreadAxisIsX = first.dirY !== 0;
    idxs.sort((a, b) =>
      spreadAxisIsX ? placements[a]!.centroid.xPx - placements[b]!.centroid.xPx : placements[a]!.centroid.yPx - placements[b]!.centroid.yPx,
    );
    const n = idxs.length;
    const avgX = idxs.reduce((s, i) => s + placements[i]!.badgeX, 0) / n;
    const avgY = idxs.reduce((s, i) => s + placements[i]!.badgeY, 0) / n;
    idxs.forEach((i, k) => {
      const spreadIndex = k - (n - 1) / 2;
      const p = placements[i]!;
      p.badgeX = avgX + (spreadAxisIsX ? spreadIndex * spreadPx : 0);
      p.badgeY = avgY + (spreadAxisIsX ? 0 : spreadIndex * spreadPx);
    });
  }

  return placements.map((p) => {
    if (p.inside) return { shape: p.shape, centroid: p.centroid, inside: true, badgeX: p.badgeX, badgeY: p.badgeY, lineEndX: p.badgeX, lineEndY: p.badgeY };
    // Line direction now points at wherever the badge actually ended up
    // (which may no longer be purely axis-aligned once spread apart),
    // shortened so it doesn't poke through the badge circle.
    const lineDx = p.badgeX - p.centroid.xPx;
    const lineDy = p.badgeY - p.centroid.yPx;
    const lineLen = Math.hypot(lineDx, lineDy) || 1;
    const unitX = lineDx / lineLen;
    const unitY = lineDy / lineLen;
    return {
      shape: p.shape,
      centroid: p.centroid,
      inside: false,
      badgeX: p.badgeX,
      badgeY: p.badgeY,
      lineEndX: p.badgeX - unitX * (badgeRadiusPx + 2),
      lineEndY: p.badgeY - unitY * (badgeRadiusPx + 2),
    };
  });
}

/**
 * To-scale 2D front elevation of one panel's real member geometry (Tommy:
 * "a 2d snap shot... labeling each dimensional lumber and plywood piece in
 * the panel") — X = panel width, Z = panel height, with the standard SVG
 * Y-flip (Z increases up from the panel's own bottom face; SVG y increases
 * down) applied once per projected point. Reuses `memberLocalCornersIn`
 * (the exact function the live 3D view and the OBJ exporter already
 * share) for every projection instead of re-deriving rotation math, so
 * this diagram can never visually disagree with the 3D model — correct
 * uniformly for a plain axis-aligned box, a tiltDeg-only rotated box
 * (header/gable/truss diagonal bracing), and a true beveled trapezoid
 * brace alike.
 *
 * Letters come from `computePanelCutList` — the SAME function a cut-list
 * table (PanelFabricationPage.tsx) also calls, so a letter always means
 * the same cut in both places.
 */
export default function PanelElevationDiagram({ members, widthIn, heightIn, compact = false, view = "elevation" }: PanelElevationDiagramProps) {
  const cutList = computePanelCutList(members);
  const letterByMemberId = new Map<string, string>();
  for (const row of cutList) {
    for (const m of row.members) letterByMemberId.set(m.memberId, row.letter);
  }

  const maxCanvasHeightPx = compact ? MAX_CANVAS_HEIGHT_PX_COMPACT : MAX_CANVAS_HEIGHT_PX;
  const minCanvasWidthPx = compact ? MIN_CANVAS_WIDTH_PX_COMPACT : MIN_CANVAS_WIDTH_PX;
  /* ⚠ THE MARGIN HAS TO HOLD A BADGE THAT HAS BEEN PUSHED OUT, not just the
     panel outline. A badge for a thin member is moved `badgeSpreadPx` clear of
     its own centroid and then occupies its own radius on top of that, so the
     room needed is spread + radius — about 36px for the compact badges, where
     the old fixed margin was 20. On the elevation the overflow was mostly
     hidden because the panel outline sits well inside a wide viewBox; on the
     axonometric the drawing fills more of the frame and badges were visibly
     sliced in half at the edge. Taking the larger of the two keeps every
     existing elevation at least as roomy as it was. */
  const badgeRoomPx = badgeSpreadPx(compact ? BADGE_RADIUS_PX_COMPACT : BADGE_RADIUS_PX) + (compact ? BADGE_RADIUS_PX_COMPACT : BADGE_RADIUS_PX) + 4;
  const marginPx = Math.max(compact ? MARGIN_PX_COMPACT : MARGIN_PX, badgeRoomPx);
  const badgeRadiusPx = compact ? BADGE_RADIUS_PX_COMPACT : BADGE_RADIUS_PX;
  const insideThresholdPx = compact ? INSIDE_THRESHOLD_PX_COMPACT : INSIDE_THRESHOLD_PX;
  // See BADGE_RADIUS_PX: 9/11 was smaller than the document Tommy called small.
  const badgeFontSizePx = compact ? 12 : 14;
  const wrapMaxWidthPx = compact ? WRAP_MAX_WIDTH_PX_COMPACT : WRAP_MAX_WIDTH_PX;

  // Only lumber/plywood cut-list members are part of this diagram's scope
  // (matches computePanelCutList's own material filter).
  const eligibleMembers = members.filter((m) => letterByMemberId.has(m.memberId));

  /* ⚠ THE AXONOMETRIC IS THE SAME DIAGRAM, NOT A SECOND ONE — which is the
     whole reason it lives in this file. Tommy asked for the shop drawing's
     image to be the 3D view *and* to keep its labels; the labels are
     `placeBadges` below, with its collision avoidance and leader lines, and it
     works in plain SVG pixels. Feeding it projected centroids instead of
     elevation centroids gets the badges onto the 3D view for free, with
     identical behaviour, rather than a second placement implementation that
     would drift from this one. Only the GEOMETRY branches; everything from
     `panelCenterPx` down is shared. */
  const axo = view === "axonometric" ? projectPanelAxonometric(eligibleMembers) : null;

  const axoWidthIn = axo ? axo.bounds.maxU - axo.bounds.minU : 0;
  const axoHeightIn = axo ? axo.bounds.maxV - axo.bounds.minV : 0;
  // Fit the projected drawing to the same canvas the elevation gets, by
  // whichever axis runs out first — a panel seen at an angle is wider than it
  // is tall far more often than the flat elevation is.
  const pxPerIn = axo
    ? Math.min(
        maxCanvasHeightPx / Math.max(axoHeightIn, 1e-6),
        (WRAP_MAX_WIDTH_PX_FOR_FIT(compact) - 2 * marginPx) / Math.max(axoWidthIn, 1e-6),
      )
    : maxCanvasHeightPx / heightIn;
  const panelHeightPx = (axo ? axoHeightIn : heightIn) * pxPerIn;
  const panelWidthPx = Math.max(minCanvasWidthPx - 2 * marginPx, (axo ? axoWidthIn : widthIn) * pxPerIn);

  const viewBoxWidth = Math.max(minCanvasWidthPx, panelWidthPx + 2 * marginPx);
  const viewBoxHeight = panelHeightPx + 2 * marginPx;
  const originX = (viewBoxWidth - panelWidthPx) / 2;
  const originY = marginPx;

  const xToPx = (xIn: number) => originX + xIn * pxPerIn;
  const zToPx = (zIn: number) => originY + (heightIn - zIn) * pxPerIn;
  const uToPx = (uIn: number) => originX + (uIn - (axo?.bounds.minU ?? 0)) * pxPerIn;
  const vToPx = (vIn: number) => originY + (vIn - (axo?.bounds.minV ?? 0)) * pxPerIn;

  // Tracks which cut letters already have a badge on the axonometric.
  const seenLetters = new Set<string>();
  const shapes: LetteredShape[] = axo
    ? /* ⚠ ONE BADGE PER LETTER, ON THE NEAREST OCCURRENCE — Tommy, 2026-10-13.
         A 3D view shows both wythes, so labelling every member put a braced
         panel's 7 cut letters on screen about 24 times and buried the drawing.
         The cut list already states the quantity: the table says HOW MANY, the
         drawing says WHERE. Nearest rather than first, because a leader line
         pointing at a member hidden behind another one is worse than no leader
         at all. */
      eligibleMembers
        .map((member, i) => ({ member, c: axo.centroids[i]! }))
        .sort((a, b) => a.c.depthIn - b.c.depthIn)
        /* ⚠ An explicit seen-set, NOT `new Map(pairs)`. A Map built from
           [key, value] pairs keeps the LAST entry for each key, so against a
           nearest-first list it would have selected the FARTHEST occurrence of
           every letter — the exact opposite of the intent, and invisible in a
           rendered drawing where some badge is present either way. */
        .filter((entry) => {
          const letter = letterByMemberId.get(entry.member.memberId)!;
          if (seenLetters.has(letter)) return false;
          seenLetters.add(letter);
          return true;
        })
        .map(({ member, c }) => {
        const size = memberBoxSizeIn(member);
        return {
          member,
          kind: "polygon" as const,
          // `placeBadges` reads only `centroidPx` and `minorDimIn`; the faces are
          // drawn from `axo.faces` instead, sorted back to front.
          points: [],
          centroidPx: { xPx: uToPx(c.uIn), yPx: vToPx(c.vIn) },
          minorDimIn: Math.min(size.xIn, size.yIn, size.zIn),
          letter: letterByMemberId.get(member.memberId)!,
        };
      })
    : projectMemberShapes(eligibleMembers, xToPx, zToPx).map((shape) => ({
        ...shape,
        letter: letterByMemberId.get(shape.member.memberId)!,
      }));

  const panelCenterPx = { xPx: originX + panelWidthPx / 2, yPx: originY + panelHeightPx / 2 };

  const badges = placeBadges(shapes, panelCenterPx, pxPerIn, badgeRadiusPx, insideThresholdPx);

  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        style={{ width: "100%", maxWidth: wrapMaxWidthPx, height: "auto" }}
        role="img"
        /* ⚠ AN AXONOMETRIC IS NOT TO SCALE, and must not say it is. Nothing on
           a tilted view can be measured off the page, so a label promising
           to-scale would be a false claim on a document a shop builds from —
           and the one a screen reader hears. The dimensions are still named,
           because they are the panel/s real size; only the promise changes. */
        aria-label={
          view === "axonometric"
            ? `3D view from the exterior, tilted up and left, of a panel ${widthIn}in wide x ${heightIn}in tall, with lettered part callouts. Not to scale.`
            : `To-scale front elevation, ${widthIn}in wide x ${heightIn}in tall, with lettered part callouts`
        }
      >
        {/* Panel outline, for reference — on the flat elevation only. Around an
            axonometric it would be a box the panel does not fill, which reads
            as a drawing error rather than as a reference. */}
        {!axo && (
          <rect x={originX} y={originY} width={panelWidthPx} height={panelHeightPx} fill="none" stroke="#bbb" strokeWidth={1} />
        )}

        {/* ⚠ EVERY FACE OF EVERY MEMBER, FARTHEST FIRST — the painter's
            algorithm, sorted in `projectPanelAxonometric`. Drawn as one flat
            list rather than grouped per member on purpose: members interleave
            in depth (a brace passes behind one stud and in front of the next),
            so grouping by member would paint whole boards over each other and
            put the panel inside out. */}
        {axo?.faces.map((face, i) => {
          const member = eligibleMembers[face.memberIndex]!;
          const material = member.material as "dimensional_lumber" | "plywood";
          return (
            <polygon
              key={`face-${i}`}
              points={face.points.map((p) => `${uToPx(p.uIn)},${vToPx(p.vIn)}`).join(" ")}
              fill={shadeHex(MATERIAL_FILL[material], face.shade)}
              stroke={MATERIAL_STROKE[material]}
              strokeWidth={0.5}
              strokeLinejoin="round"
            />
          );
        })}

        {!axo && shapes.map((shape) => {
          const isPlywood = shape.member.material === "plywood";
          const fill = MATERIAL_FILL[shape.member.material as "dimensional_lumber" | "plywood"];
          const stroke = MATERIAL_STROKE[shape.member.material as "dimensional_lumber" | "plywood"];
          const dash = isPlywood ? "4 3" : undefined;

          return (
            <g key={shape.member.memberId}>
              {shape.kind === "rect" ? (
                <rect
                  x={shape.rect!.xPx}
                  y={shape.rect!.yPx}
                  width={shape.rect!.widthPx}
                  height={shape.rect!.heightPx}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray={dash}
                />
              ) : (
                <polygon
                  points={shape.points!.map((p) => `${p.xPx},${p.yPx}`).join(" ")}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray={dash}
                />
              )}
            </g>
          );
        })}

        {badges.map(({ shape, centroid, inside, badgeX, badgeY, lineEndX, lineEndY }) =>
          inside ? (
            <g key={`${shape.member.memberId}-badge`}>
              <circle cx={badgeX} cy={badgeY} r={badgeRadiusPx} fill="#1c3d5a" />
              <text x={badgeX} y={badgeY + (compact ? 3 : 4)} fontSize={badgeFontSizePx} fontWeight={700} fill="#fff" textAnchor="middle">
                {shape.letter}
              </text>
            </g>
          ) : (
            <g key={`${shape.member.memberId}-badge`}>
              <line x1={centroid.xPx} y1={centroid.yPx} x2={lineEndX} y2={lineEndY} stroke="#999" strokeWidth={1} strokeDasharray="3 2" />
              <circle cx={badgeX} cy={badgeY} r={badgeRadiusPx} fill="#1c3d5a" />
              <text x={badgeX} y={badgeY + (compact ? 3 : 4)} fontSize={badgeFontSizePx} fontWeight={700} fill="#fff" textAnchor="middle">
                {shape.letter}
              </text>
            </g>
          ),
        )}
      </svg>
    </div>
  );
}
