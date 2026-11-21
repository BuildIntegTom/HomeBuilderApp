import { describe, expect, it } from "vitest";
import {
  buildFloorRoofPanelMembers,
  JOIST_2X6_THICKNESS_IN,
  overlappingMemberPairs,
  roofBraceTopFaceClearZIn,
  ROOF_BRACE_END_CLEARANCE_IN,
  type FloorRoofPanelOptions,
  type PanelMember,
} from "@building-integrity/panel-catalog";
import { braceSignature, planRoofRunBracing, ROOF_BRACE_MITRE_REFUSAL } from "./roofBracePlan";

/**
 * ROOF BRACING — the whole chain, end to end, in the one place that can see
 * it.
 *
 * ⚠ **THIS TEST EXISTS BECAUSE NO PACKAGE CAN HOLD IT.** The figure and its
 * slicing live in `@building-integrity/geometry`; the panel and its members
 * live in `@building-integrity/panel-catalog`; neither depends on the other
 * and neither should. `apps/web` is the first place both are in scope, so it
 * is the first place the figure can be checked against the panel it is
 * supposed to land in — and every defect this stride found was a defect of
 * the JOIN, invisible from either side.
 */

const PANEL_DEPTH_IN = 15.5;
const PITCH_IN_12 = 4;

/** The shape of a real roof run — 15.5in edge panels, 24in field, a tail. */
const realRunWidths = (planeWidthIn: number): number[] => {
  const field = planeWidthIn - 2 * 15.5;
  const fieldCount = Math.floor(field / 24);
  const tail = field - fieldCount * 24;
  const widths = [15.5, ...Array.from({ length: fieldCount }, () => 24)];
  if (tail > 1e-9) widths.push(tail);
  widths.push(15.5);
  return widths;
};

const optionsFor = (widthIn: number, spanIn: number): FloorRoofPanelOptions => ({
  kind: "roof",
  widthIn,
  depthIn: PANEL_DEPTH_IN,
  lengthIn: spanIn,
  structuralGirtEnds: [],
  pitchIn12: PITCH_IN_12,
  bearingSeatDepthIn: PANEL_DEPTH_IN,
});

interface BracedPlane {
  bands: { name: string; widthIn: number }[];
  spanIn: number;
  maxMemberAngleDeg: number;
  refusal: string | null;
  perPanel: {
    band: { name: string; widthIn: number };
    brace: PanelMember[];
    panel: PanelMember[];
    lidBiteIn: number;
    trimmedIn: number;
    withinPanelSpan: boolean;
  }[];
}

/**
 * ⚠ **IT CALLS THE APP'S OWN PLANNER.** This helper used to BE the recipe —
 * clear band, figure, snap, slice, members — and every defect of the join was
 * found in it. It was promoted to `roofBracePlan.ts` when the bracing was
 * wired into the building, and this calls that rather than keeping a second
 * copy, so the app and these assertions cannot brace a run differently.
 */
function braceRoofPlane(planeWidthIn: number, runFt: number): BracedPlane {
  const spanIn = Math.hypot(runFt, (runFt * PITCH_IN_12) / 12) * 12;
  const widths = realRunWidths(planeWidthIn);
  const bracing = planRoofRunBracing({
    panelWidthsIn: widths,
    panelMitred: widths.map(() => false),
    spanIn,
    depthIn: PANEL_DEPTH_IN,
    optionsForWidthIn: (widthIn) => optionsFor(widthIn, spanIn),
  });
  const bands = widths.map((widthIn, i) => ({ name: `R${i + 1}`, widthIn }));
  return {
    bands,
    spanIn,
    maxMemberAngleDeg: bracing.maxMemberAngleDeg,
    refusal: bracing.refusal,
    perPanel: bands.map((band, index) => {
      const entry = bracing.perPanel[index]!;
      return {
        band,
        brace: entry.members,
        panel: buildFloorRoofPanelMembers(optionsFor(band.widthIn, spanIn)),
        lidBiteIn: entry.lidBiteIn,
        trimmedIn: entry.trimmedIn,
        withinPanelSpan: entry.withinPanelSpan,
      };
    }),
  };
}

/** Plane width in inches against the roof's horizontal run in feet. */
const PLANES: [number, number][] = [
  [192, 10],
  [288, 12],
  [576, 12],
  [864, 16],
];

const labelOf = (id: string) => (id.startsWith("roof-brace") ? "roof-brace" : id.replace(/-\d+$/, ""));

const overlapKinds = (panel: PanelMember[], brace: PanelMember[]): Map<string, number> => {
  const byId = new Map([...panel, ...brace].map((m) => [m.memberId, m] as const));
  const kinds = new Map<string, number>();
  for (const pair of overlappingMemberPairs([...panel, ...brace])) {
    const ids = [...byId.keys()].filter((id) => pair.includes(id));
    const key = ids.map(labelOf).sort().join(" x ");
    kinds.set(key, (kinds.get(key) ?? 0) + 1);
  }
  return kinds;
};

describe("his four boards, in every panel of every plane", () => {
  it("hands each panel exactly four brace members", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      for (const entry of braced.perPanel) {
        expect(entry.brace, `${planeWidthIn}in plane, ${entry.band.name}`).toHaveLength(4);
      }
    }
  });

  it("keeps every board inside its panel's span", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      for (const entry of braced.perPanel) {
        expect(entry.withinPanelSpan, `${planeWidthIn}in plane, ${entry.band.name}`).toBe(true);
      }
    }
  });

  /* Short, but a real board rather than the 3in offcuts the unsnapped figure
     produced — and shortened only by the joists it now bears on. */
  it("builds no board shorter than a foot", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      for (const entry of braced.perPanel) {
        for (const member of entry.brace) {
          expect(
            member.actualDimsIn.lengthIn,
            `${planeWidthIn}in plane, ${entry.band.name}, ${member.memberId}`,
          ).toBeGreaterThan(12);
        }
      }
    }
  });
});

describe("the two collisions this stride removed", () => {
  /* ⚠ **MEASURED BEFORE THE x TRIM: 100 of 100 brace members on the 48ft
     plane overlapped BOTH top joist chords — 200 pairs on one roof.** Not
     crossings: a 2x6 chord laid in the top of a roof panel occupies the very
     1 1/2in depth slice a flat brace does, so each board's two ends were
     buried inside the chords. */
  it("puts no brace inside a joist", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      for (const entry of braced.perPanel) {
        for (const [kind, count] of overlapKinds(entry.panel, entry.brace)) {
          expect(
            kind.includes("joist") ? 0 : count,
            `${planeWidthIn}in plane, ${entry.band.name}: ${kind}`,
          ).toBe(count);
          expect(kind, `${planeWidthIn}in plane, ${entry.band.name}`).not.toMatch(/joist/);
        }
      }
    }
  });

  /* ⚠ **AND 80 PAIRS OF BRACE-INSIDE-THE-END-LID, from holding the figure
     back by a flat 2 1/4in at each end.** That is the eave lid's thickness,
     and it is the wrong number twice over: the eave lid does not reach the
     top face at all, while the plumb end lid eats about 7in of it. */
  it("puts no brace inside an end lid or the bearing wedge", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      for (const entry of braced.perPanel) {
        for (const kind of overlapKinds(entry.panel, entry.brace).keys()) {
          const label = `${planeWidthIn}in plane, ${entry.band.name}`;
          expect(kind, label).not.toMatch(/lid/);
          expect(kind, label).not.toMatch(/wedge/);
          expect(kind, label).not.toMatch(/web-(start|end)/);
        }
      }
    }
  });
});

describe("what still overlaps, and whose decision it is", () => {
  /* ⚠ **HIS STANDING RULE COVERS EXACTLY THIS, and it is quoted in
     `cutRingGirtsAroundVerticals`**: *"As long as the review log says when
     things are overlapping, I think it's fine for now."* A brace is not
     *"perfectly vertical"*, so nothing is cut around it and it is not cut
     around anything. Two classes remain, both inherent to his own figure:
     a carrot's foot LANDS on a leg of the X — they are meant to touch — and
     a diagonal crossing the panel has to cross any anti-twist girt in its
     way. Pinned so the number cannot drift unnoticed. */
  it("leaves only brace-on-brace and brace-across-a-girt, at a pinned count", () => {
    const braced = braceRoofPlane(576, 12);
    const totals = new Map<string, number>();
    for (const entry of braced.perPanel) {
      for (const [kind, count] of overlapKinds(entry.panel, entry.brace)) {
        totals.set(kind, (totals.get(kind) ?? 0) + count);
      }
    }
    for (const kind of totals.keys()) {
      expect(kind).toMatch(/roof-brace/);
      expect(kind).toMatch(/^(roof-brace x roof-brace|anti-twist-\d+-(top|bottom|web) x roof-brace)$/);
    }
    const all = [...totals.values()].reduce((sum, n) => sum + n, 0);
    /* 25 panels, 100 boards: 99 pairs — about four to a panel, against the
       375 the first build produced. 34 are a carrot's foot landing on a leg
       of the X, which his figure asks for; the other 65 are a diagonal
       crossing an anti-twist girt. */
    expect(all).toBe(99);
    expect(totals.get("roof-brace x roof-brace")).toBe(34);
    const girtPairs = [...totals.entries()]
      .filter(([kind]) => kind.startsWith("anti-twist"))
      .reduce((sum, [, n]) => sum + n, 0);
    expect(girtPairs).toBe(65);
  });

  /* The bite into the end clearance, and the trim the joists take, are both
     reported per panel so a Review Log entry can state them. */
  it("reports the bite and the trim rather than hiding them", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      const worstBite = Math.max(...braced.perPanel.map((e) => e.lidBiteIn));
      const worstTrim = Math.max(...braced.perPanel.map((e) => e.trimmedIn));
      const label = `${planeWidthIn}in plane`;
      /* The boards do reach past the figure's own ends — that is what the
         clearance is for — but never past the clearance itself. */
      expect(worstBite, label).toBeGreaterThan(0);
      expect(worstBite, label).toBeLessThanOrEqual(ROOF_BRACE_END_CLEARANCE_IN + 1e-9);
      /* A joist's thickness at each end, along the board: 3in at its
         flattest, more as the figure steepens. */
      expect(worstTrim, label).toBeGreaterThan(2 * JOIST_2X6_THICKNESS_IN);
      expect(worstTrim, label).toBeLessThan(8);
    }
  });
});

describe("the clear band is what the figure is built on", () => {
  /* ⚠ If the figure were built on the panel's full span and trimmed after,
     every angle the snap chose would be wrong — and the bay count with them.
     The braced region is about 7in shorter than the span at 4:12, which is
     enough to matter. */
  it("builds the figure on a region meaningfully shorter than the span", () => {
    const spanIn = Math.hypot(12, 4) * 12;
    const clear = roofBraceTopFaceClearZIn(
      buildFloorRoofPanelMembers(optionsFor(24, spanIn)),
      PANEL_DEPTH_IN,
      spanIn,
      JOIST_2X6_THICKNESS_IN,
      24 - JOIST_2X6_THICKNESS_IN,
    );
    const region = clear.toIn - clear.fromIn - 2 * ROOF_BRACE_END_CLEARANCE_IN;
    expect(region).toBeLessThan(spanIn - 10);
    expect(region).toBeGreaterThan(spanIn - 20);
  });
});

describe("what the planner refuses, in words", () => {
  /* ⚠ **A MITRED RUN GOES UNBRACED RATHER THAN BRACED WRONG.** The figure is
     laid on the run's full rectangle, and a mitred panel is pulled back out of
     that rectangle — so a board near a cut corner would hang past the end of
     the building. Refused out loud, the way `buildFloorRoofPanelMembers`
     refuses a mitre it cannot compose with the roof's own end cuts. */
  it("refuses a run with any mitred panel, and names why", () => {
    const spanIn = Math.hypot(12, 4) * 12;
    const widths = realRunWidths(576);
    const bracing = planRoofRunBracing({
      panelWidthsIn: widths,
      panelMitred: widths.map((_, i) => i === widths.length - 1),
      spanIn,
      depthIn: PANEL_DEPTH_IN,
      optionsForWidthIn: (widthIn) => optionsFor(widthIn, spanIn),
    });
    expect(bracing.refusal).toBe(ROOF_BRACE_MITRE_REFUSAL);
    expect(bracing.perPanel).toEqual([]);
    expect(bracing.refusal).not.toMatch(/\b(pass|fail)/i);
  });

  it("refuses a panel too shallow to lie a board flat in", () => {
    const bracing = planRoofRunBracing({
      panelWidthsIn: [24, 24, 24, 24],
      panelMitred: [false, false, false, false],
      spanIn: 144,
      depthIn: 1.5,
      optionsForWidthIn: (widthIn) => ({
        kind: "roof",
        widthIn,
        depthIn: 1.5,
        lengthIn: 144,
        structuralGirtEnds: [],
      }),
    });
    expect(bracing.refusal).toMatch(/NOT braced/);
    expect(bracing.perPanel).toEqual([]);
  });
});

describe("the signature is what groups two braced panels", () => {
  /* ⚠ **IT HAS TO SPLIT NEIGHBOURS AND JOIN REPEATS, and both halves matter.**
     Without it, a run of equal-width panels collapses to ONE group and the
     whole roof is fabricated from whichever panel grouped first — the exact
     defect the mitre once caused on the Octagon's floor. With a bay number in
     it, two panels carrying identical boards four bays apart become two parts
     for no reason. */
  it("gives neighbours in a bay different signatures", () => {
    const spanIn = Math.hypot(12, 4) * 12;
    const widths = realRunWidths(576);
    const bracing = planRoofRunBracing({
      panelWidthsIn: widths,
      panelMitred: widths.map(() => false),
      spanIn,
      depthIn: PANEL_DEPTH_IN,
      optionsForWidthIn: (widthIn) => optionsFor(widthIn, spanIn),
    });
    const signatures = bracing.perPanel.map((p) => p.signature);
    expect(new Set(signatures).size).toBeGreaterThan(1);
    expect(signatures[0]).not.toBe(signatures[1]);
    /* Every panel really does carry four boards, so no signature is the
       empty one. */
    expect(signatures).not.toContain("nobrace");
  });

  /* ⚠ **A PLANE OF EQUAL PANELS IN EQUAL BAYS REPEATS, AND A REAL RUN DOES
     NOT. Both halves measured, because the second is the surprise.**

     With 16 equal panels the snap puts two bays of eight on identical
     stations, so bay 2 is bay 1 again and sixteen panels are eight parts. */
  const uniformPlane = (panelCount: number, widthIn = 24) => {
    const spanIn = Math.hypot(12, 4) * 12;
    const widths = Array.from({ length: panelCount }, () => widthIn);
    return {
      widths,
      bracing: planRoofRunBracing({
        panelWidthsIn: widths,
        panelMitred: widths.map(() => false),
        spanIn,
        depthIn: PANEL_DEPTH_IN,
        optionsForWidthIn: (w) => optionsFor(w, spanIn),
      }),
    };
  };

  it("joins the repeat when two bays land on the same stations", () => {
    const { bracing } = uniformPlane(16);
    expect(bracing.bayCount).toBe(2);
    expect(bracing.perPanel).toHaveLength(16);
    expect(new Set(bracing.perPanel.map((p) => p.signature)).size).toBe(8);
  });

  /* Two panels with the same signature must carry byte-identical boards, or
     the key is a lie and a group fabricates the wrong panel. */
  it("means identical boards wherever it matches", () => {
    const { bracing } = uniformPlane(16);
    const seen = new Map<string, string>();
    let matches = 0;
    for (const entry of bracing.perPanel) {
      const shape = JSON.stringify(
        entry.members.map((m) => [m.actualDimsIn, m.position, m.orientation]),
      );
      const prior = seen.get(entry.signature);
      if (prior === undefined) seen.set(entry.signature, shape);
      else {
        matches += 1;
        expect(shape).toBe(prior);
      }
    }
    expect(matches).toBe(8);
  });

  /**
   * ⚠ **AND THIS IS WHAT IT COSTS ON A REAL ROOF: every panel is its own
   * part.** A 48ft plane has 15 1/2in panels at its two edges and a 17in tail
   * in the middle, so the snap's three bays come out unequal — and a leg of
   * the X climbs a different amount across a 15 1/2in panel than across a
   * 24in one. 25 panels, 25 distinct brace patterns, 25 shop sheets where the
   * same roof was 3 panel types before it was braced.
   *
   * Nothing is wrong with it: a diagonal crossing a plane really does meet
   * each panel at a different height, so the panels really are not
   * interchangeable. It is pinned here because it is the kind of number that
   * should not change quietly, and because the lever that would reduce it is
   * a choice about the panel module, not about the bracing.
   */
  it("makes every panel of a real run its own part, and says how many", () => {
    const spanIn = Math.hypot(12, 4) * 12;
    const widths = realRunWidths(576);
    const bracing = planRoofRunBracing({
      panelWidthsIn: widths,
      panelMitred: widths.map(() => false),
      spanIn,
      depthIn: PANEL_DEPTH_IN,
      optionsForWidthIn: (widthIn) => optionsFor(widthIn, spanIn),
    });
    expect(widths).toHaveLength(25);
    expect(bracing.bayCount).toBe(3);
    expect(new Set(bracing.perPanel.map((p) => p.signature)).size).toBe(25);
  });
});

describe("the clear band is read per distinct width", () => {
  /* ⚠ The planner reads the band once per DISTINCT width and intersects, where
     the harness read one 24in field panel. The two agree only because the band
     is capped by the pitch and the depth rather than by the width — which is
     the claim this pins, since if a 15.5in edge panel's band were shorter the
     whole figure would move and the pinned overlap counts above would shift
     silently. */
  it("gets the same band from a 15.5in edge panel as from a 24in field panel", () => {
    const spanIn = Math.hypot(12, 4) * 12;
    const bandOf = (widthIn: number) =>
      roofBraceTopFaceClearZIn(
        buildFloorRoofPanelMembers(optionsFor(widthIn, spanIn)),
        PANEL_DEPTH_IN,
        spanIn,
        JOIST_2X6_THICKNESS_IN,
        widthIn - JOIST_2X6_THICKNESS_IN,
      );
    const field = bandOf(24);
    const edge = bandOf(15.5);
    expect(edge.fromIn).toBeCloseTo(field.fromIn, 9);
    expect(edge.toIn).toBeCloseTo(field.toIn, 9);
    /* And it really is shorter than the span at the ridge end, or there would
       be nothing to agree about. */
    expect(field.toIn).toBeLessThan(spanIn - 5);
  });
});

describe("the clear band is the INTERSECTION over the run's widths", () => {
  /* ⚠ **A MUTANT SURVIVED HERE AND THIS IS WHY: on every real roof the eave
     end's clear band is 0 at every width**, because the eave takes its cut
     from BELOW and leaves the top face running the full span. Taking the
     smallest instead of the largest is therefore the same answer on every
     building this app can draw, and nothing could see the difference.

     So the difference is made visible on purpose. A pitch-0 roof panel gets a
     square lid at each end that DOES reach the top face (0.75in of it), and
     handing one width such a panel while the rest keep the real 4:12 gives a
     run whose two ends disagree. No real run mixes pitches — this is a
     synthetic fixture for a direction that otherwise has no witness. */
  it("takes the LATEST eave end any panel of the run has, not the earliest", () => {
    const spanIn = 200;
    const widths = [24, 24, 24, 15.5];
    const mixed = planRoofRunBracing({
      panelWidthsIn: widths,
      panelMitred: widths.map(() => false),
      spanIn,
      depthIn: PANEL_DEPTH_IN,
      optionsForWidthIn: (widthIn) => ({
        kind: "roof",
        widthIn,
        depthIn: PANEL_DEPTH_IN,
        lengthIn: spanIn,
        structuralGirtEnds: [],
        /* The odd one out: a flat panel, whose square eave lid really does
           cap the top face. */
        pitchIn12: widthIn === 15.5 ? 0 : PITCH_IN_12,
        bearingSeatDepthIn: PANEL_DEPTH_IN,
      }),
    });
    const sloped = planRoofRunBracing({
      panelWidthsIn: widths,
      panelMitred: widths.map(() => false),
      spanIn,
      depthIn: PANEL_DEPTH_IN,
      optionsForWidthIn: (widthIn) => optionsFor(widthIn, spanIn),
    });
    expect(mixed.refusal).toBeNull();
    expect(sloped.refusal).toBeNull();
    /* The flat panel's lid pushes the region's eave end out by its own 0.75in,
       which is exactly what taking the largest means. */
    expect(mixed.regionFromIn - sloped.regionFromIn).toBeCloseTo(0.75, 9);
  });
});

describe("the signature's own contract", () => {
  const piece = (over: Partial<Parameters<typeof braceSignature>[0][number]> = {}) => ({
    figure: "x" as const,
    bayIndex: 0,
    braceIndex: 1,
    pieceIndex: 1,
    pieceCount: 3,
    x1In: 0,
    y1In: 0,
    x2In: 24,
    y2In: 17.16,
    ...over,
  });

  /* ⚠ These three mutants all survived the building fixtures — a coarser
     signature still happened to separate every panel there — so the contract
     is pinned directly instead. A signature that merges two panels merges two
     fabricated parts, and one of them gets built wrong. */
  it("separates two pieces that differ only in their place along the parent", () => {
    expect(braceSignature([piece()])).not.toBe(
      braceSignature([piece({ pieceIndex: 2, pieceCount: 4 })]),
    );
  });

  it("separates two pieces that start together and end apart", () => {
    expect(braceSignature([piece()])).not.toBe(braceSignature([piece({ y2In: 34.32 })]));
  });

  it("separates two pieces a quarter inch apart", () => {
    expect(braceSignature([piece()])).not.toBe(braceSignature([piece({ x1In: 0.25 })]));
  });

  it("separates a leg of the X from a carrot on the same line", () => {
    expect(braceSignature([piece()])).not.toBe(braceSignature([piece({ figure: "carrot" })]));
  });

  /* And it does NOT separate two pieces that differ only by where in the
     plane their parent sat — the whole reason a repeating figure groups. */
  it("ignores the bay and the brace index", () => {
    expect(braceSignature([piece()])).toBe(
      braceSignature([piece({ bayIndex: 7, braceIndex: 4 })]),
    );
  });

  it("is order independent, because a panel's pieces have no order", () => {
    const a = piece();
    const b = piece({ figure: "carrot", x1In: 24, y1In: 68.6, x2In: 0, y2In: 51.5 });
    expect(braceSignature([a, b])).toBe(braceSignature([b, a]));
  });
});
