import { describe, expect, it } from "vitest";
import { fastenerSpacingTable } from "@building-integrity/panel-catalog";
import {
  parseScheduleSpacing,
  scheduleCapacities,
  scheduleCapacityCoverage,
  screwsPerFoot,
  SCHEDULE_CAPACITY_REFUSAL_LABELS,
  SCHEDULE_CAPACITY_REFUSAL_REASONS,
  SCHEDULE_CAPACITY_REFUSALS,
  SCHEDULE_CONNECTION_GEOMETRY,
} from "./scheduleCapacity";
import { ESR_2442_TABLE_3_GRK_5_16 } from "./fastenerCapacity";

const ROWS = fastenerSpacingTable.map((r) => ({
  connection: r.connection,
  fastener: r.fastener,
  spacing: r.spacing,
}));

describe("screwsPerFoot", () => {
  it("is a rate, so 16in gives three quarters of a screw a foot", () => {
    expect(screwsPerFoot(16)).toBeCloseTo(0.75, 10);
    expect(screwsPerFoot(24)).toBeCloseTo(0.5, 10);
    expect(screwsPerFoot(12)).toBe(1);
    expect(screwsPerFoot(6)).toBe(2);
  });

  it("refuses a nonsense pitch rather than returning Infinity", () => {
    expect(() => screwsPerFoot(0)).toThrow(/no fasteners-per-foot rate/);
    expect(() => screwsPerFoot(-16)).toThrow(/no fasteners-per-foot rate/);
  });
});

describe("parseScheduleSpacing", () => {
  it("reads both figures when a row states an exterior and an interior pitch", () => {
    const parsed = parseScheduleSpacing(
      '16" o.c. exterior, 24" o.c. interior — the panel-to-panel schedule',
    );
    expect(parsed.figures.map((f) => f.quoted)).toEqual([
      '16" o.c. exterior',
      '24" o.c. interior',
    ]);
    expect(parsed.figures.map((f) => f.spacingIn)).toEqual([16, 24]);
    expect(parsed.perConnectionCount).toBeNull();
  });

  /* ⚠ The whole reason labels are adjacency-only. "exterior" appears in this
     row, several clauses away from the pitch and attached to a minimum count,
     not to the 18in. Labelling the 18in "exterior" would be a quiet lie. */
  it("does NOT label a pitch from a word that is not next to it", () => {
    const parsed = parseScheduleSpacing(
      '18" o.c., 45deg toe screw, min. 3 per panel at exterior',
    );
    expect(parsed.figures).toHaveLength(1);
    expect(parsed.figures[0].quoted).toBe('18" o.c.');
    expect(parsed.figures[0].quoted).not.toMatch(/exterior/);
  });

  /* The corner row quotes an edge distance and a pair gap in inches. Neither
     is a spacing, and neither carries "o.c.". */
  it("ignores inch figures that are not on-centre pitches", () => {
    const parsed = parseScheduleSpacing(
      '18" o.c., 45deg toe screw; paired at cross piece, 1" edge distance, 1 1/2" between pair',
    );
    expect(parsed.figures.map((f) => f.spacingIn)).toEqual([18]);
  });

  it("reads a fixed count when there is no pitch at all", () => {
    expect(parseScheduleSpacing("4 per connection").perConnectionCount).toBe(4);
    expect(parseScheduleSpacing("4 per connection").figures).toEqual([]);
    expect(parseScheduleSpacing('1 per seam, "so basically 4 per panel"').perConnectionCount).toBe(
      1,
    );
  });

  it("says so plainly when it can read neither", () => {
    const parsed = parseScheduleSpacing("as required by the detail");
    expect(parsed.figures).toEqual([]);
    expect(parsed.perConnectionCount).toBeNull();
    expect(parsed.why).toMatch(/No on-centre pitch and no per-connection count/);
  });
});

describe("the catalog's schedule is fully classified", () => {
  /* ⚠ A STANDING GUARD. A new row added to `fastenerSpacingTable` must be
     given either a geometry or a named refusal here. Without this, a new
     connection would report no capacity and read exactly like one that
     refuses for a stated reason. */
  it("has no unclassified row and no stale entry", () => {
    const coverage = scheduleCapacityCoverage(ROWS);
    expect(coverage.unclassified).toEqual([]);
    expect(coverage.stale).toEqual([]);
  });

  it("throws, rather than returning a blank, on a row it has never heard of", () => {
    expect(() =>
      scheduleCapacities([
        { connection: "Something new to panel", fastener: "GRK", spacing: '16" o.c.' },
      ]),
    ).toThrow(/is in neither SCHEDULE_CONNECTION_GEOMETRY nor SCHEDULE_CAPACITY_REFUSALS/);
  });

  it("classifies every row exactly once", () => {
    for (const row of ROWS) {
      const known = row.connection in SCHEDULE_CONNECTION_GEOMETRY;
      const refused = row.connection in SCHEDULE_CAPACITY_REFUSALS;
      expect(known !== refused, `${row.connection} must be known XOR refused`).toBe(true);
    }
  });
});

describe("the three connections that get a capacity", () => {
  const byConnection = new Map(scheduleCapacities(ROWS).map((c) => [c.connection, c]));

  it("is exactly three of eleven", () => {
    const withCapacity = scheduleCapacities(ROWS).filter((c) => c.perScrew !== null);
    expect(withCapacity).toHaveLength(3);
    expect(scheduleCapacities(ROWS)).toHaveLength(11);
  });

  it("takes Table 3's 236 lbf for a panel-to-panel seam", () => {
    const seam = byConnection.get("Panel to panel, exterior");
    expect(seam?.perScrew?.route).toBe("ESR-2442 Table 3 (tested)");
    expect(seam?.perScrew?.referenceZLb).toBe(236);
    expect(seam?.perScrew?.allowableLb).toBe(236);
  });

  /* ⚠ THE FIND. The schedule note claimed this joint takes Table 3's 3/4in
     row at "153-214 lbf". Table 3's 3/4in rows are for the 2 1/2in screw, so
     the table refuses a 4in screw through 3/4in of plywood outright — and 153
     is not a tabulated figure anywhere in it. */
  it("refuses Table 3 for the jack sheet and uses the calculated route instead", () => {
    const jack = byConnection.get("Jack stud to panel");
    expect(jack?.perScrew?.route).toBe("NDS 12.3 yield limit (calculated)");
    expect(jack?.perScrew?.allowableLb).toBeGreaterThan(110);
    expect(jack?.perScrew?.allowableLb).toBeLessThan(120);
  });

  it("puts the jack sheet BELOW the 133 lbf the old note's range reached for", () => {
    const jack = byConnection.get("Jack stud to panel");
    const lowestTabulated = Math.min(
      ...ESR_2442_TABLE_3_GRK_5_16.flatMap((r) => [r.parallelLb, r.perpendicularLb]),
    );
    expect(lowestTabulated).toBe(133);
    expect(jack?.perScrew?.allowableLb).toBeLessThan(lowestTabulated);
  });

  it("has no 153 anywhere in Table 3, which is what the old note quoted", () => {
    const every = ESR_2442_TABLE_3_GRK_5_16.flatMap((r) => [r.parallelLb, r.perpendicularLb]);
    expect(every).not.toContain(153);
  });

  /* The same schedule, half the capacity, because the side member is plywood
     rather than a stud. This is the comparison the page exists to make. */
  it("makes the jack sheet roughly half the seam per screw on the same schedule", () => {
    const jack = byConnection.get("Jack stud to panel")?.perScrew?.allowableLb ?? 0;
    const seam = byConnection.get("Panel to panel, exterior")?.perScrew?.allowableLb ?? 0;
    expect(jack / seam).toBeGreaterThan(0.4);
    expect(jack / seam).toBeLessThan(0.55);

    /* And both are on the same stated pitch, which is the point. */
    const jackPitches = byConnection.get("Jack stud to panel")?.figures.map((f) => f.spacingIn);
    expect(jackPitches).toEqual([16, 24]);
  });

  it("gives a per-foot figure at both load durations, the wind case being 1.6x", () => {
    const seam = byConnection.get("Panel to panel, exterior");
    const sixteen = seam?.figures.find((f) => f.spacingIn === 16);
    expect(sixteen?.screwsPerFoot).toBeCloseTo(0.75, 10);
    expect(sixteen?.perFootLb).toBeCloseTo(0.75 * 236, 6);
    expect(sixteen?.perFootWindSeismicLb).toBeCloseTo(0.75 * 236 * 1.6, 6);
  });

  it("makes the interior seam two thirds of the exterior per foot, from the pitch alone", () => {
    const interior = scheduleCapacities(ROWS).find(
      (c) => c.connection === "Panel to panel, interior",
    );
    const exterior = scheduleCapacities(ROWS).find(
      (c) => c.connection === "Panel to panel, exterior",
    );
    const i = interior?.figures[0].perFootLb ?? 0;
    const e = exterior?.figures[0].perFootLb ?? 0;
    expect(i / e).toBeCloseTo(16 / 24, 10);
  });

  /* ⚠ CD multiplies the wood value and NOT the steel ceiling, and at 1.6 the
     seam is still well under the screw's 884 lbf steel shear, so the wood
     governs in both cases. If a future change made the steel govern, this
     would catch it — the ratio would stop being exactly 1.6. */
  it("keeps the wood governing at CD 1.6 rather than hitting the steel ceiling", () => {
    const seam = byConnection.get("Panel to panel, exterior");
    expect(seam?.perScrew?.steelGoverns).toBe(false);
    expect(seam?.perScrewWindSeismic?.steelGoverns).toBe(false);
    const ratio =
      (seam?.perScrewWindSeismic?.allowableLb ?? 0) / (seam?.perScrew?.allowableLb ?? 1);
    expect(ratio).toBeCloseTo(1.6, 10);
  });
});

describe("the eight that refuse", () => {
  const refused = scheduleCapacities(ROWS).filter((c) => c.refusal !== null);

  it("is eight rows, each with a reason and no number", () => {
    expect(refused).toHaveLength(8);
    for (const row of refused) {
      expect(row.perScrew).toBeNull();
      expect(row.perScrewWindSeismic).toBeNull();
      expect(row.statement).toContain("No capacity is computed");
      expect(SCHEDULE_CAPACITY_REFUSAL_REASONS[row.refusal!].length).toBeGreaterThan(40);
    }
  });

  /* ⚠ A refusal must still carry the GEOMETRY it does know. The roof seam's
     18in pitch is a fact about the schedule and does not depend on which screw
     goes in it, so the count per foot survives while the pounds do not. */
  it("still reports a per-foot COUNT where the pitch is stated", () => {
    const roofSeam = refused.find((c) => c.connection === "Roof panel to roof panel, all seams");
    expect(roofSeam?.figures).toHaveLength(1);
    expect(roofSeam?.figures[0].spacingIn).toBe(18);
    expect(roofSeam?.figures[0].screwsPerFoot).toBeCloseTo(12 / 18, 10);
    expect(roofSeam?.figures[0].perFootLb).toBeNull();
  });

  it("refuses the ridge truss screw on the AXIS, not merely on the missing spec", () => {
    const truss = refused.find((c) => c.connection === "Roof panel to ridge beam, at each seam");
    expect(truss?.refusal).toBe("withdrawal-not-lateral");
    expect(truss?.statement).toMatch(/WITHDRAWAL/);
  });

  it("refuses both toe-screwed rows on geometry rather than on the screw", () => {
    for (const connection of ["Corner connection", "Wall panel to toe-up"]) {
      const row = refused.find((c) => c.connection === connection);
      expect(row?.refusal).toBe("toe-screw-geometry");
      expect(row?.statement).toMatch(/45deg/);
    }
  });

  it("names the one missing field for the cap and the roof seam", () => {
    expect(
      refused.find((c) => c.connection === "Ridge beam triangle cap to beam")?.refusal,
    ).toBe("length-not-stated");
    expect(
      refused.find((c) => c.connection === "Roof panel to roof panel, all seams")?.refusal,
    ).toBe("size-not-stated");
  });
});

describe("it reads as a document, not as a data structure", () => {
  /* All three of these were found by reading the rendered page in a browser,
     not by any gate. tsc, vitest and lint passed on every one of them. */

  it('says "1 per seam" where the row says seam, not "per connection"', () => {
    const truss = scheduleCapacities(ROWS).find(
      (c) => c.connection === "Roof panel to ridge beam, at each seam",
    );
    expect(truss?.perConnectionCount).toBe(1);
    expect(truss?.perConnectionUnit).toBe("seam");

    /* ⚠ Not a wording nit: a roof panel has FOUR seams, so a reader shown
       "1 per connection" is reading a rule four times weaker than his. */
    const pier = scheduleCapacities(ROWS).find((c) => c.connection === "Pier to beam");
    expect(pier?.perConnectionUnit).toBe("connection");
  });

  it("never doubles a full stop after a quoted pitch", () => {
    for (const row of scheduleCapacities(ROWS)) {
      expect(row.statement, row.connection).not.toContain("..");
    }
    expect(parseScheduleSpacing('24" o.c., staggered').why).not.toContain("..");
  });

  it("gives every refusal a readable label rather than its enum", () => {
    for (const refusal of Object.keys(SCHEDULE_CAPACITY_REFUSAL_LABELS) as Array<
      keyof typeof SCHEDULE_CAPACITY_REFUSAL_LABELS
    >) {
      const label = SCHEDULE_CAPACITY_REFUSAL_LABELS[refusal];
      expect(label).not.toBe(refusal);
      expect(label, `${refusal} still reads as an identifier`).not.toMatch(/^[a-z]+(-[a-z]+)+$/);
      expect(label.length).toBeGreaterThan(10);
    }
  });

  it("has a label for every refusal reason and no spare ones", () => {
    expect(Object.keys(SCHEDULE_CAPACITY_REFUSAL_LABELS).sort()).toEqual(
      Object.keys(SCHEDULE_CAPACITY_REFUSAL_REASONS).sort(),
    );
  });
});

describe("it never states an outcome", () => {
  /* ⚠ The standing rule across this whole area: both halves of a check are
     capacities, there is no demand anywhere in the app, and no statement here
     may read as a verdict. */
  it("says nothing passes or fails", () => {
    for (const row of scheduleCapacities(ROWS)) {
      expect(row.statement).not.toMatch(/\b(pass|fail)/i);
      expect(row.statement).not.toMatch(/\b(adequate|sufficient|safe|ok|approved)\b/i);
      for (const caveat of row.caveats) {
        expect(caveat).not.toMatch(/\b(pass|fail)/i);
      }
    }
  });

  it("says out loud that nothing is compared, on every row that has a number", () => {
    for (const row of scheduleCapacities(ROWS)) {
      if (row.perScrew === null) continue;
      expect(row.statement).toMatch(/models no force crossing this connection/);
    }
  });

  it("returns no boolean that could be read as a result", () => {
    const json = JSON.stringify(scheduleCapacities(ROWS));
    expect(json).not.toMatch(/"(adequate|passes|ok|compliant)":/);
  });
});
