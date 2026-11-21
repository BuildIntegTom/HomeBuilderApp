import { type DerivationStatus, derivationStatusNeedsReview } from "./derivationStatus";
import {
  type BraceEndConnectionComparison,
  ESR_2442,
  FASTENER_CAPACITY_SCOPE_LIMIT,
  braceEndConnectionComparison,
  fastenerCapacityInputs,
} from "./fastenerCapacity";
import type { DerivationInput } from "./shearDerivation";

/**
 * **THE REFERENCE POINTS PAGE — phase 1 of the roof-bracing item.**
 *
 * > *"there should be some good effort put into prepping all of this in a nice
 * > tidy Reference Points page or something like that where a summary of all
 * > the connections are shown and shown how theyre derrived."*
 * > — Tommy, 2026-11-18
 *
 * Every connection the app knows about, on one page, each with its fastener,
 * its spacing, how many the drawn building has, where the number came from,
 * and — the part that matters — **what force the app models across it**.
 *
 * ⚠ **FOR MOST CONNECTIONS, THE ANSWER TO THAT LAST ONE IS "NOTHING", AND
 * SAYING SO IS THE POINT OF THE PAGE.** The app counts fasteners for weight
 * and quotes a spacing schedule for the shop; it does not check either against
 * a load. One connection has a modelled force — the diagonal brace, through
 * `computeBracedPanelShearCapacityLb` and the Shear Derivation sheet — and
 * twelve do not. An engineer handed a page of spacings with no indication of
 * which have been reasoned about would have to re-derive all of them to find
 * out. Phase 2 of the item is turning the spacings into calculations; this
 * page is what makes the size of that job visible first.
 *
 * ⚠ **IT INHERITS THE SHEAR SHEET'S REFUSAL.** That sheet names no seismic
 * zone, because a rating is capacity against DEMAND and this app has no demand
 * figures. The same line holds here, and harder: Tommy, 2026-11-18, asked
 * whether an engineer had reviewed any of it — *"no there has definetely not
 * been any engioneer that has looked at this. this app shouldnt be that and i
 * cant believe thats even a possibility."* **Nothing on this page may state
 * that a connection, a panel or a building passes.** What it states is what
 * was drawn and where each number came from.
 *
 * ⚠ **THE GAPS ARE ROWS, NOT OMISSIONS.** `gaps` carries the connections the
 * app does NOT model. A page that simply left them out would read as complete.
 *
 * ⚠ **AND THEY HAVE TO BE RETIRED WHEN THEY ARE ANSWERED.** This comment used
 * to say *"there is no roof connection in the schedule at all"*, which stopped
 * being true on 2026-11-20 when Tommy gave the roof its first schedule. A gap
 * left standing after its answer arrives is the page contradicting itself,
 * which is the exact defect it was built to catch — and `gap-roof` below had
 * to be narrowed on the same day for the same reason.
 */

/**
 * ⚠ **Matching a tally line by its LABEL is a seam, and it is named here
 * rather than inlined.** `computeFastenerWeight` builds those labels as prose
 * — "4in GRK screw (brace members, 2 at each end)" — so this page reads a
 * string that module writes for a human. Changing one of those labels without
 * changing these patterns makes the brace row quietly lose its load statement
 * and the contradictions quietly disappear, which is a page going silent
 * rather than a test going red. The tests pin both patterns against the real
 * labels for that reason.
 */
const BRACE_ITEM_PATTERN = /brace member/i;

/**
 * ⚠ **THE JACK-STUD PATTERN IS GONE, AND SO IS THE CONTRADICTION IT FOUND.**
 *
 * This module shipped on 2026-11-18 matching `/T25 #9/i` to surface a clash:
 * Tommy's own "2 4in T25 #9 screws every 6in" was the rule the app counted,
 * while the catalog schedule quoted a GRK 5/16"x4" at 24" o.c. for the same
 * joint and was counted nowhere. He settled it the next day — *"might as well
 * just have jack studs also get big screws. just the one schedule."* — so
 * there is now one rule, the schedule's, and the app counts it.
 *
 * The contradiction is **resolved, not suppressed**: the schedule row's own
 * note records which rule superseded which and why the count fell, and a test
 * asserts no reference point anywhere still mentions a T25. Deleting a
 * contradiction without leaving that trail would make the page's one job —
 * saying where a number came from — unverifiable for the next reader.
 */
export const RETIRED_JACK_FASTENER_PATTERN = /T25/i;

/**
 * ⚠ **THE SCHEDULE ROW AND THE IN-PANEL TALLY ARE NOW THE SAME CONNECTION.**
 *
 * Before 2026-11-19 they were two different rules, so two rows was right. Now
 * that the jack sheet follows the schedule, a schedule row reading *"Not
 * counted by the app"* sits a few lines under an in-panel row reading *"108 in
 * this building"* — **for the same screw in the same joint.** That is the
 * duplicate-brace-row defect of phase 1 recurring, in the one direction the
 * page is least allowed to get wrong, and it was found in the browser again.
 *
 * So a schedule row whose connection the tally already counts says so and
 * points at it, rather than claiming nothing counts it.
 */
const JACK_TALLY_PATTERN = /jack sheet to panel/i;

/** Tommy, 2026-10-25: two screws at each end of every diagonal. */
const SCREWS_PER_BRACE = 4;

/** Which part of the building a reference point belongs to. */
export type ReferencePointGroup =
  /** Fastening inside one panel, in the shop. */
  | "in-panel"
  /**
   * Put together on site. Panel to panel, but also panel to jack stud, panel
   * to toe-up and the corner — which is why it is NOT called "panel to panel".
   * ⚠ The browser caught that: a "Jack stud to panel" row sitting under a
   * *Panel to panel* heading, carrying a sentence about diaphragm seams, is a
   * page telling an engineer something untrue about where a screw goes.
   */
  | "assembly"
  /** Panel to the ground, through the foundation's load path. */
  | "foundation";

export const REFERENCE_POINT_GROUP_LABELS: Record<ReferencePointGroup, string> = {
  "in-panel": "Inside a panel (shop)",
  assembly: "Put together on site",
  foundation: "Down to the ground",
};

/** The order the groups read in: how a panel is built, then how it is joined. */
export const REFERENCE_POINT_GROUP_ORDER: readonly ReferencePointGroup[] = ["in-panel", "assembly", "foundation"];

/** What the app knows about the force crossing one connection. */
export interface ReferencePointLoad {
  /** True only when a number exists somewhere in the app for this. */
  modeled: boolean;
  statement: string;
  /** Where a reader can go and check it. */
  seeAlso?: string;
}

export interface ReferencePoint {
  id: string;
  group: ReferencePointGroup;
  connection: string;
  fastener: string;
  spacing: string;
  /**
   * How many this building has, or why the app cannot say. Always a sentence
   * rather than a number, because "0" and "not counted" are different answers
   * and a column of integers cannot tell them apart.
   */
  countStatement: string;
  status: DerivationStatus;
  note: string;
  load: ReferencePointLoad;
}

/**
 * ⚠ **TWO PLACES IN THE APP THAT DISAGREE ABOUT THE SAME CONNECTION.**
 *
 * Found by reading this page in a browser on the day it was built, which is
 * the argument for the page existing at all: both numbers had been in the app
 * for weeks, on different screens, and nothing had ever put them side by side.
 * A sheet handed to an engineer that quotes two different answers without
 * saying so is worse than one that quotes neither.
 */
export interface ReferencePointContradiction {
  id: string;
  subject: string;
  /** One answer, and where in the app it comes from. */
  a: string;
  /** The other. */
  b: string;
  /** Why they differ, as far as the app can actually say — never a guess. */
  why: string;
}

/** A connection the app does not model, named so the page is not read as complete. */
export interface ReferencePointGap {
  id: string;
  connection: string;
  /** What is missing and what it costs to leave missing. */
  why: string;
}

export interface ReferencePointsSheet {
  points: ReferencePoint[];
  contradictions: ReferencePointContradiction[];
  gaps: ReferencePointGap[];
  /** How many points still need an engineer to supply something. */
  needsReviewCount: number;
  /** How many have a modelled force. ⚠ Expected to be small. */
  modeledLoadCount: number;
  /**
   * **What one screw can hold, and where that came from.**
   *
   * ⚠ Added 2026-11-19 on his *"can you find a number?"*. Until then the page
   * reported eight spacings and no capacity at all, which is why phase 2 could
   * not start: a spacing cannot be derived from a load without knowing what
   * one fastener is good for. The figures are ICC-ES ESR-2442's, cited, and
   * cross-checked against the NDS yield-limit equations — see
   * `fastenerCapacity`.
   */
  capacityInputs: DerivationInput[];
  /** The report these are from, so the page can print the citation once. */
  capacitySource: { id: string; revised: string; url: string; scopeLimit: string };
  /**
   * The brace end: two screws against the strut they hold. Null before
   * anything is drawn, or when the caller has no brace to compare.
   *
   * ⚠ **Not a check.** Both numbers are capacities and neither is a demand.
   */
  braceEndConnection: BraceEndConnectionComparison | null;
}

/** One row of the catalog's fastener schedule, as this module needs it. */
export interface ReferencePointScheduleRow {
  connection: string;
  fastener: string;
  spacing: string;
  status: DerivationStatus;
  note?: string;
}

/**
 * The part of a `FastenerWeightResult` this page reads.
 *
 * ⚠ **Narrowed on purpose: the page must not be handed a number it does not
 * use.** The caller aggregates the building's tally by label and has no
 * per-screw weight to give, so taking the full `FastenerWeightResult` meant
 * the page SYNTHESISING a `unitWeightLb` from a division nothing then read.
 * Fabricating an unused figure on a page whose whole subject is where numbers
 * come from is the wrong habit to leave in the data path, however harmless.
 */
export interface ReferencePointFastenerTally {
  items: readonly { label: string; count: number; totalWeightLb: number }[];
}

export interface ReferencePointsContext {
  /**
   * `fastenerSpacingTable`, passed in rather than imported — calc-engine takes
   * catalog DATA as an argument everywhere else (`foundationFastenerSchedule`
   * is the precedent) so a test can state the table it is reasoning about.
   */
  schedule: readonly ReferencePointScheduleRow[];
  /** Which schedule connections this building's foundation actually uses. */
  foundationConnections: readonly string[];
  /** The whole building's panel fastener tally, or null before anything is drawn. */
  panelFasteners: ReferencePointFastenerTally | null;
  /** Panels in the building, for the per-seam arithmetic the page cannot do yet. */
  panelCount: number;
  /**
   * Braces the SHEAR DERIVATION sheet reads. ⚠ NOT the same population the
   * fastener tally counts, which is the first entry in `contradictions`.
   */
  shearBraceCount: number;
  /** True once the building has roof panels, which sharpens the missing-roof gap. */
  hasRoofPanels: boolean;
  /**
   * One brace's axial capacity from the Shear Derivation sheet, for the
   * end-connection comparison. Omit when nothing braced is drawn.
   *
   * ⚠ **The MEDIAN or a representative brace, not the largest.** Passing the
   * strongest brace in the building would make the connection look worst, and
   * a page that picks the unflattering case on purpose is as unreliable as one
   * that picks the flattering case.
   */
  braceAxialCapacityLb?: number;
  /**
   * How deep a brace-end screw lands in the brace.
   *
   * ⚠ **His figure, not an app assumption, and still stated by the caller
   * rather than defaulted here.** Tommy, 2026-11-20: a 4in GRK through the
   * 1 1/2in stud leaving 2 1/2in in the brace, walls and roof alike. The
   * screw's real length makes that 2 3/8in — exactly ESR-2442 Table 3's
   * minimum. What remains open is the grain angle at the beveled end cut;
   * see `gap-brace-end-grain-angle`.
   */
  braceEndPenetrationIn?: number;
}

/**
 * The connections the schedule treats as panel-to-panel rather than foundation.
 *
 * ⚠ **Derived by exclusion, deliberately.** A row is "down to the ground" when
 * the FOUNDATION's own load path claims it (`foundationFastenerSchedule`
 * already answers that, per foundation type) and panel-to-panel otherwise. The
 * alternative — a hand-written list here — would silently miscategorise any
 * row added to the catalog later, and the page would look right while doing it.
 */
function groupForScheduleRow(
  row: ReferencePointScheduleRow,
  foundationConnections: readonly string[],
): ReferencePointGroup {
  return foundationConnections.includes(row.connection) ? "foundation" : "assembly";
}

/**
 * How many of a schedule row's fasteners this building has — or why not.
 *
 * ⚠ **It must never say "not counted" about a connection the tally counts.**
 * See `JACK_TALLY_PATTERN`.
 */
function scheduleRowCountStatement(
  row: ReferencePointScheduleRow,
  group: ReferencePointGroup,
  items: readonly { label: string; count: number }[],
): string {
  if (group === "foundation") return "Occurs in this building's foundation load path.";
  const counted = /^jack stud/i.test(row.connection)
    ? items.find((item) => JACK_TALLY_PATTERN.test(item.label))
    : undefined;
  if (counted !== undefined) {
    return `${counted.count.toLocaleString()} in this building — counted, because this is the same rule as the in-panel row "${counted.label}" above. One schedule, one count.`;
  }
  return "Not counted by the app. The schedule states a spacing; nothing counts the fasteners it implies.";
}

/**
 * ⚠ **What a panel-to-panel seam is assumed to carry: nothing, yet.**
 *
 * This is the sentence that phase 4 replaces. The research behind the item
 * found that a panelized diaphragm's strength is governed by its JOINT
 * FASTENERS rather than by its skin, which makes these the most important
 * rows on the page and the emptiest. Stated plainly rather than left blank.
 */
function assemblyLoad(connection: string, panelCount: number): ReferencePointLoad {
  /* ⚠ Only a row that really IS panel-to-panel gets the seam sentence. A jack
     stud, a toe-up and a corner are all in this group and none of them is a
     diaphragm seam. */
  if (connection.toLowerCase().startsWith("panel to panel") && panelCount > 0) {
    return {
      modeled: false,
      statement: `No force is modelled across this seam. The building drawn has ${panelCount} panels, so it has seams in the hundreds, and the app checks the spacing against none of them.`,
      seeAlso: "Phase 2 of the roof-bracing item derives a spacing from a load; phase 4 states what crosses each seam.",
    };
  }
  return {
    modeled: false,
    statement:
      "No force is modelled across this connection. The spacing is a stated schedule, not a figure derived from a load.",
  };
}

/**
 * Build the sheet.
 *
 * ⚠ **Rows whose count the app does not track still appear.** A fastener rule
 * the app quotes but never counts is exactly the kind of thing that reads as
 * handled; `countStatement` says "not counted by the app" in so many words.
 */
export function buildReferencePoints(ctx: ReferencePointsContext): ReferencePointsSheet {
  const points: ReferencePoint[] = [];

  /* ⚠ Computed BEFORE the rows, because the brace row's load statement is the
     one place on the page that changes when a capacity exists. Until
     2026-11-19 it ended "What is NOT modelled is whether these four screws can
     deliver that force into the frame"; leaving that sentence standing beside a
     section that now answers it would be the page contradicting itself, which
     is the exact defect it was built to catch. */
  const braceEndConnection =
    ctx.braceAxialCapacityLb !== undefined && ctx.braceEndPenetrationIn !== undefined
      ? braceEndConnectionComparison({
          braceAxialCapacityLb: ctx.braceAxialCapacityLb,
          penetrationIn: ctx.braceEndPenetrationIn,
        })
      : null;

  /* --- Inside a panel ------------------------------------------------------
     These come off `computeFastenerWeight`, which counts them for WEIGHT.
     Worth being explicit about: the counts are real and live, and the reason
     they exist is a weight total, not a structural check.

     ⚠ The per-rule note that used to sit on every one of these rows is now a
     single paragraph on the page. Five copies of the same paragraph buried the
     one line that differs between the rows, which is the count. */
  const items = ctx.panelFasteners?.items ?? [];
  for (const item of items) {
    const isBrace = BRACE_ITEM_PATTERN.test(item.label);
    points.push({
      id: `in-panel-${item.label}`,
      group: "in-panel",
      connection: item.label,
      fastener: "",
      /* The label already states the rule ("4in o.c., plates + girts",
         "8 each"), so a spacing column here would repeat it. */
      spacing: "",
      countStatement: `${item.count.toLocaleString()} in this building (${item.totalWeightLb.toFixed(1)} lb).`,
      status: "confirmed",
      note: isBrace
        ? 'Tommy, 2026-10-25: "Each end of each 2x4 on the diagonals has 2 5/16in GRKs 4in screws predrilled and driven."'
        : "",
      load: isBrace
        ? {
            modeled: true,
            statement:
              braceEndConnection === null
                ? "⚠ A force IS modelled for the BRACE — its axial capacity as a pin-ended strut, and the horizontal component of that. What is NOT modelled is whether these four screws can deliver that force into the frame."
                : `⚠ A force IS modelled for the BRACE — its axial capacity as a pin-ended strut, and the horizontal component of that. These screws have a capacity too: ${Math.round(braceEndConnection.perEndLb)} lbf at each end against ${Math.round(braceEndConnection.braceAxialCapacityLb)} lbf in the strut, so the ENDS are the smaller number by a factor of about ${(1 / Math.max(braceEndConnection.ratio, 1e-9)).toFixed(1)}. Neither figure is a demand and neither says the brace passes. The ${braceEndConnection.penetrationIn}in penetration is Tommy's detail of 2026-11-20 (through a ${braceEndConnection.sideMemberIn}in stud), which is what lets ESR-2442 Table 3's tested row apply at all.`,
            seeAlso:
              braceEndConnection === null
                ? "Shear Derivation sheet — every NDS step from the cut length to the pounds."
                : "Shear Derivation sheet for the strut; the capacity section below for the screws.",
          }
        : {
            modeled: false,
            statement:
              "No force is modelled. These counts exist so the panel has a weight, not because anything was checked.",
          },
    });
  }

  /* --- The schedule -------------------------------------------------------- */
  for (const row of ctx.schedule) {
    const group = groupForScheduleRow(row, ctx.foundationConnections);
    points.push({
      id: `schedule-${row.connection}`,
      group,
      connection: row.connection,
      fastener: row.fastener,
      spacing: row.spacing,
      countStatement: scheduleRowCountStatement(row, group, items),
      status: row.status,
      note: row.note ?? "",
      load: assemblyLoad(row.connection, ctx.panelCount),
    });
  }

  /* --- Where the app disagrees with itself --------------------------------
     ⚠ BOTH OF THESE WERE FOUND BY READING THIS PAGE IN A BROWSER on the day
     it was built. Each had been true for weeks on two different screens. */
  const contradictions: ReferencePointContradiction[] = [];

  const braceItem = items.find((item) => BRACE_ITEM_PATTERN.test(item.label));
  if (braceItem !== undefined && ctx.shearBraceCount > 0) {
    /* Four screws a brace is the rule the tally counts by, so the brace count
       it implies is its screw count over four. */
    const tallyBraces = Math.round(braceItem.count / SCREWS_PER_BRACE);
    if (tallyBraces !== ctx.shearBraceCount) {
      contradictions.push({
        id: "contradiction-brace-count",
        subject: "How many diagonal braces this building has",
        a: `${tallyBraces.toLocaleString()} — from the fastener tally (${braceItem.count.toLocaleString()} screws at ${SCREWS_PER_BRACE} a brace), which is what the weight and the shop sheets are built on.`,
        b: `${ctx.shearBraceCount.toLocaleString()} — from the Shear Derivation sheet, which is what the building's reported capacity is built on.`,
        why: "⚠ The two count different populations and neither is wrong on its own terms. The fastener tally counts every member whose ROLE is `brace`, which includes a header's truss webs. The shear derivation reads only panels that carry a bracing PATTERN, so a truss web is counted for weight and not for capacity. The number an engineer should use depends on which question is being asked — and nothing in the app said so until this page.",
      });
    }
  }

  /* ⚠ The jack-stud contradiction that shipped here on 2026-11-18 is GONE
     because he resolved it on 2026-11-19, not because it was dropped. See
     `RETIRED_JACK_FASTENER_PATTERN`. */

  /* --- The gaps ------------------------------------------------------------ */
  const gaps: ReferencePointGap[] = [];

  gaps.push({
    id: "gap-roof-to-wall",
    connection: "A roof panel down to the wall it lands on",
    why: ctx.hasRoofPanels
      ? "⚠ NARROWED on 2026-11-20, and it used to say the schedule had NO roof row at all. Tommy has now given three: " +
        "the seams between roof panels (GRK at 18in o.c.), the truss screw at each seam into the ridge beam, and the " +
        "triangle cap itself (glue and #10 T25 at 8in). What is STILL unstated is the other end — how a roof panel is " +
        "fastened DOWN to the wall, truss plate or box beam it bears on at the eave. This building has roof panels, so that " +
        "joint is being built to no stated schedule, and it is the one that carries the roof's weight into the wall."
      : "⚠ The schedule says nothing about how a roof panel is fastened down to the wall it bears on at the eave. " +
        "This building has no roof panels yet, so nothing is unspecified in it today; draw a roof and that stops being true. " +
        "(The seams, the ridge truss screw and the triangle cap DO have a schedule as of 2026-11-20.)",
  });

  gaps.push({
    id: "gap-roof-diaphragm",
    connection: "The roof as a diaphragm",
    why: "⚠ A roof panel has NO plywood on its large faces, and the app models no roof diaphragm of any kind. The in-plane strength of a finished roof comes entirely from the site-applied structural sheathing, which the app does not know about and does not price.",
  });

  gaps.push({
    id: "gap-corner-ply-seam",
    connection: "Column/Corner panel side plywood to the corner studs",
    why: "Real contact, deliberately not counted: it was not part of the per-member nailing spec, so counting it would be inventing a rule. The panel's fastener weight is therefore slightly LOW, not high.",
  });

  gaps.push({
    id: "gap-blocking",
    connection: "Blocking, inside a Column or Corner panel",
    why: "No fastener rule has been specified for it, so it is carried at zero rather than estimated.",
  });

  gaps.push({
    id: "gap-ring-tie-lap",
    connection: "A ring girt's 42in tie lapping a cut rail",
    why: "The 28-screws-per-ring figure is Tommy's exactly and does not cover this lap, so a panel whose rings are cut is under-counted by however many screws it turns out to take.",
  });

  gaps.push({
    id: "gap-brace-end-grain-angle",
    connection: "Which way the grain runs where a brace end screw lands",
    why:
      "⚠ The penetration behind the brace-end capacity above is no longer a gap — Tommy settled it on 2026-11-20: a 4in GRK " +
      "through the 1 1/2in stud, 2 1/2in into the brace, walls and roof alike. What is still open is the GRAIN. A brace end is a beveled cut, so the screw " +
      "enters that cut face and runs lengthwise into the member at an angle to the grain, where ESR-2442 Table 3 was tested across " +
      "the SIDE grain of a main member. The app takes the LESSER of the tabulated and the calculated value for that reason, which " +
      "cannot overstate the connection but is not the same as having it checked. " +
      "⚠ And it clears Table 3's 2 3/8in minimum by NOTHING: the screw is 3 7/8in long, not 4, so 3.875 − 1.5 = 2.375in exactly. " +
      "Any thickening of what the screw crosses first — an engineered stud at 1 5/8in, a skin it must also pass, a head left proud — " +
      "drops this connection out of the tested row and onto the calculated route. That is a question for Building Integrity.",
  });

  if (ctx.hasRoofPanels) {
    gaps.push({
      id: "gap-roof-fastener-count",
      connection: "Every roof panel seam",
      why:
        "⚠ Roof panels now have a fastener SCHEDULE and still have no fastener COUNT. Tommy prescribed it on 2026-11-20 — " +
        "GRKs at 18in o.c. on all the seams, plus a truss screw at each seam, \"so basically 4 per panel\" — and the schedule " +
        "rows say so. What has not been built is the counting: `computeFastenerWeight` is written over WALL-panel roles " +
        "(plate and girt-bar length), and a roof panel is joists with no girt at all, so its sheet reports fasteners as " +
        "UNMODELED rather than zero. " +
        "⚠ So every roof panel's weight is LOW by its own screws, and the shop packet prescribes a schedule it does not tally. " +
        "That is the next piece of work, not a question — but until it lands, a roof panel's fastener line is a rule with no number.",
    });

    gaps.push({
      id: "gap-ridge-truss-screw-spec",
      connection: "The truss screw holding a roof panel down to the ridge beam",
      why:
        "⚠ Tommy's 2026-11-20 instruction is understood and its GEOMETRY is modelled: the triangle cap is only " +
        "(4.5/2) x pitch/12 deep — 3/4in at 4:12, tapering to nothing at both edges — so a screw stopping in the cap holds " +
        "the roof with at most 3/4in of thread, where one carried into the beam gains the 2x12's 11 1/4in. Withdrawal is " +
        "roughly linear in thread penetration (NDS 12.2.3), so that difference is most of the capacity. " +
        "⚠ WHAT IS MISSING IS THE SCREW: no type, diameter or length has been given, and `withdrawalPerInchLb` has nothing " +
        "to multiply without a diameter. Two numbers would close it. " +
        "⚠ AND EVEN THEN IT WOULD NOT BE A CHECK: the app models no wind or seismic UPLIFT demand, so a withdrawal capacity " +
        "would sit beside nothing, exactly as the brace's axial capacity does. " +
        "⚠ ESR-2442's own withdrawal table is NOT transcribed here; the NDS formula is the cross-check route, not the " +
        "published answer. " +
        "⚠ The cap is also GLUED (construction adhesive, his word), and no adhesive is counted in any material total or price, " +
        "so a glued joint currently reads as free.",
    });
  }

  const needsReviewCount = points.filter((p) => derivationStatusNeedsReview(p.status)).length;
  const modeledLoadCount = points.filter((p) => p.load.modeled).length;

  return {
    points,
    contradictions,
    gaps,
    needsReviewCount,
    modeledLoadCount,
    capacityInputs: fastenerCapacityInputs(),
    capacitySource: {
      id: ESR_2442.id,
      revised: ESR_2442.revised,
      url: ESR_2442.url,
      scopeLimit: FASTENER_CAPACITY_SCOPE_LIMIT,
    },
    braceEndConnection,
  };
}

/** The points of one group, in the order they were built. */
export function referencePointsInGroup(sheet: ReferencePointsSheet, group: ReferencePointGroup): ReferencePoint[] {
  return sheet.points.filter((p) => p.group === group);
}
