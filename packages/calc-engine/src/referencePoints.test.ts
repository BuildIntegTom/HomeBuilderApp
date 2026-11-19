import { describe, expect, it } from "vitest";

import {
  DERIVATION_STATUS_MEANINGS,
  DERIVATION_STATUS_ORDER,
  type DerivationStatus,
  derivationStatusNeedsReview,
} from "./derivationStatus";
import { buildBracedPanelMembers } from "@building-integrity/panel-catalog";

import { computeFastenerWeight, computeJackStudFastenerWeight } from "./fastenerWeight";
import type { ReferencePointFastenerTally } from "./referencePoints";
import {
  REFERENCE_POINT_GROUP_LABELS,
  REFERENCE_POINT_GROUP_ORDER,
  type ReferencePointScheduleRow,
  type ReferencePointsContext,
  buildReferencePoints,
  referencePointsInGroup,
} from "./referencePoints";

const BRACE_LABEL = "4in GRK screw (brace members, 2 at each end)";
const JACK_LABEL = "4in T25 #9 screw (6in o.c. rows, 2 each)";

const SCHEDULE: ReferencePointScheduleRow[] = [
  {
    connection: "Jack stud to panel",
    fastener: 'GRK 5/16"x4" star drive washer head',
    spacing: '24" o.c., interior & exterior',
    status: "pending-BI-confirmation",
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
    expect(byConnection.get("Jack stud to panel")).toBe("pending-BI-confirmation");
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
    expect(buildReferencePoints(ctx()).needsReviewCount).toBe(3);
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

  it("names the two different jack-stud rules, with his counted one first", () => {
    const clash = buildReferencePoints(ctx()).contradictions.find((c) => c.id === "contradiction-jack-stud")!;
    expect(clash.a).toContain("T25 #9");
    expect(clash.a).toContain("360");
    expect(clash.b).toContain('24" o.c.');
    expect(clash.why).toContain("four a foot");
  });

  it("⚠ raises the jack-stud clash only when BOTH rules are present", () => {
    const noJackTally = { ...TALLY, items: TALLY.items.filter((i) => i.label !== JACK_LABEL) };
    expect(
      buildReferencePoints(ctx({ panelFasteners: noJackTally })).contradictions.some(
        (c) => c.id === "contradiction-jack-stud",
      ),
    ).toBe(false);
    expect(
      buildReferencePoints(
        ctx({ schedule: SCHEDULE.filter((r) => r.connection !== "Jack stud to panel") }),
      ).contradictions.some((c) => c.id === "contradiction-jack-stud"),
    ).toBe(false);
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

  it("the real jack-sheet label still matches, so the jack-stud clash is still raised", () => {
    const real = computeJackStudFastenerWeight(96);
    expect(real.items[0]!.label).toBe(JACK_LABEL);
    const sheet = buildReferencePoints(ctx({ panelFasteners: { items: real.items } }));
    expect(sheet.contradictions.some((c) => c.id === "contradiction-jack-stud")).toBe(true);
  });
});

describe("the gaps, which are rows and not omissions", () => {
  it("⚠ always names the roof, because the schedule has no roof row at all", () => {
    const roof = buildReferencePoints(ctx()).gaps.find((g) => g.id === "gap-roof");
    expect(roof).toBeDefined();
    expect(roof!.why).toContain("NO ROOF ROW AT ALL");
  });

  it("⚠ sharpens the roof gap when the building actually HAS roof panels", () => {
    const withRoof = buildReferencePoints(ctx({ hasRoofPanels: true })).gaps.find((g) => g.id === "gap-roof")!;
    const without = buildReferencePoints(ctx({ hasRoofPanels: false })).gaps.find((g) => g.id === "gap-roof")!;
    expect(withRoof.why).not.toEqual(without.why);
    expect(withRoof.why).toContain("This building HAS roof panels");
    expect(without.why).toContain("no roof panels yet");
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
