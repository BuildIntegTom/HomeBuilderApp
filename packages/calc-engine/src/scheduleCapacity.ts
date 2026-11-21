import {
  allowableLateralLoadLb,
  CD_NORMAL,
  CD_WIND_SEISMIC,
  esrLateralDesignValue,
  GRK_5_16_RSS,
  ndsYieldLimitZ,
  SPF_SPECIFIC_GRAVITY,
  type ConnectionGeometry,
  type LateralCapacity,
} from "./fastenerCapacity";

/**
 * ROOF BRACING, PHASE 2 — what a spacing is WORTH.
 *
 * Phase 1 put every connection the app knows about on one page with its
 * fastener and its spacing. This turns that table into a calculation: for each
 * row, how many fasteners a foot the spacing implies, and what one of them is
 * allowed to carry. The table stays the output — nothing here changes a
 * schedule — but a reader can now see a connection's capacity in pounds per
 * foot instead of only its pitch in inches.
 *
 * ⚠ **IT IS HALF A CALCULATION, DELIBERATELY, AND THE MISSING HALF IS DEMAND.**
 * The phase as planned was *"per connection: the force crossing it, the
 * capacity of one GRK in the relevant mode, the count that needs, and the
 * spacing that count implies"*. The force crossing it does not exist: this app
 * models no wind or seismic demand, and inventing one would be the worst thing
 * it could do on this page. So the direction is reversed — the spacing is the
 * input and the capacity is the output. **Nothing here says a spacing is
 * adequate, because nothing here knows.** What it gives an engineer is a
 * number already in the units their own demand calculation produces.
 *
 * ⚠ **THREE ROWS OF ELEVEN GET A CAPACITY. The other eight REFUSE, each naming
 * the one field that would close it**, which is the more useful half: it turns
 * "the app does not know" into a short, specific shopping list.
 */

/** One `N" o.c.` figure a schedule row states, with the row's own wording. */
export interface ScheduleSpacingFigure {
  /** Quoted from the row, so a label is never inferred. */
  quoted: string;
  spacingIn: number;
  /** 12 / spacing. ⚠ A RATE, not a count — see `screwsPerFoot`. */
  screwsPerFoot: number;
}

export interface ScheduleSpacingParse {
  figures: readonly ScheduleSpacingFigure[];
  /** Set only when the row states a fixed count and no o.c. pitch at all. */
  perConnectionCount: number | null;
  /**
   * What the row counts that fixed number PER — its own word, not a generic
   * one. ⚠ The ridge row says "1 per **seam**" and a reader shown "1 per
   * connection" would be reading a different rule: a roof panel has four
   * seams, so the two phrasings differ by a factor of four.
   */
  perConnectionUnit: string | null;
  why: string;
}

/** Append a full stop unless the text already ends in one. */
function endSentence(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}

/**
 * Fasteners per foot from an on-centre pitch.
 *
 * ⚠ **This is a rate, and a real run is counted differently.** A 24in panel
 * edge at 18in o.c. does not get 1.5 screws; `computeRoofPanelSeamFastenerWeight`
 * rounds and floors at one, because a seam with no fastener in it is not a
 * seam. The rate is the right thing for a capacity per foot and the wrong
 * thing for a purchase order, and the two must not be confused.
 */
export function screwsPerFoot(spacingIn: number): number {
  if (!(spacingIn > 0)) {
    throw new Error(`A spacing of ${spacingIn}in has no fasteners-per-foot rate.`);
  }
  return 12 / spacingIn;
}

/**
 * Pull the on-centre figures out of a schedule row's prose.
 *
 * ⚠ **A LABEL IS QUOTED, NEVER GUESSED.** Only a word immediately following
 * `o.c.` is taken as that figure's label, so `18" o.c., 45deg toe screw, min. 3
 * per panel at exterior` yields one UNLABELLED 18in figure rather than an 18in
 * "exterior" one. A schedule's prose is not a grammar, and a label attached to
 * the wrong number would be worse than no label at all.
 */
export function parseScheduleSpacing(spacing: string): ScheduleSpacingParse {
  const figures: ScheduleSpacingFigure[] = [];
  const ocPattern = /(\d+)"\s*o\.c\.[ \t]*(exterior|interior)?/gi;
  let match: RegExpExecArray | null;
  while ((match = ocPattern.exec(spacing)) !== null) {
    const spacingIn = Number(match[1]);
    const label = match[2];
    figures.push({
      quoted:
        label === undefined ? `${spacingIn}" o.c.` : `${spacingIn}" o.c. ${label.toLowerCase()}`,
      spacingIn,
      screwsPerFoot: screwsPerFoot(spacingIn),
    });
  }

  if (figures.length > 0) {
    return {
      figures,
      perConnectionCount: null,
      perConnectionUnit: null,
      /* ⚠ `endSentence`, because a quoted pitch already ends in the full stop
         of "o.c." and a second one rendered as `24" o.c..` on a page written
         to be handed to an engineer. */
      why: endSentence(
        `${figures.length} on-centre figure${figures.length === 1 ? "" : "s"} read from the row: ${figures
          .map((f) => f.quoted)
          .join(", ")}`,
      ),
    };
  }

  const perConnection = /(\d+)\s*per\s+(connection|seam|panel|joint)/i.exec(spacing);
  if (perConnection !== null) {
    const unit = perConnection[2].toLowerCase();
    return {
      figures: [],
      perConnectionCount: Number(perConnection[1]),
      perConnectionUnit: unit,
      why: `No on-centre pitch; the row states a fixed count of ${perConnection[1]} per ${unit}. A fixed count has no per-foot rate.`,
    };
  }

  return {
    figures: [],
    perConnectionCount: null,
    perConnectionUnit: null,
    why: "No on-centre pitch and no per-connection count could be read from this row's wording.",
  };
}

/** Why a row gets no capacity. One of these is always the whole reason. */
export type ScheduleCapacityRefusal =
  | "not-this-fastener"
  | "diameter-not-transcribed"
  | "length-not-stated"
  | "size-not-stated"
  | "toe-screw-geometry"
  | "withdrawal-not-lateral";

export const SCHEDULE_CAPACITY_REFUSAL_REASONS: Record<ScheduleCapacityRefusal, string> = {
  "not-this-fastener":
    "This connection does not use a GRK RSS screw, so ESR-2442 says nothing about it. Its own evaluation report, and the NDS values for its fastener type, would be the route.",
  "diameter-not-transcribed":
    'ESR-2442 Table 3 is transcribed here for the 5/16in RSS only, which is the screw the app buys. This row calls for a different diameter, and no tabulated row for it exists in this module.',
  "length-not-stated":
    "The screw's LENGTH is not stated in the schedule, and length sets the penetration every lateral value depends on. One number from Building Integrity closes it.",
  "size-not-stated":
    "The screw's SIZE is not stated in the schedule. Every other GRK row in the table is the 5/16in x 4in RSS and that is what the app would carry, but it was not restated for this joint and the app will not assume it.",
  "toe-screw-geometry":
    "⚠ A screw driven at 45deg does not present the member thicknesses a lateral value needs. Neither its side-member path nor its penetration is the thickness of either piece, and both move with the angle it is actually driven at. This wants a detail drawing, not a number.",
  "withdrawal-not-lateral":
    "⚠ This joint is loaded along the screw's axis, in WITHDRAWAL, not across it in shear. A different limit state, a different NDS chapter and a different number — see `withdrawalPerInchLb`, which still has no diameter to multiply.",
};

/**
 * A few words a reader can take in at a glance.
 *
 * ⚠ **The page shows these, not the enum.** A formal document written to be
 * handed to an engineer rendered `no capacity — toe-screw-geometry` on its
 * first draft, which is a programmer's identifier wearing a document's
 * clothes. The enum stays the stable key; this is what gets printed.
 */
export const SCHEDULE_CAPACITY_REFUSAL_LABELS: Record<ScheduleCapacityRefusal, string> = {
  "not-this-fastener": "not a GRK RSS screw",
  "diameter-not-transcribed": "a diameter this app has not transcribed",
  "length-not-stated": "the screw's length is not stated",
  "size-not-stated": "the screw's size is not stated",
  "toe-screw-geometry": "toe-screwed at 45deg, so it needs a detail",
  "withdrawal-not-lateral": "loaded in withdrawal, not shear",
};

/**
 * The geometry of a connection the app genuinely knows, with the provenance of
 * every figure in it.
 *
 * ⚠ **A SIDE MEMBER IS WHAT THE SCREW GOES THROUGH, and getting it wrong is
 * how a table like this overstates a joint.** See the jack stud below.
 */
export interface ScheduleConnectionGeometry {
  geometry: ConnectionGeometry;
  provenance: string;
  caveats: readonly string[];
}

/**
 * ⚠ **THE JACK STUD IS WHY THIS MODULE EXISTS, and it found a live error in
 * the app's own schedule note.**
 *
 * Tommy's 2026-11-19 decision put the jack sheet on the panel-to-panel
 * schedule — *"might as well just have jack studs also get big screws. just
 * the one schedule."* The schedule note then claimed the joint takes
 * *"ESR-2442 Table 3's 3/4in row (153-214 lbf)"*. Two things are wrong with
 * that, and both make the connection look STRONGER than it is:
 *
 *   1. **Table 3's 3/4in rows are for the 2 1/2in screw**, not the 4in screw
 *      this joint uses. The 4in screw's only rows are tested through a 1 1/2in
 *      side member, so Table 3 **refuses** a 4in screw through 3/4in of
 *      plywood outright — thinner than tested, and the table cannot be
 *      interpolated downward.
 *   2. **153 lbf is not a value in Table 3 at all.** The tabulated figures are
 *      133, 168, 178, 214, 236, 239, 257, 265, 289, 333 and 472.
 *
 * The honest figure comes from the calculated route: **about 115 lbf a screw**,
 * governing in NDS mode IIIs — BELOW even the 133 the note's range was
 * reaching for. So the same schedule worth ~236 lbf a screw at a
 * panel-to-panel seam is worth roughly half that at a jack sheet, and the note
 * had it the other way about.
 */
export const SCHEDULE_CONNECTION_GEOMETRY: Readonly<
  Record<string, ScheduleConnectionGeometry>
> = {
  "Jack stud to panel": {
    geometry: {
      screwOverallLengthIn: 4,
      sideMemberThicknessIn: 0.75,
      penetrationIn: GRK_5_16_RSS.overallLengthIn - 0.75,
      specificGravity: SPF_SPECIFIC_GRAVITY,
    },
    provenance:
      "The jack sheet is 3/4in plywood, so the screw crosses 3/4in and lands 3 1/8in deep. Side member from the schedule note's own description of the joint; screw from the row itself.",
    caveats: [
      "⚠ Table 3 does not apply here and the calculated route governs: a 4in screw through 3/4in is thinner than the 1 1/2in side member its rows are tested with.",
      "⚠ Roughly half the per-screw capacity of the identical schedule at a panel-to-panel seam, because the side member is plywood rather than a stud.",
    ],
  },
  "Panel to panel, interior": {
    geometry: {
      screwOverallLengthIn: 4,
      sideMemberThicknessIn: 1.5,
      penetrationIn: GRK_5_16_RSS.overallLengthIn - 1.5,
      specificGravity: SPF_SPECIFIC_GRAVITY,
    },
    provenance:
      "A seam screw crosses one 1 1/2in stud and lands 2 3/8in into the stud of the panel beside it. Exactly Table 3's tested configuration for this screw.",
    caveats: [],
  },
  "Panel to panel, exterior": {
    geometry: {
      screwOverallLengthIn: 4,
      sideMemberThicknessIn: 1.5,
      penetrationIn: GRK_5_16_RSS.overallLengthIn - 1.5,
      specificGravity: SPF_SPECIFIC_GRAVITY,
    },
    provenance:
      "The same joint and the same screw as the interior row; only the pitch differs. 1 1/2in side member, 2 3/8in penetration.",
    caveats: [
      "⚠ The penetration clears Table 3's 2 3/8in minimum by nothing at all, so any thickening of the side member drops this joint onto the calculated route.",
    ],
  },
};

/** Which rows refuse, and the single reason each one refuses for. */
export const SCHEDULE_CAPACITY_REFUSALS: Readonly<Record<string, ScheduleCapacityRefusal>> = {
  "Corner connection": "toe-screw-geometry",
  "Pier to beam": "not-this-fastener",
  "Floor panel to beam": "diameter-not-transcribed",
  "Toe-up to floor panel": "not-this-fastener",
  "Ridge beam triangle cap to beam": "length-not-stated",
  "Roof panel to roof panel, all seams": "size-not-stated",
  "Roof panel to ridge beam, at each seam": "withdrawal-not-lateral",
  "Wall panel to toe-up": "toe-screw-geometry",
};

/** One schedule row's spacing turned into pounds, or an honest refusal. */
export interface ScheduleCapacityFigure extends ScheduleSpacingFigure {
  /** screwsPerFoot x the per-screw allowable, at normal load duration. */
  perFootLb: number | null;
  /** The same at CD 1.6, the case a lateral-force connection is designed for. */
  perFootWindSeismicLb: number | null;
}

export interface ScheduleCapacity {
  connection: string;
  fastener: string;
  spacing: string;
  figures: readonly ScheduleCapacityFigure[];
  perConnectionCount: number | null;
  /** The row's own word for what that count is per. See `ScheduleSpacingParse`. */
  perConnectionUnit: string | null;
  /** Null whenever the row refuses. */
  perScrew: LateralCapacity | null;
  perScrewWindSeismic: LateralCapacity | null;
  refusal: ScheduleCapacityRefusal | null;
  /** The whole story for this row, in one paragraph. Never a verdict. */
  statement: string;
  caveats: readonly string[];
}

/** The shape this module needs from the catalog's schedule table. */
export interface ScheduleCapacityRowInput {
  connection: string;
  fastener: string;
  spacing: string;
}

function perScrewFor(known: ScheduleConnectionGeometry, cd: number): LateralCapacity {
  const tabulated = esrLateralDesignValue(known.geometry);
  if (tabulated.applies) {
    return allowableLateralLoadLb(tabulated.zLb, "ESR-2442 Table 3 (tested)", cd);
  }
  const calculated = ndsYieldLimitZ({
    minorThreadDiameterIn: GRK_5_16_RSS.minorThreadDiameterIn,
    bendingYieldStrengthPsi: GRK_5_16_RSS.bendingYieldStrengthPsi,
    sideMemberThicknessIn: known.geometry.sideMemberThicknessIn,
    penetrationIn: known.geometry.penetrationIn,
    specificGravity: known.geometry.specificGravity,
  });
  return allowableLateralLoadLb(calculated.zLb, "NDS 12.3 yield limit (calculated)", cd);
}

/**
 * Every schedule row, with a capacity where one is knowable.
 *
 * ⚠ **A ROW THE APP HAS NEITHER GEOMETRY NOR A REFUSAL FOR THROWS.** A new
 * connection added to the catalog's schedule must be classified here before
 * this will render, which is deliberate: the alternative is a row that
 * silently reports no capacity and reads exactly like a row that refuses for a
 * reason. `scheduleCapacityCoverage` is the test-facing half of the same rule.
 */
export function scheduleCapacities(
  rows: readonly ScheduleCapacityRowInput[],
): ScheduleCapacity[] {
  return rows.map((row) => {
    const parsed = parseScheduleSpacing(row.spacing);
    const known = SCHEDULE_CONNECTION_GEOMETRY[row.connection];
    const refusal = SCHEDULE_CAPACITY_REFUSALS[row.connection];

    if (known === undefined && refusal === undefined) {
      throw new Error(
        `The fastener schedule row "${row.connection}" is in neither SCHEDULE_CONNECTION_GEOMETRY nor SCHEDULE_CAPACITY_REFUSALS. Classify it: either give it a geometry with provenance, or name the one field that is missing.`,
      );
    }

    if (known === undefined) {
      const reason = SCHEDULE_CAPACITY_REFUSAL_REASONS[refusal];
      return {
        connection: row.connection,
        fastener: row.fastener,
        spacing: row.spacing,
        figures: parsed.figures.map((f) => ({
          ...f,
          perFootLb: null,
          perFootWindSeismicLb: null,
        })),
        perConnectionCount: parsed.perConnectionCount,
        perConnectionUnit: parsed.perConnectionUnit,
        perScrew: null,
        perScrewWindSeismic: null,
        refusal,
        statement: `${parsed.why} No capacity is computed for this connection. ${reason}`,
        caveats: [],
      };
    }

    const normal = perScrewFor(known, CD_NORMAL);
    const windSeismic = perScrewFor(known, CD_WIND_SEISMIC);

    return {
      connection: row.connection,
      fastener: row.fastener,
      spacing: row.spacing,
      figures: parsed.figures.map((f) => ({
        ...f,
        perFootLb: f.screwsPerFoot * normal.allowableLb,
        perFootWindSeismicLb: f.screwsPerFoot * windSeismic.allowableLb,
      })),
      perConnectionCount: parsed.perConnectionCount,
      perConnectionUnit: parsed.perConnectionUnit,
      perScrew: normal,
      perScrewWindSeismic: windSeismic,
      refusal: null,
      statement:
        `${parsed.why} One screw is allowed ${Math.round(normal.allowableLb)} lbf at normal load duration and ` +
        `${Math.round(windSeismic.allowableLb)} lbf at CD 1.6 for wind or seismic, by the ${normal.route} route. ` +
        `${known.provenance} ⚠ The app models no force crossing this connection, so neither figure is compared with anything.`,
      caveats: known.caveats,
    };
  });
}

/**
 * ⚠ **THE COVERAGE CHECK, so a new schedule row cannot be forgotten.**
 *
 * Returns the connections this module classifies but the catalog no longer
 * has, and the catalog rows this module has never heard of. A standing test
 * asserts both are empty; `scheduleCapacities` throws on the second case at
 * runtime, and this names the first, which is the stale-entry half a throw
 * cannot catch.
 */
export function scheduleCapacityCoverage(rows: readonly ScheduleCapacityRowInput[]): {
  unclassified: string[];
  stale: string[];
} {
  const present = new Set(rows.map((r) => r.connection));
  const classified = new Set([
    ...Object.keys(SCHEDULE_CONNECTION_GEOMETRY),
    ...Object.keys(SCHEDULE_CAPACITY_REFUSALS),
  ]);
  return {
    unclassified: [...present].filter((c) => !classified.has(c)).sort(),
    stale: [...classified].filter((c) => !present.has(c)).sort(),
  };
}
