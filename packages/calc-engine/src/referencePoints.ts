import { type DerivationStatus, derivationStatusNeedsReview } from "./derivationStatus";

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
 * app does NOT model — including the one that matters most for the item this
 * page is phase 1 of: **there is no roof connection in the schedule at all.**
 * A page that simply left those out would read as complete.
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
const JACK_ITEM_PATTERN = /T25 #9/i;

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
              "⚠ A force IS modelled for the BRACE — its axial capacity as a pin-ended strut, and the horizontal component of that. What is NOT modelled is whether these four screws can deliver that force into the frame.",
            seeAlso: "Shear Derivation sheet — every NDS step from the cut length to the pounds.",
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
      countStatement:
        group === "foundation"
          ? "Occurs in this building's foundation load path."
          : "Not counted by the app. The schedule states a spacing; nothing counts the fasteners it implies.",
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

  const jackTally = items.find((item) => JACK_ITEM_PATTERN.test(item.label));
  const jackSchedule = ctx.schedule.find((row) => /^jack stud/i.test(row.connection));
  if (jackTally !== undefined && jackSchedule !== undefined) {
    contradictions.push({
      id: "contradiction-jack-stud",
      subject: "How a jack stud is fastened to the panel beside it",
      a: `${jackTally.label} — Tommy's own, "screwed to the adjacent wall using 2 4in T25 #9 screws every 6in", and the one the app actually COUNTS (${jackTally.count.toLocaleString()} in this building).`,
      b: `${jackSchedule.fastener} at ${jackSchedule.spacing} — the schedule row, an NFW reference point nobody has confirmed, and counted nowhere.`,
      why: "⚠ A different screw at a different spacing for what reads as the same connection, and the two are far apart: 2 screws every 6in is four a foot, against one every two feet. Either they are two different connections and the schedule should say so, or one of them is wrong.",
    });
  }

  /* --- The gaps ------------------------------------------------------------ */
  const gaps: ReferencePointGap[] = [];

  gaps.push({
    id: "gap-roof",
    connection: "Anything to do with the roof",
    why: ctx.hasRoofPanels
      ? "⚠ THE SCHEDULE HAS NO ROOF ROW AT ALL — not roof-panel-to-roof-panel, not roof-panel-to-wall, not the ridge. This building HAS roof panels, so every one of those connections is being built to no stated schedule. It is the hole the roof-bracing item exists to fill."
      : "⚠ The schedule has no roof row at all — not roof-panel-to-roof-panel, not roof-panel-to-wall, not the ridge. This building has no roof panels yet, so nothing is unspecified in it today; draw a roof and that stops being true.",
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

  const needsReviewCount = points.filter((p) => derivationStatusNeedsReview(p.status)).length;
  const modeledLoadCount = points.filter((p) => p.load.modeled).length;

  return { points, contradictions, gaps, needsReviewCount, modeledLoadCount };
}

/** The points of one group, in the order they were built. */
export function referencePointsInGroup(sheet: ReferencePointsSheet, group: ReferencePointGroup): ReferencePoint[] {
  return sheet.points.filter((p) => p.group === group);
}
