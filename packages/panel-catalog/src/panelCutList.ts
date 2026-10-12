import type { MemberRole, PanelMember } from "./componentSchema";
import { computeBraceEndCutAngleDeg, describeBraceEndCuts, type BraceEndCut } from "./panelMemberHelpers";
import { cutNoteForEnds, formatShopDegrees, formatShopInches } from "./shopCutNotes";

export interface PanelCutListRow {
  letter: string;
  role: MemberRole;
  material: "dimensional_lumber" | "plywood";
  partLabel: string;
  /** Count of distinct member positions sharing this letter — NOT each
   * member's own `qty` field summed on top of this (every current
   * producer sets `qty: 1` and represents multiples as separate array
   * entries; this is a defensive distinction, not a currently-observable
   * bug). */
  qty: number;
  dimensions: string;
  /**
   * The stock a shop asks for by name — `2x4`, `2x6`, `3/4" Plywood`.
   *
   * Tommy, 2026-10-11: *"using common denominational names for dimensional
   * lumber like 2x4 as materials"*. Split out of `partLabel` (which reads
   * "2x4 Plate") so the material is its own column and can be totalled,
   * scanned, or read off by someone pulling stock who does not care which
   * role a given stick fills.
   */
  materialLabel: string;
  /** The cut length — for lumber a single figure, for a sheet its two sides.
   * A trapezoid's figure is its LONG POINT, and says so, because a bare
   * number next to a bevel is ambiguous about which end it measures to. */
  lengthLabel: string;
  /** The angle(s) off square, or `"Square"`. Separate from `cutNote` so a
   * crew can scan a column for the one row that needs the saw reset. */
  angleLabel: string;
  /**
   * How to cut it, in words — the angle off square, what the finished end
   * does, and the two legs of the waste triangle to build a jig from.
   *
   * Empty string for a plain square crosscut, so the table can leave that
   * cell blank rather than printing a sentence on every row and burying the
   * three that matter.
   */
  cutNote: string;
  /** The real members sharing this letter, at their own real positions —
   * for a diagram to place the same letter at every occurrence. */
  members: PanelMember[];
}

// Tommy: "i need... plywood cuts of each unique panel" / "dimensional
// lumber cuts" — every other material (wire_mesh, fastener) is out of
// scope for a cut list; wood_fiber_board/osb have no current producer.
const CUT_LIST_MATERIALS = new Set<PanelMember["material"]>(["dimensional_lumber", "plywood"]);

// Largest, most structurally prominent pieces first (what a shop worker
// orients off first), infill next, secondary framing next, sheet goods
// last — independent of role, this only decides LETTER ORDER, not
// grouping (see cutKey below, which deliberately excludes role).
const ROLE_PRIORITY: Record<MemberRole, number> = {
  plate: 1,
  stud: 2,
  jack_stud: 3,
  girt: 4,
  girt_web: 5,
  nailer: 6,
  brace: 7,
  blocking: 8,
  skin: 9,
};

const ROLE_LABEL: Record<MemberRole, string> = {
  plate: "Plate",
  stud: "Stud",
  jack_stud: "Jack Stud",
  girt: "Girt Bar",
  girt_web: "Girt Web",
  nailer: "Nailer",
  brace: "Brace",
  blocking: "Blocking",
  skin: "Skin",
};

// Floating-point-noise guard only, not a shop-rounding tolerance — two
// trig-derived brace lengths that are conceptually "the same cut" land far
// closer together than this (~1e-10); this just keeps that noise from
// ever producing 2 near-identical letters for what's really one cut.
const DIM_EPSILON_IN = 0.001;

function roundDim(n: number): number {
  return Math.round(n / DIM_EPSILON_IN) * DIM_EPSILON_IN;
}

/** Identical cut = same letter. Deliberately excludes `role` — proven
 * necessary, not just permitted: a Column Panel's girt bars (role:
 * "girt") and blocking (role: "blocking") can be the exact same
 * `2x4 x depthIn` cut, and a shop cutting a batch of those doesn't care
 * which role a given stick ends up filling. A rounded bevel-angle bucket
 * is folded in for diagonal members as future-proofing — today's
 * `bracedPanelMembers.ts` guarantees every brace in one panel shares the
 * same tilt magnitude, so this never actually splits a group yet, but
 * costs nothing to guard against a future panel type that mixes angles. */
function cutKey(member: PanelMember): string {
  const { thicknessIn, widthIn, lengthIn } = member.actualDimsIn;
  const parts = [
    member.material,
    member.nominalSize ?? "",
    roundDim(thicknessIn).toFixed(3),
    roundDim(widthIn).toFixed(3),
    roundDim(lengthIn).toFixed(3),
  ];
  if (member.orientation === "diagonal" && member.position.tiltDeg !== undefined) {
    parts.push(Math.round(computeBraceEndCutAngleDeg(member.position.tiltDeg) / 0.1).toFixed(1));
  }
  return parts.join("|");
}

/** A, B, C, ... Z, AA, AB, ... — defensive beyond 26 (a dense header/gable
 * W-truss could plausibly exceed it eventually). */
function toSpreadsheetLetters(index: number): string {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

function formatDimIn(n: number): string {
  return `${parseFloat(n.toFixed(2))}"`;
}

/** Parses the leading fraction off a plySpec string (e.g.
 * "3/4in_5ply_CDX" -> `3/4"`) — plySpec is already human-authored for
 * exactly this purpose; falls back to the raw actual thickness only when
 * plySpec is null. */
function sheetThicknessLabel(member: PanelMember): string {
  if (member.plySpec) {
    const match = member.plySpec.match(/^(\d+(?:\/\d+)?)in/);
    if (match) return `${match[1]}"`;
  }
  return formatDimIn(member.actualDimsIn.thicknessIn);
}

/** Column/Corner's side plywood and a Safety/Gap sheet both carry
 * `role: "skin"` but are physically different things ("vertical"
 * orientation = a thin edge strip at the panel's own side, vs. "flat" =
 * a full top/bottom cap) — differentiate them in the printed label so 2-3
 * rows in the same table don't all just say the ambiguous bare "Skin". */
function roleLabelFor(member: PanelMember): string {
  if (member.role === "skin" && member.orientation === "vertical") return "Side Ply";
  return ROLE_LABEL[member.role];
}

function partLabelFor(member: PanelMember): string {
  const roleLabel = roleLabelFor(member);
  if (member.material === "plywood") return `${sheetThicknessLabel(member)} Plywood ${roleLabel}`;
  return `${member.nominalSize ?? formatDimIn(member.actualDimsIn.thicknessIn)} ${roleLabel}`;
}

/** Lumber (incl. tiltDeg-only diagonal members): t" x w" x l". A true
 * trapezoid brace: same 3-dim format (actualDimsIn.lengthIn is already
 * the "longest point to longest point" convention from
 * braceLongestEdgeIn) plus a qualifier and its own bevel angles, since a
 * plain length alone isn't enough for a shop to cut the bevel. Plywood: a
 * 2-dim sheet size (thickness already lives in the Part label). */
// Braced-Panel braces meet 2 stationary faces (a plate, a stud) — always
// exactly one "level" cut and one "plumb" cut, printed in that fixed order
// to match this codebase's own established convention. A header brace never
// gets a "plumb" cut at all — every end is "level" (both its 2 outermost
// feet, flush with a chord directly, and every internal peak/foot, a
// brace-to-brace miter that always resolves exactly horizontal per its own
// flat-chord symmetry — see describeBraceEndCuts's own doc comment).
// "angled" is possible in principle (a genuinely non-axis-aligned miter)
// but no current caller produces one.
function describeCut(cut: BraceEndCut): string {
  const label = cut.kind === "plumb" ? "plumb" : cut.kind === "level" ? "level" : "angled";
  return `${cut.angleDeg.toFixed(1)}° ${label}`;
}

/** The stock name on its own: nominal size for lumber, thickness for sheet. */
function materialLabelFor(member: PanelMember): string {
  if (member.material === "plywood") return `${sheetThicknessLabel(member)} Plywood`;
  return member.nominalSize ?? formatDimIn(member.actualDimsIn.thicknessIn);
}

/** The cut length. A sheet gets both sides; a trapezoid names its long point. */
function lengthLabelFor(member: PanelMember): string {
  const { widthIn, lengthIn } = member.actualDimsIn;
  if (member.material === "plywood") return `${formatShopInches(widthIn)} x ${formatShopInches(lengthIn)}`;
  const base = formatShopInches(lengthIn);
  return member.position.trapezoidCornersIn !== undefined ? `${base} long point` : base;
}

/** Both end cuts, sorted the way `dimensionsFor` already sorts them so the
 *  angle column and the note can never list them in different orders. */
function endCutsFor(member: PanelMember): BraceEndCut[] {
  if (member.position.trapezoidCornersIn === undefined) return [];
  const order = { level: 0, plumb: 1, angled: 2 };
  return describeBraceEndCuts(member.position.trapezoidCornersIn)
    .slice()
    .sort((a, b) => order[a.kind] - order[b.kind]);
}

function angleLabelFor(cuts: readonly BraceEndCut[]): string {
  if (cuts.length === 0) return "Square";
  const angles = [...new Set(cuts.map((c) => formatShopDegrees(c.angleDeg)))];
  return `${angles.join(" / ")} off square`;
}

function dimensionsFor(member: PanelMember): string {
  const { thicknessIn, widthIn, lengthIn } = member.actualDimsIn;
  if (member.material === "plywood") return `${formatDimIn(widthIn)} x ${formatDimIn(lengthIn)}`;

  const base = `${formatDimIn(thicknessIn)} x ${formatDimIn(widthIn)} x ${formatDimIn(lengthIn)}`;
  if (member.position.trapezoidCornersIn !== undefined) {
    // Real cuts derived directly from the trapezoid's own geometry (not
    // re-derived from tiltDeg alone) — correct uniformly for a Braced
    // Panel's plumb+level brace and a header's corner-clip/mitered mix.
    const cuts = describeBraceEndCuts(member.position.trapezoidCornersIn).slice().sort((a, b) => {
      const order = { level: 0, plumb: 1, angled: 2 };
      return order[a.kind] - order[b.kind];
    });
    return `${base} (long point, beveled ends: ${cuts.map(describeCut).join(" / ")})`;
  }
  return base;
}

/** One unique panel's materials cut list — every dimensional-lumber and
 * plywood member (Tommy: "dimensional lumber cuts and plywood cuts of
 * each unique panel"), grouped so identical cuts share one lettered row
 * with a quantity, in the same deterministic order every time. The
 * single source of truth for both a cut-list table AND a labeled 2D
 * diagram (see PanelElevationDiagram.tsx) — a letter always means the
 * same cut in both places, since both consume this same function. */
export function computePanelCutList(members: PanelMember[]): PanelCutListRow[] {
  const eligible = members.filter((m) => CUT_LIST_MATERIALS.has(m.material));

  const groups = new Map<string, PanelMember[]>();
  for (const m of eligible) {
    const key = cutKey(m);
    const existing = groups.get(key);
    if (existing) existing.push(m);
    else groups.set(key, [m]);
  }

  const rows = [...groups.values()].map((groupMembers) => {
    const first = groupMembers[0]!;
    return {
      role: first.role,
      material: first.material as "dimensional_lumber" | "plywood",
      partLabel: partLabelFor(first),
      materialLabel: materialLabelFor(first),
      lengthLabel: lengthLabelFor(first),
      angleLabel: angleLabelFor(endCutsFor(first)),
      // ⚠ Blank, not a sentence, for a square crosscut — see `cutNote`.
      cutNote:
        endCutsFor(first).length === 0
          ? ""
          : // The STOCK width, because the jig block is cut from stock — see
            // `missingTriangleFor`, which was built off the modelled face first
            // and found it disagreeing by up to 1/32in on a real brace.
            cutNoteForEnds(endCutsFor(first), first.actualDimsIn.widthIn),
      qty: groupMembers.length,
      dimensions: dimensionsFor(first),
      members: groupMembers,
      priority: Math.min(...groupMembers.map((m) => ROLE_PRIORITY[m.role])),
      firstIndex: Math.min(...groupMembers.map((m) => members.indexOf(m))),
    };
  });

  rows.sort((a, b) => a.priority - b.priority || a.firstIndex - b.firstIndex);

  return rows.map((row, i) => ({
    letter: toSpreadsheetLetters(i),
    role: row.role,
    material: row.material,
    partLabel: row.partLabel,
    materialLabel: row.materialLabel,
    lengthLabel: row.lengthLabel,
    angleLabel: row.angleLabel,
    cutNote: row.cutNote,
    qty: row.qty,
    dimensions: row.dimensions,
    members: row.members,
  }));
}
