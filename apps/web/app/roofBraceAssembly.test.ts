import { describe, expect, it } from "vitest";
import {
  buildFloorRoofPanelMembers,
  JOIST_2X6_THICKNESS_IN,
  overlappingMemberPairs,
  memberAabbIn,
  ROOF_ZIGZAG_MAX_BAY_IN,
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

const optionsFor = (
  widthIn: number,
  spanIn: number,
  /** ⚠ The brace bands its girts dodge — see `avoidGirtZBandsIn`. Left
   * out, the panel is the one the app built BEFORE the dodge existed, which
   * is what the before/after assertions below need. */
  avoidGirtZBandsIn?: readonly (readonly [number, number])[],
): FloorRoofPanelOptions => ({
  kind: "roof",
  widthIn,
  depthIn: PANEL_DEPTH_IN,
  lengthIn: spanIn,
  structuralGirtEnds: [],
  pitchIn12: PITCH_IN_12,
  bearingSeatDepthIn: PANEL_DEPTH_IN,
  ...(avoidGirtZBandsIn ? { avoidGirtZBandsIn } : {}),
});

interface BracedPlane {
  bands: { name: string; widthIn: number }[];
  spanIn: number;
  maxMemberAngleDeg: number;
  bayCount: number;
  refusal: string | null;
  perPanel: {
    band: { name: string; widthIn: number };
    brace: PanelMember[];
    /** The panel AS INSTALLED — its girts already dodging these braces. */
    panel: PanelMember[];
    /** The same panel with its girts on the bare spacing rule, for before/after. */
    panelUndodged: PanelMember[];
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
    bayCount: bracing.bayCount,
    refusal: bracing.refusal,
    perPanel: bands.map((band, index) => {
      const entry = bracing.perPanel[index]!;
      return {
        band,
        brace: entry.members,
        /* ⚠ **THE PANEL THE APP REALLY BUILDS**, girts and all. This used to
           build it without the brace bands, so every overlap assertion below
           was measuring a panel `deckPanelTakeoff` no longer emits. */
        /* ⚠ **THE PANEL AS THE TAKEOFF BUILDS IT: girts PLACED by the
           zigzag, not dodging it.** This used to pass `avoidGirtZBandsIn`,
           which was right while the bracing was a plane-wide figure the girts
           had to get out of the way of. The zigzag puts them on its own bay
           boundaries instead, so the harness has to hand over
           `girtStationsIn` or it measures a panel the app no longer emits —
           the same defect this harness already had once. */
        panel: buildFloorRoofPanelMembers({
          ...optionsFor(band.widthIn, spanIn),
          girtStationsIn: entry.girtStationsIn,
        }),
        panelUndodged: buildFloorRoofPanelMembers(optionsFor(band.widthIn, spanIn)),
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
  /* ⚠ **FOUR WAS HIS CARROT PATTERN'S OWN PROPERTY AND IT IS GONE.** A
     zigzag's count follows the panel: an ODD number of traverses in each bay,
     and as many bays as the span needs under his 5ft maximum. What has to
     hold is the oddness, because that is what leaves each bay's chain on the
     joist opposite the one it entered on — the whole reason a diagonal never
     lands on a girt. */
  it("hands each panel an odd number of traverses in every bay", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      for (const entry of braced.perPanel) {
        const label = `${planeWidthIn}in plane, ${entry.band.name}`;
        expect(entry.brace.length, label).toBeGreaterThan(0);
        expect(entry.brace.length % braced.bayCount, label).toBe(0);
        expect((entry.brace.length / braced.bayCount) % 2, label).toBe(1);
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
  const totalsOf = (braced: BracedPlane, pick: (e: BracedPlane["perPanel"][number]) => PanelMember[]) => {
    const totals = new Map<string, number>();
    for (const entry of braced.perPanel) {
      for (const [kind, count] of overlapKinds(pick(entry), entry.brace)) {
        totals.set(kind, (totals.get(kind) ?? 0) + count);
      }
    }
    return totals;
  };
  const girtPairsIn = (totals: Map<string, number>) =>
    [...totals.entries()].filter(([kind]) => kind.startsWith("anti-twist")).reduce((sum, [, n]) => sum + n, 0);

  /* ⚠ **NOTHING OVERLAPS ANYTHING ANY MORE, and his own rule is why.**

     This pair of tests has tracked a shrinking problem. First it measured
     what the girts gave up to dodge a plane-wide figure (65 crossings on the
     48ft plane, bought with about one extra girt in ten). Then the zigzag
     placed the girts on its bay boundaries and the girt crossings went to
     zero, leaving only the chain's own node laps — two consecutive boards
     sharing a rhombus where their centrelines met.

     > *"every diagonal piece is mitered to be a flush cut with the joist -
     > and if another diagonal is a node with it, the edge/tip of one should
     > meet the edge/tip of the other - varying distances depending on
     > angle."* — Tommy, 2026-11-22

     Stepping the two boards a full end face apart along the joist puts their
     corners in contact and their bodies clear, so the last overlap in a roof
     panel is gone. Not "acceptable under his standing rule" — absent. */
  it("leaves NOTHING overlapping in a roof panel at all", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      const placed = totalsOf(braced, (e) => e.panel);
      expect(girtPairsIn(placed), `${planeWidthIn}in plane`).toBe(0);
      expect([...placed.entries()], `${planeWidthIn}in plane`).toEqual([]);
    }
  });

  /* ⚠ And it is a live difference, not a vacuous one: with the girts strided
     from the datum instead of placed on the bays, boards really would run
     into them. */
  it("would still collide if the girts were strided instead of placed", () => {
    const braced = braceRoofPlane(576, 12);
    const strided = totalsOf(braced, (e) => e.panelUndodged);
    expect(girtPairsIn(strided)).toBeGreaterThan(0);
  });

  it("costs no girts, where the dodge added about one in ten", () => {
    const antiTwistCount = (ms: PanelMember[]) => ms.filter((m) => /^anti-twist-\d+-web$/.test(m.memberId)).length;
    const counts = PLANES.map(([planeWidthIn, runFt]) => {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      return [
        braced.perPanel.reduce((n, e) => n + antiTwistCount(e.panelUndodged), 0),
        braced.perPanel.reduce((n, e) => n + antiTwistCount(e.panel), 0),
      ];
    });
    /* ⚠ Equal on every plane: equal bays under his 5ft maximum put the same
       NUMBER of girts in a panel as a 5ft stride from the datum does, only
       evenly spaced. The dodge used to make the right-hand column bigger
       (12, 30, 50, 122 against these); it is not in the path now. */
    expect(counts).toEqual([
      [9, 9],
      [26, 26],
      [50, 50],
      [111, 111],
    ]);
    for (const [strided, placed] of counts) expect(placed).toBe(strided);
  });

  /* The bite into the end clearance, and the trim the joists take, are both
     reported per panel so a Review Log entry can state them. */
  /* ⚠ **BOTH ARE ZERO NOW, AND THAT IS THE ZIGZAG PAYING OFF TWICE.**
     The plane-wide figure was laid on a rectangle and then clipped: every
     board lost about 4in to the joists it was cut back to, and the end boards
     reached into an end lid by up to the clearance. A zigzag piece is DEFINED
     from one joist's inner face to the other's, so there is nothing to clip,
     and the bay inset holds its corners off the girts and lids — so nothing
     bites and nothing is trimmed. The ~4in a board used to lose at each joist
     butt was an open item on Tommy's desk; it is closed by construction. */
  it("loses nothing to a lid or a joist any more", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      const label = `${planeWidthIn}in plane`;
      /* Float dust only — the inset is solved to a fixed point, so a corner
         lands on the bay boundary to about 1e-15 rather than exactly. */
      expect(Math.max(...braced.perPanel.map((e) => e.lidBiteIn)), label).toBeLessThan(1e-9);
      expect(Math.max(...braced.perPanel.map((e) => e.trimmedIn)), label).toBeLessThan(1e-9);
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

  it("makes every panel of one width ONE part", () => {
    const { bracing } = uniformPlane(16);
    expect(bracing.perPanel).toHaveLength(16);
    /* ⚠ Was 8 of 16, when a repeat needed two bays to land on the same
       stations. A per-panel figure needs no coincidence: equal widths in the
       same run carry equal boards, always. */
    expect(new Set(bracing.perPanel.map((p) => p.signature)).size).toBe(1);
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
    expect(matches).toBe(15);
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
  it("makes a real run THREE parts, where the X made it twenty-five", () => {
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
    /* ⚠ **25 -> 3.** The run has three distinct widths — two 15.5in edges, a
       field of 24s and a 17in tail — and the zigzag gives each of them one
       part, wherever along the plane it sits. */
    expect(new Set(bracing.perPanel.map((p) => p.signature)).size).toBe(3);
    expect(new Set(widths).size).toBe(3);
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
  /* ⚠ **THIS COMMENT USED TO STATE THE DEFECT AS ITS PREMISE.** It said
     *"on every real roof the eave end's clear band is 0 at every width,
     because the eave takes its cut from BELOW and leaves the top face running
     the full span"* - true of the INTERIOR face the boards were wrongly being
     laid on, and false of the real exterior one, where the eave lid's face
     studs cap the band at 2.37in. See `centreYIn` in `roofBraceMembers.ts`.

     A synthetic fixture is still needed, because the real band is the same
     2.37in at every WIDTH, so a real run's ends still never disagree. But the
     witness has to be reversed: a 4:12 panel's eave cap (2.37in) is now LATER
     than a flat panel's square lid (0.75in), so the odd one out is the SLOPED
     panel in an otherwise flat run. Taking the earliest would read 0.75 and
     lay a board through the odd panel's eave lid. */
  it("takes the LATEST eave end any panel of the run has, not the earliest", () => {
    const spanIn = 200;
    const widths = [24, 24, 24, 15.5];
    const optionsAt = (pitchFor: (widthIn: number) => number) => (widthIn: number) => ({
      kind: "roof" as const,
      widthIn,
      depthIn: PANEL_DEPTH_IN,
      lengthIn: spanIn,
      structuralGirtEnds: [],
      pitchIn12: pitchFor(widthIn),
      bearingSeatDepthIn: PANEL_DEPTH_IN,
    });
    /* The odd one out is the SLOPED panel, whose angled eave lid reaches
       further up the top face than a flat panel's square one. */
    const mixed = planRoofRunBracing({
      panelWidthsIn: widths,
      panelMitred: widths.map(() => false),
      spanIn,
      depthIn: PANEL_DEPTH_IN,
      optionsForWidthIn: optionsAt((widthIn) => (widthIn === 15.5 ? PITCH_IN_12 : 0)),
    });
    const flat = planRoofRunBracing({
      panelWidthsIn: widths,
      panelMitred: widths.map(() => false),
      spanIn,
      depthIn: PANEL_DEPTH_IN,
      optionsForWidthIn: optionsAt(() => 0),
    });
    expect(mixed.refusal).toBeNull();
    expect(flat.refusal).toBeNull();
    /* The sloped panel's lid pushes the region's eave end out from 0.75in to
       2.37in, which is exactly what taking the largest means. */
    expect(mixed.regionFromIn - flat.regionFromIn).toBeCloseTo(2.3717082451262845 - 0.75, 9);
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

describe("his 5ft rule, measured rather than trusted", () => {
  /**
   * ⚠ **THE RULE IS A MAXIMUM, AND EQUAL BAYS ARE A DIFFERENT PLACEMENT OF
   * IT — so it is checked by MEASURING every gap, not by reading the spacing
   * a girt was placed at.**
   *
   * > *"can we continue to keep the hard rule of girts must be placed every
   * > 3 ft or less"* — Tommy, 2026-11-21, and *"OSB girts every 5' or less"*
   * the day after.
   *
   * The zigzag's bays tile the BRACED REGION, which is inset from the panel's
   * ends — by the end clearance at both, and by the lids beyond that. So a
   * bay height under the maximum does not by itself prove the gap from the
   * last girt to the far lid is. Every member that runs the panel's full
   * width is a transverse stiffener (the two end lids and the girts), and the
   * clear run between consecutive ones is the thing his rule bounds.
   */
  it("noRoofGirtGapExceedsTheMaximum", () => {
    for (const [planeWidthIn, runFt] of PLANES) {
      const braced = braceRoofPlane(planeWidthIn, runFt);
      for (const entry of braced.perPanel) {
        const stiffeners = entry.panel
          .filter((m) => /lid-(start|end)-skin/.test(m.memberId) || /^anti-twist-\d+-web$/.test(m.memberId))
          .map((m) => memberAabbIn(m))
          .sort((a, b) => a.z0 - b.z0);
        const label = `${planeWidthIn}in plane, ${entry.band.name}`;
        expect(stiffeners.length, label).toBeGreaterThan(2);
        for (let i = 1; i < stiffeners.length; i++) {
          const gapIn = stiffeners[i]!.z0 - stiffeners[i - 1]!.z1;
          expect({ label, over: gapIn > ROOF_ZIGZAG_MAX_BAY_IN }).toEqual({ label, over: false });
        }
      }
    }
  });

  /* And it really is close to the bound rather than trivially satisfied — a
     panel with a girt every 6in would also pass the test above. */
  it("uses most of the maximum it is allowed", () => {
    const braced = braceRoofPlane(576, 12);
    const worstIn = Math.max(
      ...braced.perPanel.flatMap((entry) => {
        const stiffeners = entry.panel
          .filter((m) => /lid-(start|end)-skin/.test(m.memberId) || /^anti-twist-\d+-web$/.test(m.memberId))
          .map((m) => memberAabbIn(m))
          .sort((a, b) => a.z0 - b.z0);
        return stiffeners.slice(1).map((s, i) => s.z0 - stiffeners[i]!.z1);
      }),
    );
    expect(worstIn).toBeGreaterThan(ROOF_ZIGZAG_MAX_BAY_IN * 0.7);
    expect(worstIn).toBeLessThanOrEqual(ROOF_ZIGZAG_MAX_BAY_IN);
  });
});
