import { describe, expect, it } from "vitest";

import {
  DERIVATION_STATUS_MEANINGS,
  DERIVATION_STATUS_ORDER,
  type DerivationStatus,
  derivationStatusNeedsReview,
} from "./derivationStatus";
import { buildBracedPanelMembers } from "@building-integrity/panel-catalog";

import { BRACE_END_PENETRATION_IN } from "./fastenerCapacity";
import { computeFastenerWeight, computeJackStudFastenerWeight } from "./fastenerWeight";
import type { ReferencePointFastenerTally } from "./referencePoints";
import {
  REFERENCE_POINT_GROUP_LABELS,
  REFERENCE_POINT_GROUP_ORDER,
  RETIRED_JACK_FASTENER_PATTERN,
  type ReferencePointScheduleRow,
  type ReferencePointsContext,
  buildReferencePoints,
  referencePointsInGroup,
} from "./referencePoints";

const BRACE_LABEL = "4in GRK screw (brace members, 2 at each end)";
const JACK_LABEL = "4in GRK screw (jack sheet to panel, 16in o.c. exterior + 24in o.c. interior)";

const SCHEDULE: ReferencePointScheduleRow[] = [
  {
    connection: "Jack stud to panel",
    fastener: 'GRK 5/16"x4" star drive washer head',
    /* ⚠ THE ONE SCHEDULE, 2026-11-19. Was '24" o.c., interior & exterior'
       with a `pending-BI-confirmation` and a rival T25 rule beside it. */
    spacing: '16" o.c. exterior, 24" o.c. interior — the panel-to-panel schedule',
    status: "confirmed",
    note: "his own, 2026-11-19",
  },
  {
    connection: "Panel to panel, exterior",
    fastener: 'GRK 5/16"x4"',
    spacing: '16" o.c., staggered',
    status: "confirmed",
    note: "his own",
  },
  {
    connection: "Panel to panel, interior",
    fastener: 'GRK 5/16"x4"',
    spacing: '24" o.c.',
    status: "confirmed",
  },
  {
    connection: "Pier to beam",
    fastener: "Simpson SDS",
    spacing: "4 per connection",
    status: "pending-BI-confirmation",
  },
  {
    connection: "Floor panel to beam",
    fastener: 'GRK 3/8"x8" RSS',
    spacing: '12" o.c.',
    status: "pending-BI-confirmation",
  },
];

const TALLY: ReferencePointFastenerTally = {
  items: [
    { label: "2in plywood nail (4in o.c., plates + girts)", count: 1200, totalWeightLb: 4.8 },
    { label: BRACE_LABEL, count: 344, totalWeightLb: 19.2 },
    { label: JACK_LABEL, count: 360, totalWeightLb: 6.3 },
  ],
};

function ctx(over: Partial<ReferencePointsContext> = {}): ReferencePointsContext {
  return {
    schedule: SCHEDULE,
    foundationConnections: ["Pier to beam", "Floor panel to beam"],
    panelFasteners: TALLY,
    panelCount: 76,
    shearBraceCount: 58,
    hasRoofPanels: true,
    ...over,
  };
}

describe("the Reference Points sheet", () => {
  it("carries every schedule row and every counted in-panel rule, and nothing twice", () => {
    const sheet = buildReferencePoints(ctx());
    expect(sheet.points).toHaveLength(SCHEDULE.length + TALLY.items.length);
    expect(new Set(sheet.points.map((p) => p.id)).size).toBe(sheet.points.length);
    for (const row of SCHEDULE) {
      expect(sheet.points.some((p) => p.connection === row.connection)).toBe(true);
    }
  });

  it("⚠ does NOT add a second brace row beside the tally's own", () => {
    /* The browser caught this on day one: a separate "Diagonal brace, each
       end" row said 232 screws while the tally line above it said 344, for the
       same screw. Two counts for one connection is the exact failure this page
       exists to prevent. */
    const sheet = buildReferencePoints(ctx());
    const braceRows = sheet.points.filter((p) => /brace/i.test(p.connection));
    expect(braceRows).toHaveLength(1);
    expect(braceRows[0]!.connection).toBe(BRACE_LABEL);
  });

  it("⚠ splits the schedule by the FOUNDATION's own load path, not by a hand-written list", () => {
    const sheet = buildReferencePoints(ctx());
    expect(referencePointsInGroup(sheet, "foundation").map((p) => p.connection)).toEqual([
      "Pier to beam",
      "Floor panel to beam",
    ]);
    expect(referencePointsInGroup(sheet, "assembly").map((p) => p.connection)).toEqual([
      "Jack stud to panel",
      "Panel to panel, exterior",
      "Panel to panel, interior",
    ]);
  });

  it("⚠ a row the foundation does NOT claim becomes an assembly row, so a new catalog row cannot vanish", () => {
    const extra: ReferencePointScheduleRow = {
      connection: "Roof panel to wall",
      fastener: "unknown",
      spacing: "unknown",
      status: "pending-BI-confirmation",
    };
    const sheet = buildReferencePoints(ctx({ schedule: [...SCHEDULE, extra], foundationConnections: [] }));
    expect(referencePointsInGroup(sheet, "assembly")).toHaveLength(6);
    expect(referencePointsInGroup(sheet, "foundation")).toHaveLength(0);
  });

  it("keeps each schedule row's own status rather than one status for the table", () => {
    const byConnection = new Map(buildReferencePoints(ctx()).points.map((p) => [p.connection, p.status]));
    expect(byConnection.get("Panel to panel, exterior")).toBe("confirmed");
    expect(byConnection.get("Panel to panel, interior")).toBe("confirmed");
    /* ⚠ The jack stud joined them on 2026-11-19 — three of the catalog's
       eight rows are now his own words rather than an NFW reference point. */
    expect(byConnection.get("Jack stud to panel")).toBe("confirmed");
    expect(byConnection.get("Pier to beam")).toBe("pending-BI-confirmation");
  });

  it("reports the live fastener counts off the tally", () => {
    const nails = buildReferencePoints(ctx()).points.find((p) => p.connection.startsWith("2in plywood nail"));
    expect(nails?.countStatement).toContain("1,200");
    expect(nails?.countStatement).toContain("4.8 lb");
  });

  it("⚠ says IN WORDS that a quoted spacing is not counted, rather than printing a zero", () => {
    const exterior = buildReferencePoints(ctx()).points.find((p) => p.connection === "Panel to panel, exterior");
    expect(exterior?.countStatement).toContain("Not counted by the app");
    expect(exterior?.countStatement).not.toMatch(/\b0\b/);
  });

  it("⚠ gives the SEAM sentence only to rows that really are panel-to-panel", () => {
    /* The browser caught a "Jack stud to panel" row carrying a sentence about
       diaphragm seams in the hundreds. A jack stud is not a seam. */
    const sheet = buildReferencePoints(ctx());
    const seams = sheet.points.filter((p) => p.load.statement.includes("seams in the hundreds"));
    expect(seams.map((p) => p.connection)).toEqual(["Panel to panel, exterior", "Panel to panel, interior"]);

    const jack = sheet.points.find((p) => p.connection === "Jack stud to panel")!;
    expect(jack.load.modeled).toBe(false);
    expect(jack.load.statement).toContain("No force is modelled across this connection");
    expect(jack.load.statement).not.toContain("seam");
  });

  it("names the building's panel count in the seam statement when there is one", () => {
    expect(
      buildReferencePoints(ctx()).points.find((p) => p.connection === "Panel to panel, exterior")?.load.statement,
    ).toContain("76 panels");
    expect(
      buildReferencePoints(ctx({ panelCount: 0 })).points.find((p) => p.connection === "Panel to panel, exterior")
        ?.load.statement,
    ).not.toContain("panels");
  });

  it("⚠ exactly ONE point has a modelled load, and it is the brace line", () => {
    const sheet = buildReferencePoints(ctx());
    const modeled = sheet.points.filter((p) => p.load.modeled);
    expect(modeled).toHaveLength(1);
    expect(modeled[0]!.connection).toBe(BRACE_LABEL);
    expect(modeled[0]!.load.statement).toContain("What is NOT modelled");
    expect(sheet.modeledLoadCount).toBe(1);
  });

  it("⚠ nothing has a modelled load in a building whose tally has no braces", () => {
    const noBraces = { ...TALLY, items: TALLY.items.filter((i) => i.label !== BRACE_LABEL) };
    const sheet = buildReferencePoints(ctx({ panelFasteners: noBraces }));
    expect(sheet.modeledLoadCount).toBe(0);
  });

  it("drops the repeated per-row note and the filler spacing from the in-panel rows", () => {
    /* Five copies of one paragraph buried the line that differs: the count. */
    const inPanel = referencePointsInGroup(buildReferencePoints(ctx()), "in-panel");
    const plain = inPanel.filter((p) => p.connection !== BRACE_LABEL);
    expect(plain.length).toBeGreaterThan(0);
    for (const p of plain) {
      expect(p.note).toBe("");
      expect(p.spacing).toBe("");
      expect(p.fastener).toBe("");
    }
  });

  it("counts only the statuses that need an engineer", () => {
    /* Down from 3 on 2026-11-19: the jack-stud row moved to `confirmed`. */
    expect(buildReferencePoints(ctx()).needsReviewCount).toBe(2);
    expect(
      buildReferencePoints(
        ctx({ schedule: SCHEDULE.map((r) => ({ ...r, status: "code-constant" as DerivationStatus })) }),
      ).needsReviewCount,
    ).toBe(0);
  });

  it("survives having nothing drawn yet", () => {
    const sheet = buildReferencePoints(
      ctx({ panelFasteners: null, panelCount: 0, shearBraceCount: 0, hasRoofPanels: false }),
    );
    expect(referencePointsInGroup(sheet, "in-panel")).toHaveLength(0);
    expect(sheet.points).toHaveLength(SCHEDULE.length);
    expect(sheet.contradictions.filter((c) => c.id === "contradiction-brace-count")).toHaveLength(0);
    expect(sheet.gaps.length).toBeGreaterThan(0);
  });
});

describe("⚠ where the app disagrees with itself", () => {
  it("names the brace count both sheets claim, and does not pick one", () => {
    const sheet = buildReferencePoints(ctx());
    const clash = sheet.contradictions.find((c) => c.id === "contradiction-brace-count")!;
    expect(clash).toBeDefined();
    /* 344 screws / 4 a brace = 86, against the shear sheet's 58. */
    expect(clash.a).toContain("86");
    expect(clash.a).toContain("344");
    expect(clash.b).toContain("58");
    expect(clash.why).toContain("neither is wrong on its own terms");
  });

  it("⚠ stays silent when the two agree", () => {
    const sheet = buildReferencePoints(ctx({ shearBraceCount: 86 }));
    expect(sheet.contradictions.some((c) => c.id === "contradiction-brace-count")).toBe(false);
  });

  it("⚠ NO LONGER raises a jack-stud clash — he settled it, one schedule", () => {
    /* Tommy, 2026-11-19: "might as well just have jack studs also get big
       screws. just the one schedule." The contradiction this page raised on
       2026-11-18 is resolved, so it must be GONE — a page that kept quoting
       two answers after one was chosen would be worse than one that never
       spotted the clash. */
    const sheet = buildReferencePoints(ctx());
    expect(sheet.contradictions.some((c) => c.id === "contradiction-jack-stud")).toBe(false);
  });

  it("⚠ the retired-screw guard actually matches the screw it retires", () => {
    /* A pattern that matched nothing would make every assertion below pass
       trivially — a guard quietly guarding nothing, which is the same class of
       defect as the label patterns this page already pins. */
    expect(RETIRED_JACK_FASTENER_PATTERN.test("4in T25 #9 screw (6in o.c. rows, 2 each)")).toBe(true);
    expect(RETIRED_JACK_FASTENER_PATTERN.test('GRK 5/16"x4" star drive washer head')).toBe(false);
  });

  it("⚠ leaves no reference point anywhere still naming the retired T25 screw", () => {
    /* The resolution has to reach every row, not just the contradictions
       list. A stale "T25" surviving in a note or a tally label would mean the
       shop could still be handed the superseded rule. */
    const sheet = buildReferencePoints(ctx());
    for (const point of sheet.points) {
      expect(RETIRED_JACK_FASTENER_PATTERN.test(point.connection)).toBe(false);
      expect(RETIRED_JACK_FASTENER_PATTERN.test(point.note)).toBe(false);
      expect(RETIRED_JACK_FASTENER_PATTERN.test(point.load.statement)).toBe(false);
    }
  });

  it("files the jack stud under the one schedule, as a confirmed row", () => {
    const jack = buildReferencePoints(ctx()).points.find((p) => p.connection === "Jack stud to panel")!;
    expect(jack.status).toBe("confirmed");
    expect(jack.spacing).toContain('16" o.c. exterior');
    expect(jack.spacing).toContain('24" o.c. interior');
  });

  it("gives every contradiction both sides and a reason", () => {
    for (const c of buildReferencePoints(ctx()).contradictions) {
      expect(c.a.length).toBeGreaterThan(20);
      expect(c.b.length).toBeGreaterThan(20);
      expect(c.why.length).toBeGreaterThan(40);
      expect(c.subject.length).toBeGreaterThan(10);
    }
  });
});

describe("⚠ the label patterns this page matches on", () => {
  /* This page reads strings `computeFastenerWeight` writes for a human. If one
     of those labels is reworded, the brace row silently loses its load
     statement and both contradictions silently disappear — a page going quiet,
     which no other test would catch. These assert against the REAL labels. */
  it("the real brace label still matches, so the brace row keeps its load", () => {
    /* A real braced panel, so the label comes from the builder rather than
       from a fixture that could drift away from it. */
    const real = computeFastenerWeight(buildBracedPanelMembers(40, 15.5, 120, false, "chevron", false));
    const braceLabel = real.items.find((i) => /brace/i.test(i.label))?.label;
    expect(braceLabel).toBe(BRACE_LABEL);

    expect(buildReferencePoints(ctx({ panelFasteners: { items: real.items } })).modeledLoadCount).toBe(1);
  });

  it("⚠ the real jack-sheet label is the GRK one now, and names no T25", () => {
    /* The fixture label must track the builder's real one, and the builder's
       must no longer mention the retired screw — otherwise the page would
       print a rule the shop has been told to stop using. */
    const real = computeJackStudFastenerWeight(96);
    expect(real.items[0]!.label).toBe(JACK_LABEL);
    expect(RETIRED_JACK_FASTENER_PATTERN.test(real.items[0]!.label)).toBe(false);
  });
});

describe("the gaps, which are rows and not omissions", () => {
  it("⚠ NARROWS the roof gap to the eave, now that the seams have a schedule", () => {
    /* ⚠ This assertion was INVERTED, not deleted. It used to read
       `expect(roof.why).toContain("NO ROOF ROW AT ALL")`, which was true until
       Tommy gave the roof its first schedule on 2026-11-20 — the seams, the
       ridge truss screw and the triangle cap. Leaving it would have made the
       page insist there is no roof row while the schedule three screens away
       lists three. The gap is real but SMALLER: the eave end, where a roof
       panel is fastened down to the wall, still has nothing. */
    const gaps = buildReferencePoints(ctx()).gaps;
    expect(gaps.find((g) => g.id === "gap-roof")).toBeUndefined();
    const roof = gaps.find((g) => g.id === "gap-roof-to-wall")!;
    expect(roof).toBeDefined();
    expect(roof.why).not.toContain("NO ROOF ROW AT ALL");
    expect(roof.why).toMatch(/eave/i);
  });

  it("⚠ sharpens the eave gap when the building actually HAS roof panels", () => {
    const withRoof = buildReferencePoints(ctx({ hasRoofPanels: true })).gaps.find((g) => g.id === "gap-roof-to-wall")!;
    const without = buildReferencePoints(ctx({ hasRoofPanels: false })).gaps.find((g) => g.id === "gap-roof-to-wall")!;
    expect(withRoof.why).not.toEqual(without.why);
    expect(withRoof.why).toContain("This building has roof panels");
    expect(without.why).toContain("no roof panels yet");
    /* ⚠ Both readings must credit the schedule that now EXISTS, or a reader
       of either one concludes the roof is wholly unspecified. */
    for (const why of [withRoof.why, without.why]) {
      expect(why).toMatch(/2026-11-20/);
    }
  });

  it("names the roof diaphragm the app does not model", () => {
    const gap = buildReferencePoints(ctx()).gaps.find((g) => g.id === "gap-roof-diaphragm");
    expect(gap!.why).toContain("NO plywood on its large faces");
  });

  it("names the three known under-counts rather than letting the weight read as exact", () => {
    const ids = buildReferencePoints(ctx()).gaps.map((g) => g.id);
    expect(ids).toContain("gap-corner-ply-seam");
    expect(ids).toContain("gap-blocking");
    expect(ids).toContain("gap-ring-tie-lap");
  });

  it("gives every gap a reason", () => {
    for (const gap of buildReferencePoints(ctx()).gaps) {
      expect(gap.why.length).toBeGreaterThan(40);
      expect(gap.connection.length).toBeGreaterThan(0);
    }
  });
});

describe("the provenance vocabulary", () => {
  it("⚠ marks pending and app-assumption as outstanding and NOTHING else", () => {
    expect(derivationStatusNeedsReview("pending-BI-confirmation")).toBe(true);
    expect(derivationStatusNeedsReview("app-assumption")).toBe(true);
    expect(derivationStatusNeedsReview("confirmed")).toBe(false);
    expect(derivationStatusNeedsReview("code-constant")).toBe(false);
    expect(derivationStatusNeedsReview("from-the-drawing")).toBe(false);
  });

  it("gives every status a meaning, and the legend lists them all exactly once", () => {
    const all = Object.keys(DERIVATION_STATUS_MEANINGS) as DerivationStatus[];
    expect([...DERIVATION_STATUS_ORDER].sort()).toEqual([...all].sort());
    expect(new Set(DERIVATION_STATUS_ORDER).size).toBe(DERIVATION_STATUS_ORDER.length);
    for (const status of all) {
      expect(DERIVATION_STATUS_MEANINGS[status].length).toBeGreaterThan(20);
    }
  });

  it("labels every group and orders them all exactly once", () => {
    const all = Object.keys(REFERENCE_POINT_GROUP_LABELS);
    expect([...REFERENCE_POINT_GROUP_ORDER].sort()).toEqual([...all].sort());
    expect(new Set(REFERENCE_POINT_GROUP_ORDER).size).toBe(REFERENCE_POINT_GROUP_ORDER.length);
  });

  it("⚠ no group is named for only some of what it holds", () => {
    /* "Panel to panel (site)" was the first name of the assembly group, and it
       was a lie about the jack stud, the toe-up and the corner. */
    expect(REFERENCE_POINT_GROUP_LABELS.assembly).not.toMatch(/panel to panel/i);
  });

  it("⚠ every point the sheet builds lands in a group the page renders", () => {
    const sheet = buildReferencePoints(ctx());
    const walked = REFERENCE_POINT_GROUP_ORDER.flatMap((g) => referencePointsInGroup(sheet, g));
    expect(walked).toHaveLength(sheet.points.length);
    expect(new Set(walked.map((p) => p.id)).size).toBe(sheet.points.length);
  });
});

describe("what one screw can hold (2026-11-19)", () => {
  /* > "can you find a number? surely on the internet somewhere this is
     > referenced and you can cross reference that to some other stuff."
     Until this landed, the page reported eight spacings and no capacity at
     all, which is why phase 2 could not start. */
  it("prints a citation to the current report, with its scope limit", () => {
    const sheet = buildReferencePoints(ctx());
    expect(sheet.capacitySource.id).toBe("ICC-ES ESR-2442");
    expect(sheet.capacitySource.url).toContain("icc-es.org");
    /* ⚠ The scope limit must travel with the numbers. A reader who takes the
       report's nail-substitution table as cover for a braced wall has misread
       it in the one way the report explicitly warns against. */
    expect(sheet.capacitySource.scopeLimit).toContain("braced walls");
  });

  it("gives every capacity input a provenance tag and a note", () => {
    for (const input of buildReferencePoints(ctx()).capacityInputs) {
      expect(Object.keys(DERIVATION_STATUS_MEANINGS)).toContain(input.status);
      expect(input.note.length).toBeGreaterThan(20);
    }
  });

  it("⚠ puts the brace's two end screws beside the strut, and calls the ends smaller", () => {
    /* The finding: the Shear Derivation sheet reports a panel's capacity off
       the strut, while the smaller number sits at its two ends. */
    const sheet = buildReferencePoints(ctx({ braceAxialCapacityLb: 1300, braceEndPenetrationIn: 1.5 }));
    const check = sheet.braceEndConnection!;
    expect(check.screwsPerEnd).toBe(2);
    expect(check.perEndLb).toBeCloseTo(check.perScrewLb * 2, 9);
    /* ⚠ Pinned to the number, and to the penetration it was computed FROM.
       Without this, passing a deeper penetration than the caller asked for
       still satisfies "smaller than the strut" and the comparison would be
       quietly flattering the connection. 133.47 lbf is the NDS mode IIIm value
       for 1.5in into SPF, cross-checked by hand. */
    expect(check.penetrationIn).toBe(1.5);
    expect(check.governingMode).toBe("IIIm");
    expect(check.perScrewLb).toBeCloseTo(133.47, 1);
    expect(check.perEndLb).toBeCloseTo(266.93, 1);
    expect(check.perEndLb).toBeLessThan(check.braceAxialCapacityLb);
    expect(check.ratio).toBeLessThan(1);
    /* ⚠ And never a verdict. */
    expect(check.caveat).toContain("neither is a demand");
    expect(check.statement).not.toMatch(/\b(pass|fail)/i);
  });

  it("⚠ rewrites the brace row's load statement, so the page cannot contradict itself", () => {
    /* Before this, the brace row ended "What is NOT modelled is whether these
       four screws can deliver that force into the frame." Leaving that beside
       a section that now answers it is the exact defect this page exists to
       catch. */
    const before = buildReferencePoints(ctx()).points.find((p) => BRACE_LABEL === p.connection)!;
    expect(before.load.statement).toContain("What is NOT modelled");

    const after = buildReferencePoints(
      ctx({ braceAxialCapacityLb: 1300, braceEndPenetrationIn: 1.5 }),
    ).points.find((p) => BRACE_LABEL === p.connection)!;
    expect(after.load.statement).not.toContain("What is NOT modelled");
    expect(after.load.statement).toContain("the ENDS are the smaller number");
    expect(after.load.statement).toContain("neither says the brace passes");
  });

  it("stays null when the caller has no brace to compare", () => {
    expect(buildReferencePoints(ctx()).braceEndConnection).toBeNull();
    expect(buildReferencePoints(ctx({ braceAxialCapacityLb: 1300 })).braceEndConnection).toBeNull();
    expect(buildReferencePoints(ctx({ braceEndPenetrationIn: 1.5 })).braceEndConnection).toBeNull();
  });

  it("⚠ names the GRAIN ANGLE as the gap, now that he has answered the penetration", () => {
    /* ⚠ The penetration gap is RETIRED, not renamed. Tommy answered it on
       2026-11-20 (4in GRK through a 1 1/2in stud, 2 1/2in into the brace), so
       a page still calling it unknown would be contradicting him. What took
       its place is a real and different question: Table 3 was tested across
       the side grain of a main member, and a brace end is a beveled cut the
       screw enters lengthwise. */
    const gaps = buildReferencePoints(ctx()).gaps;
    expect(gaps.find((g) => g.id === "gap-brace-end-penetration")).toBeUndefined();
    const gap = gaps.find((g) => g.id === "gap-brace-end-grain-angle")!;
    expect(gap.why).toContain("2 3/8in");
    expect(gap.why).toContain("Building Integrity");
    /* ⚠ And it must carry the zero-margin finding, which is the part an
       engineer would otherwise have to rediscover: his 2 1/2in is nominal,
       the screw is 3 7/8in, so the real figure lands EXACTLY on the row's
       minimum and anything thicker in front of it drops out of the table. */
    expect(gap.why).toContain("3 7/8in");
    expect(gap.why).toMatch(/exactly|NOTHING/);
  });

  it("⚠ wires the sheet to his DERIVED penetration, not to a typed 2.375", () => {
    /* The whole zero-margin point is that 2 3/8in is 3.875 - 1.5. A typed
       constant would survive the screw's length changing and silently keep
       claiming the tested row. */
    expect(BRACE_END_PENETRATION_IN).toBeCloseTo(2.375, 9);
    const check = buildReferencePoints(
      ctx({ braceAxialCapacityLb: 3064, braceEndPenetrationIn: BRACE_END_PENETRATION_IN }),
    ).braceEndConnection!;
    expect(check.penetrationIn).toBeCloseTo(2.375, 9);
    expect(check.sideMemberIn).toBe(1.5);
    /* ⚠ His answer RAISED the end capacity: 267 lbf at the old assumed 1.5in,
       303 lbf now. It did not make the ends stop being the smaller number. */
    expect(check.perEndLb).toBeCloseTo(303.1, 1);
    expect(check.perEndLb).toBeLessThan(check.braceAxialCapacityLb);
    expect(check.statement).toContain("2.375in into the brace");
  });
});

describe("⚠ the page must not contradict itself about the jack stud", () => {
  /* Found in the BROWSER on 2026-11-19, the eighth time running. The schedule
     row read "Not counted by the app" a few lines under an in-panel row
     reading "108 in this building" — for the same screw in the same joint,
     now that both are the one schedule. That is the duplicate-brace-row
     defect of phase 1 recurring. */
  it("counts the schedule row when the in-panel tally already counts it", () => {
    const sheet = buildReferencePoints(ctx());
    const schedule = sheet.points.find(
      (p) => p.group === "assembly" && p.connection === "Jack stud to panel",
    )!;
    const tally = sheet.points.find((p) => p.group === "in-panel" && /jack sheet/i.test(p.connection))!;
    expect(schedule.countStatement).not.toContain("Not counted");
    expect(schedule.countStatement).toContain("One schedule, one count");
    /* And it must quote the SAME number the in-panel row does. */
    const n = TALLY.items.find((i) => /jack sheet/i.test(i.label))!.count;
    expect(schedule.countStatement).toContain(n.toLocaleString());
    expect(tally.countStatement).toContain(n.toLocaleString());
  });

  it("still says 'not counted' for a schedule row nothing counts", () => {
    const seam = buildReferencePoints(ctx()).points.find(
      (p) => p.connection === "Panel to panel, exterior",
    )!;
    expect(seam.countStatement).toContain("Not counted by the app");
  });

  it("⚠ the ridge cap's FASTENING gap is gone — he answered it the same day", () => {
    /* It existed for about an hour. Tommy gave the schedule on 2026-11-20:
       glue and #10 T25 screws every 8in. A page still asking is a page
       contradicting him, which is the defect this page exists to catch. */
    const gaps = buildReferencePoints(ctx({ hasRoofPanels: true })).gaps;
    expect(gaps.find((g) => g.id === "gap-ridge-cap-fastening")).toBeUndefined();
  });

  it("⚠ names the two gaps his schedule OPENS, and only where there IS a roof", () => {
    /* His answer closed one question and opened two: the count (prescribed,
       not tallied) and the truss screw's own spec (needed before any
       withdrawal number exists). Both are real and both are narrow. */
    const withRoof = buildReferencePoints(ctx({ hasRoofPanels: true })).gaps;

    /* ⚠ `gap-roof-fastener-count` is RETIRED — the count was built the same
       day the schedule arrived, so the roof half is answered. What is left is
       the FLOOR panel, which has never had a rule at all. */
    expect(withRoof.find((g) => g.id === "gap-roof-fastener-count")).toBeUndefined();
    const count = withRoof.find((g) => g.id === "gap-floor-panel-fasteners")!;
    expect(count).toBeDefined();
    /* It must say which direction the omission errs in — a gap that does not
       is just an apology. */
    expect(count.why).toContain("LOW by four screws");
    expect(count.why).toContain("UNMODELED");
    /* And it must credit the roof count that now exists, or a reader concludes
       neither deck type is counted. */
    expect(count.why).toContain("computeRoofPanelSeamFastenerWeight");

    const spec = withRoof.find((g) => g.id === "gap-ridge-truss-screw-spec")!;
    expect(spec).toBeDefined();
    /* The geometry IS modelled and the gap must say so, or it reads as though
       nothing was done with his instruction. */
    expect(spec.why).toContain("3/4in at 4:12");
    expect(spec.why).toContain("NDS 12.2.3");
    /* And it must not let a future reader mistake a capacity for a check. */
    expect(spec.why).toContain("NOT BE A CHECK");
    /* The glue is counted nowhere and that is worth saying once. */
    expect(spec.why).toContain("adhesive");

    /* ⚠ Neither may appear on a building with no roof panels, or the page
       grows gaps about parts that do not exist — the duplicate brace row of
       phase 1 all over again. */
    const noRoof = buildReferencePoints(ctx({ hasRoofPanels: false })).gaps;
    expect(noRoof.find((g) => g.id === "gap-floor-panel-fasteners")).toBeUndefined();
    expect(noRoof.find((g) => g.id === "gap-ridge-truss-screw-spec")).toBeUndefined();
  });

  it("⚠ places the brace-end gap's wording ABOVE, where the capacity actually is", () => {
    /* It read "The capacity below" while the capacity section renders before
       the gaps. A page that tells an engineer to look the wrong way is a small
       defect with the same cause as the big ones. */
    const gap = buildReferencePoints(ctx()).gaps.find(
      (g) => g.id === "gap-brace-end-grain-angle",
    )!;
    expect(gap.why).toContain("above");
    expect(gap.why).not.toContain("capacity below");
  });
});
