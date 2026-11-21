import { describe, expect, it } from "vitest";
import {
  roofBracePanelBandsFromWidths,
  sliceRoofPlaneBracing,
  snapRoofBracingToSeams,
  type RoofBracePanelBand,
} from "@building-integrity/geometry";
import {
  buildFloorRoofPanelMembers,
  buildRoofBraceMembers,
  JOIST_2X6_THICKNESS_IN,
  overlappingMemberPairs,
  roofBracePiecesForPanel,
  roofBraceTopFaceClearZIn,
  ROOF_BRACE_END_CLEARANCE_IN,
  type PanelMember,
} from "@building-integrity/panel-catalog";

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
const LID_SEAT_DEPTH_IN = 15.5;

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

const panelMembers = (widthIn: number, spanIn: number): PanelMember[] =>
  buildFloorRoofPanelMembers({
    kind: "roof",
    widthIn,
    depthIn: PANEL_DEPTH_IN,
    lengthIn: spanIn,
    pitchIn12: PITCH_IN_12,
    bearingSeatDepthIn: LID_SEAT_DEPTH_IN,
  });

interface BracedPlane {
  bands: RoofBracePanelBand[];
  spanIn: number;
  maxMemberAngleDeg: number;
  perPanel: {
    band: RoofBracePanelBand;
    brace: PanelMember[];
    panel: PanelMember[];
    lidBiteIn: number;
    trimmedIn: number;
    withinPanelSpan: boolean;
  }[];
}

/**
 * The recipe, in one place: find the clear band on a panel's top face, build
 * the figure on it, cut it at the seams, and hand each panel its pieces.
 *
 * ⚠ **THE CLEAR BAND COMES FIRST AND THE FIGURE IS BUILT ON IT, which is the
 * order that matters.** Building the figure on the panel's full span and
 * trimming afterwards would change every angle the snap chose, and the bay
 * count with them.
 */
function braceRoofPlane(planeWidthIn: number, runFt: number): BracedPlane {
  const spanIn = Math.hypot(runFt, (runFt * PITCH_IN_12) / 12) * 12;
  const widths = realRunWidths(planeWidthIn);
  const bands = roofBracePanelBandsFromWidths(widths);

  /* A field panel's own clear band — the same at every width, since what caps
     it is the pitch and the depth, not the width. */
  const clear = roofBraceTopFaceClearZIn(
    panelMembers(24, spanIn),
    PANEL_DEPTH_IN,
    spanIn,
    JOIST_2X6_THICKNESS_IN,
    24 - JOIST_2X6_THICKNESS_IN,
  );
  const regionFromIn = clear.fromIn + ROOF_BRACE_END_CLEARANCE_IN;
  const regionToIn = clear.toIn - ROOF_BRACE_END_CLEARANCE_IN;

  const snap = snapRoofBracingToSeams(planeWidthIn, regionToIn - regionFromIn, bands);
  const sliced = sliceRoofPlaneBracing(snap, bands);

  return {
    bands,
    spanIn,
    maxMemberAngleDeg: snap.maxMemberAngleDeg,
    perPanel: bands.map((band, index) => {
      const plan = buildRoofBraceMembers(roofBracePiecesForPanel(sliced.slices, index, band.atIn), {
        panelDepthIn: PANEL_DEPTH_IN,
        panelSpanIn: spanIn,
        regionFromIn,
        regionToIn,
        clearXFromIn: JOIST_2X6_THICKNESS_IN,
        clearXToIn: band.widthIn - JOIST_2X6_THICKNESS_IN,
      });
      return {
        band,
        brace: plan.members,
        panel: panelMembers(band.widthIn, spanIn),
        lidBiteIn: plan.lidBiteIn,
        trimmedIn: plan.trimmedIn,
        withinPanelSpan: plan.withinPanelSpan,
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
      panelMembers(24, spanIn),
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
