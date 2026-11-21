import { describe, expect, it } from "vitest";
import {
  roofBracePanelBandsFromWidths,
  roofBracePanelSeamsIn,
  sliceRoofPlaneBracing,
  type RoofBracePanelBand,
} from "./roofBracePanelSlices";
import { snapRoofBracingToSeams, ROOF_SNAP_MIN_PANELS_PER_BAY } from "./roofBraceSeamSnap";
import {
  roofBayBracingSegmentsFromStations,
  roofBraceSegmentAngleDeg,
  roofBraceSegmentLengthIn,
  roofPlaneBracing,
  ROOF_BRACE_MAX_ANGLE_DEG,
  ROOF_BRACE_MIN_ANGLE_DEG,
  ROOF_BRACE_SEGMENTS_PER_BAY,
} from "./roofPlaneBracing";

/** A gable plane's slope length from its horizontal run and rise, in feet. */
const slopeIn = (runFt: number, riseFt: number) => Math.hypot(runFt, riseFt) * 12;

/**
 * The SHAPE of a real roof run: a 15.5in edge panel at each end (Tommy's
 * 2026-10-23 rule), 24in field panels, and the leftover as a tail. Mirrors
 * `planFloorRoofPanelRun` rather than calling it — this package has no
 * dependency on `@building-integrity/panel-catalog`.
 */
const realRunWidths = (planeWidthIn: number): number[] => {
  const field = planeWidthIn - 2 * 15.5;
  const fieldCount = Math.floor(field / 24);
  const tail = field - fieldCount * 24;
  const widths = [15.5, ...Array.from({ length: fieldCount }, () => 24)];
  if (tail > 1e-9) widths.push(tail);
  widths.push(15.5);
  return widths;
};

const realRun = (planeWidthIn: number): RoofBracePanelBand[] =>
  roofBracePanelBandsFromWidths(realRunWidths(planeWidthIn));

const PLANE_WIDTHS_FT = [16, 24, 32, 40, 48, 60, 72] as const;

describe("what snapping was for: his four, exactly", () => {
  /* ⚠ **THE HEADLINE, AND IT IS A PROPERTY OF THE FIGURE NOW RATHER THAN AN
     AVERAGE.** Stride 2 measured 4.67–5.23 pieces a panel on these same
     planes, with as many as eight in one. Snapped, every panel on every
     plane in the app's range holds exactly four — min and max both, not a
     mean that happens to land on it. */
  it("puts exactly four pieces in every panel of every plane", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const bands = realRun(widthFt * 12);
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), bands);
      const sliced = sliceRoofPlaneBracing(snap, bands);
      const label = `${widthFt}ft plane`;
      expect(snap.snapped, label).toBe(true);
      expect(sliced.minSlicesPerPanel, label).toBe(4);
      expect(sliced.maxSlicesPerPanel, label).toBe(4);
      expect(sliced.meanSlicesPerPanel, label).toBeCloseTo(4, 10);
    }
  });

  /* ⚠ **AND NO PIECE IS AN OFFCUT — every one spans its panel edge to edge.**
     This is the stronger statement and the reason the count is four: a
     segment that ends mid-panel would leave a stub, and there is none. */
  it("gives every piece its panel's full width, with no stub anywhere", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const bands = realRun(widthFt * 12);
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), bands);
      for (const slice of sliceRoofPlaneBracing(snap, bands).slices) {
        const band = bands[slice.panelIndex]!;
        const label = `${widthFt}ft plane, ${slice.panelName}`;
        expect(Math.min(slice.x1In, slice.x2In), label).toBeCloseTo(band.atIn, 6);
        expect(Math.max(slice.x1In, slice.x2In), label).toBeCloseTo(
          band.atIn + band.widthIn,
          6,
        );
      }
    }
  });

  /* ⚠ Stride 2's worst offcuts were 3.06in, 4.14in and 5.09in. A snapped
     piece cannot be shorter than its panel's own width, because it spans the
     panel — so the floor is the narrowest panel on the run, before the brace
     angle lengthens it. */
  it("leaves no piece shorter than the narrowest panel on the run", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const widths = realRunWidths(widthFt * 12);
      const bands = roofBracePanelBandsFromWidths(widths);
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), bands);
      const sliced = sliceRoofPlaneBracing(snap, bands);
      const narrowest = Math.min(...widths);
      expect(sliced.shortestSliceIn!, `${widthFt}ft plane`).toBeGreaterThanOrEqual(
        narrowest - 1e-6,
      );
      /* Well clear of the stubs it replaced, on every plane in the range. */
      expect(sliced.shortestSliceIn!, `${widthFt}ft plane`).toBeGreaterThan(15);
    }
  });

  it("moves no cut length worth noticing: under 1% against the unsnapped figure", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const unsnapped = roofPlaneBracing(widthFt * 12, slopeIn(12, 4));
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), realRun(widthFt * 12));
      const ratio = snap.totalLengthIn / unsnapped.totalLengthIn;
      expect(ratio, `${widthFt}ft plane`).toBeGreaterThan(0.99);
      expect(ratio, `${widthFt}ft plane`).toBeLessThan(1.01);
    }
  });
});

describe("every station lands on a seam", () => {
  it("places all five stations of every bay on panel seams", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const bands = realRun(widthFt * 12);
      const seams = roofBracePanelSeamsIn(bands, widthFt * 12);
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), bands);
      for (const bay of snap.bays) {
        for (const station of bay.stationsIn) {
          const nearest = Math.min(...seams.map((s) => Math.abs(s - station)));
          expect(nearest, `${widthFt}ft plane, bay ${bay.bayIndex} at ${station}in`).toBeLessThan(
            1e-6,
          );
        }
      }
    }
  });

  it("keeps the five strictly increasing and the bays edge to edge", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), realRun(widthFt * 12));
      expect(snap.bays).toHaveLength(snap.choice.bays);
      snap.bays.forEach((bay, index) => {
        for (let i = 1; i < bay.stationsIn.length; i += 1) {
          expect(bay.stationsIn[i]!, `${widthFt}ft bay ${index} station ${i}`).toBeGreaterThan(
            bay.stationsIn[i - 1]!,
          );
        }
        if (index > 0) {
          expect(bay.stationsIn[0]).toBeCloseTo(snap.bays[index - 1]!.stationsIn[4]!, 9);
        }
      });
      expect(snap.bays[0]!.stationsIn[0]).toBe(0);
      expect(snap.bays[snap.bays.length - 1]!.stationsIn[4]).toBeCloseTo(widthFt * 12, 9);
    }
  });

  /* ⚠ Four panels a bay is forced, not chosen: three interior stations need
     three interior seams. A bay of three panels would have to put two
     stations on one seam and collapse a carrot to nothing. */
  it("gives every bay at least four panels", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const bands = realRun(widthFt * 12);
      const seams = roofBracePanelSeamsIn(bands, widthFt * 12);
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), bands);
      for (const bay of snap.bays) {
        const lo = seams.findIndex((s) => Math.abs(s - bay.stationsIn[0]!) < 1e-6);
        const hi = seams.findIndex((s) => Math.abs(s - bay.stationsIn[4]!) < 1e-6);
        expect(hi - lo, `${widthFt}ft bay ${bay.bayIndex}`).toBeGreaterThanOrEqual(
          ROOF_SNAP_MIN_PANELS_PER_BAY,
        );
      }
    }
  });
});

describe("the feet stay on the legs of the X", () => {
  /* ⚠ **THE ONE THING SNAPPING DOES NOT TRADE.** A carrot exists to hand its
     load to the main diagonal, so a foot that misses the leg is a member
     delivering into nothing. Moving the stations changes where the feet sit,
     and the builder recomputes their height from the leg rather than leaving
     them at the quarter point — this is the check of that. */
  it("lands every carrot's far end on a leg, at every plane in the range", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), realRun(widthFt * 12));
      for (const bay of snap.bays) {
        const [x0, , , , x4] = bay.stationsIn;
        const span = x4 - x0;
        const onLegA = (xIn: number) => ((xIn - x0) / span) * snap.planeSlopeIn;
        const onLegB = (xIn: number) => ((x4 - xIn) / span) * snap.planeSlopeIn;
        const carrots = snap.segments.filter(
          (s) => s.bayIndex === bay.bayIndex && s.figure === "carrot",
        );
        expect(carrots).toHaveLength(8);
        for (const carrot of carrots) {
          const missA = Math.abs(carrot.y2In - onLegA(carrot.x2In));
          const missB = Math.abs(carrot.y2In - onLegB(carrot.x2In));
          expect(
            Math.min(missA, missB),
            `${widthFt}ft bay ${bay.bayIndex} foot at ${carrot.x2In}in`,
          ).toBeLessThan(1e-6);
        }
      }
    }
  });
});

describe("the angle cost, stated rather than hidden", () => {
  /* ⚠ **THE CLAIM IN `why`, TESTED BOTH WAYS ROUND.** A carrot can only match
     its leg's angle when a seam falls exactly on a quarter of the bay. On a
     uniform 24in run whose quarter-bay is a whole number of panels, one does
     — and the whole figure stays parallel and in band. */
  it("keeps every member in band when a seam falls on the quarter-bay", () => {
    const planeWidthIn = 576;
    const bands = roofBracePanelBandsFromWidths(
      Array.from({ length: planeWidthIn / 24 }, () => 24),
    );
    const snap = snapRoofBracingToSeams(planeWidthIn, slopeIn(12, 4), bands);
    expect(snap.choice.bays).toBe(3);
    /* 192in bays, so the quarter-bay is 48in — two panels exactly. */
    expect(snap.choice.bayWidthIn / 4).toBe(48);
    expect(snap.outOfBandMemberCount).toBe(0);
    expect(snap.maxDriftIn).toBeCloseTo(0, 6);
    for (const bay of snap.bays) {
      expect(bay.carrotAngleDriftDeg).toBeCloseTo(0, 6);
    }
    expect(snap.why).toMatch(/Every member stays inside the 30-45deg band/);
  });

  /* ⚠ **AND A REAL RUN NEVER PUTS ONE THERE, because it opens with a 15.5in
     edge panel.** Every seam after the first sits at 15.5in plus a multiple
     of 24, so no seam can land on a quarter of a bay whose edges are seams.
     The figure is snapped anyway — his call — and the angles are what it
     spends. */
  it("reports members outside the band on a real run, and says why", () => {
    const snap = snapRoofBracingToSeams(576, slopeIn(12, 4), realRun(576));
    expect(snap.outOfBandMemberCount).toBeGreaterThan(0);
    expect(snap.minMemberAngleDeg).toBeLessThan(ROOF_BRACE_MAX_ANGLE_DEG);
    expect(snap.maxMemberAngleDeg).toBeGreaterThan(ROOF_BRACE_MAX_ANGLE_DEG);
    expect(snap.why).toMatch(/The cost is the angles/);
    expect(snap.why).toMatch(/15\.5in edge panel/);
    expect(snap.why).not.toMatch(/Every member stays inside/);
  });

  /* The main diagonals are what carry; a bay's own X angle is reported
     separately from the carrots' so a reader can tell which is which. */
  it("tells a bay's own X angle apart from its carrots' drift", () => {
    const snap = snapRoofBracingToSeams(576, slopeIn(12, 4), realRun(576));
    for (const bay of snap.bays) {
      const legs = snap.segments.filter((s) => s.bayIndex === bay.bayIndex && s.figure === "x");
      expect(legs).toHaveLength(2);
      for (const leg of legs) {
        expect(roofBraceSegmentAngleDeg(leg)).toBeCloseTo(bay.angleDeg, 9);
      }
      expect(bay.inBand).toBe(
        bay.angleDeg >= ROOF_BRACE_MIN_ANGLE_DEG && bay.angleDeg <= ROOF_BRACE_MAX_ANGLE_DEG,
      );
      /* ⚠ Not every bay drifts — a bay whose stations happen to land evenly
         keeps the parallelism, and on this plane one does. What must hold is
         that the figure as a whole paid something. */
      expect(bay.carrotAngleDriftDeg).toBeGreaterThanOrEqual(0);
      expect(bay.minMemberAngleDeg).toBeLessThanOrEqual(bay.angleDeg);
      expect(bay.maxMemberAngleDeg).toBeGreaterThanOrEqual(bay.angleDeg);
    }
    expect(Math.max(...snap.bays.map((b) => b.carrotAngleDriftDeg))).toBeGreaterThan(0);
  });

  /* ⚠ The drift report has to be self-consistent, or a reader comparing a
     station against its ideal gets a different number from the one reported. */
  it("reports each station's drift as the gap to its own ideal", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), realRun(widthFt * 12));
      for (const bay of snap.bays) {
        for (let i = 0; i < 5; i += 1) {
          expect(bay.driftIn[i]!, `${widthFt}ft bay ${bay.bayIndex} station ${i}`).toBeCloseTo(
            bay.stationsIn[i]! - bay.idealStationsIn[i]!,
            9,
          );
        }
        /* ⚠ And the ideals are the two different questions the report says
           they are, or the check above is a tautology: the bay's two EDGES
           against even bays across the whole plane, the three INTERIOR
           stations against the quarters of the bay they landed in. */
        const span = bay.stationsIn[4]! - bay.stationsIn[0]!;
        expect(bay.idealStationsIn[0]!).toBeCloseTo(bay.bayIndex * snap.choice.bayWidthIn, 9);
        expect(bay.idealStationsIn[4]!).toBeCloseTo(
          (bay.bayIndex + 1) * snap.choice.bayWidthIn,
          9,
        );
        expect(bay.idealStationsIn[1]!).toBeCloseTo(bay.stationsIn[0]! + span / 4, 9);
        expect(bay.idealStationsIn[2]!).toBeCloseTo(bay.stationsIn[0]! + span / 2, 9);
        expect(bay.idealStationsIn[3]!).toBeCloseTo(bay.stationsIn[0]! + (3 * span) / 4, 9);
      }
      expect(snap.maxDriftIn).toBeCloseTo(
        Math.max(...snap.bays.flatMap((b) => b.driftIn.map((d) => Math.abs(d)))),
        9,
      );
    }
  });

  /* ⚠ Never a verdict: this sentence goes in front of an engineer, and
     "passes" or "fails" is a judgement nothing in this app is entitled to
     make. Same guard the schedule capacity statements carry. */
  it("states the trade without pronouncing on it", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), realRun(widthFt * 12));
      expect(snap.why).not.toMatch(/\b(pass|fail)/i);
    }
  });
});

describe("the station choice is the best one available", () => {
  /* ⚠ **THE FIRST BUILD CHOSE EACH STATION AS THE NEAREST SEAM TO ITS QUARTER
     POINT, AND IT PUT A CARROT 19deg OFF ITS LEG** — the first pick left the
     second nowhere to go but one panel along. So the three are chosen
     together, and this brute-forces every valid triple in every bay to
     confirm none of them scores better on the measure the chooser uses:
     worst band excursion first, then total. */
  it("beats every other station triple in the bay on band excursion", () => {
    const bandViolation = (angleDeg: number) =>
      Math.max(0, ROOF_BRACE_MIN_ANGLE_DEG - angleDeg, angleDeg - ROOF_BRACE_MAX_ANGLE_DEG);
    const scoreOf = (stations: readonly number[], planeSlope: number) => {
      const figure = roofBayBracingSegmentsFromStations(
        0,
        [stations[0]!, stations[1]!, stations[2]!, stations[3]!, stations[4]!],
        planeSlope,
      );
      const violations = figure.map((s) => bandViolation(roofBraceSegmentAngleDeg(s)));
      return { worst: Math.max(...violations), total: violations.reduce((a, b) => a + b, 0) };
    };

    for (const widthFt of PLANE_WIDTHS_FT) {
      const bands = realRun(widthFt * 12);
      const seams = roofBracePanelSeamsIn(bands, widthFt * 12);
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), bands);
      for (const bay of snap.bays) {
        const lo = seams.findIndex((s) => Math.abs(s - bay.stationsIn[0]!) < 1e-6);
        const hi = seams.findIndex((s) => Math.abs(s - bay.stationsIn[4]!) < 1e-6);
        const chosen = scoreOf(bay.stationsIn, snap.planeSlopeIn);
        for (let q1 = lo + 1; q1 <= hi - 3; q1 += 1) {
          for (let q2 = q1 + 1; q2 <= hi - 2; q2 += 1) {
            for (let q3 = q2 + 1; q3 <= hi - 1; q3 += 1) {
              const rival = scoreOf(
                [seams[lo]!, seams[q1]!, seams[q2]!, seams[q3]!, seams[hi]!],
                snap.planeSlopeIn,
              );
              const better =
                rival.worst < chosen.worst - 1e-9 ||
                (Math.abs(rival.worst - chosen.worst) < 1e-9 && rival.total < chosen.total - 1e-9);
              expect(
                better,
                `${widthFt}ft bay ${bay.bayIndex}: ${seams[q1]}/${seams[q2]}/${seams[q3]} beats the chosen stations`,
              ).toBe(false);
            }
          }
        }
      }
    }
  });

  /* ⚠ The closed-form angles the chooser scores candidates with are a
     DERIVATION of the builder, so they have to agree with it. If they drift,
     the chooser optimises a figure nobody builds — and every other test here
     would still pass. */
  it("scores candidates with angles the builder actually produces", () => {
    const snap = snapRoofBracingToSeams(576, slopeIn(12, 4), realRun(576));
    for (const bay of snap.bays) {
      const [x0, x1, x2, x3, x4] = bay.stationsIn;
      const span = x4 - x0;
      const gaps = [x1 - x0, x2 - x1, x3 - x2, x4 - x3];
      const deg = (dy: number, dx: number) => (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
      const closedForm = [
        deg(snap.planeSlopeIn, span),
        deg((gaps[0]! / span) * snap.planeSlopeIn, gaps[1]!),
        deg((gaps[3]! / span) * snap.planeSlopeIn, gaps[2]!),
        deg(snap.planeSlopeIn * Math.abs(gaps[0]! / span - 0.5), gaps[0]!),
        deg(snap.planeSlopeIn * Math.abs(gaps[3]! / span - 0.5), gaps[3]!),
      ].sort((a, b) => a - b);
      const built = [
        ...new Set(
          snap.segments
            .filter((s) => s.bayIndex === bay.bayIndex)
            .map((s) => Math.round(roofBraceSegmentAngleDeg(s) * 1e6) / 1e6),
        ),
      ].sort((a, b) => a - b);
      expect(built.length).toBeLessThanOrEqual(closedForm.length);
      for (const angle of built) {
        const nearest = Math.min(...closedForm.map((a) => Math.abs(a - angle)));
        expect(nearest, `bay ${bay.bayIndex} built ${angle}deg`).toBeLessThan(1e-5);
      }
    }
  });

  it("is deterministic: the same run snaps the same way twice", () => {
    const bands = realRun(576);
    const first = snapRoofBracingToSeams(576, slopeIn(12, 4), bands);
    const second = snapRoofBracingToSeams(576, slopeIn(12, 4), bands);
    expect(second.bays.map((b) => b.stationsIn)).toEqual(first.bays.map((b) => b.stationsIn));
  });
});

describe("the bay edges are chosen together too", () => {
  /* ⚠ A bay's span fixes its X's angle outright, so an edge taken greedily
     can push a MAIN diagonal out of the band for a bay that had no say in
     it. This brute-forces every valid edge assignment and confirms none
     evens the spans better than the one chosen. */
  it("beats every other edge assignment on the worst span error", () => {
    for (const widthFt of [48, 60, 72] as const) {
      const bands = realRun(widthFt * 12);
      const seams = roofBracePanelSeamsIn(bands, widthFt * 12);
      const panelCount = seams.length - 1;
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), bands);
      const ideal = snap.choice.bayWidthIn;
      const chosenWorst = Math.max(
        ...snap.bays.map((b) => Math.abs(b.stationsIn[4]! - b.stationsIn[0]! - ideal)),
      );

      /* Every way to cut `bays` bays with at least four panels each. */
      const walk = (edges: number[]): void => {
        const baysLeft = snap.choice.bays - edges.length;
        if (baysLeft === 0) {
          const full = [...edges, panelCount];
          if (full[full.length - 1]! - full[full.length - 2]! < ROOF_SNAP_MIN_PANELS_PER_BAY) return;
          let worst = 0;
          for (let i = 1; i < full.length; i += 1) {
            worst = Math.max(worst, Math.abs(seams[full[i]!]! - seams[full[i - 1]!]! - ideal));
          }
          expect(
            worst,
            `${widthFt}ft plane: edges ${full.join("/")} even the spans better`,
          ).toBeGreaterThanOrEqual(chosenWorst - 1e-9);
          return;
        }
        const last = edges[edges.length - 1]!;
        for (
          let next = last + ROOF_SNAP_MIN_PANELS_PER_BAY;
          next <= panelCount - ROOF_SNAP_MIN_PANELS_PER_BAY * baysLeft;
          next += 1
        ) {
          walk([...edges, next]);
        }
      };
      walk([0]);
    }
  });
});

describe("the bay edges: the ordering that almost never shows", () => {
  /* ⚠ **A SEARCH FOUND THIS CASE; nothing the app builds distinguishes the
     two objectives.** At two bays they are provably the same — the spans sum
     to the plane, so the two errors are equal — and no real run at up to
     eight bays differs, nor did 400,000 random band layouts at two and three
     bays. This five-bay plane of wildly uneven panels does, so it is what
     pins "worst span error first, total second" to a measurement. */
  it("takes the lower WORST span error even when the total is higher", () => {
    const widths = [
      35, 48, 36, 36, 18, 44, 37, 42, 39, 24, 41, 19, 33, 20, 20, 40, 43, 42, 16, 29, 38, 25, 22,
      25, 45, 43, 27, 27, 42,
    ];
    const planeWidthIn = widths.reduce((sum, w) => sum + w, 0);
    expect(planeWidthIn).toBe(956);
    const bands = roofBracePanelBandsFromWidths(widths);
    /* A 112in slope puts four bays at 25.1deg, under the band, and five at
       30.4deg — so the angle rule asks for five. */
    const snap = snapRoofBracingToSeams(planeWidthIn, 112, bands);
    expect(snap.choice.bays).toBe(5);
    expect(snap.snapped).toBe(true);

    const errors = snap.bays.map((b) =>
      Math.abs(b.stationsIn[4]! - b.stationsIn[0]! - snap.choice.bayWidthIn),
    );
    const worst = Math.max(...errors);
    const total = errors.reduce((sum, e) => sum + e, 0);
    /* Minimising the total instead would take a worst of 24.8in and a total
       of 61.2in. The worst error is what fixes a bay's X angle, so it wins. */
    expect(worst).toBeCloseTo(23.8, 6);
    expect(total).toBeCloseTo(83.2, 6);
  });
});

describe("the band the figure is measured against", () => {
  /* ⚠ **The out-of-band count has to notice a SMALL excursion, and no real
     plane produces one** — the misses a 24in module causes are degrees wide,
     so a threshold anywhere under a degree passes every other test here.
     Driving the band in as a parameter is what exercises it: set the ceiling
     half a degree under the figure's own steepest member and that member,
     and only it, must be counted out. */
  it("counts a member half a degree outside the band", () => {
    const bands = realRun(576);
    const wideOpen = snapRoofBracingToSeams(576, slopeIn(12, 4), bands, 0, 89);
    expect(wideOpen.outOfBandMemberCount).toBe(0);
    expect(wideOpen.why).toMatch(/Every member stays inside the 0-89deg band/);

    const ceiling = wideOpen.maxMemberAngleDeg - 0.5;
    const tightened = snapRoofBracingToSeams(576, slopeIn(12, 4), bands, 0, ceiling);
    expect(tightened.outOfBandMemberCount).toBeGreaterThan(0);
    expect(tightened.maxMemberAngleDeg).toBeGreaterThan(ceiling);
  });
});

describe("the plane that cannot be snapped", () => {
  /* ⚠ **IT FALLS BACK RATHER THAN THROWING, and the shape is real**: a wide,
     shallow plane made of 48in panels. The angle band wants twelve bays out
     of twenty-four panels, and each bay needs four. Such a plane still gets
     braced — it just keeps the offcuts stride 2 measured. */
  it("braces a plane with too few panels the unsnapped way, and says so", () => {
    const widths = Array.from({ length: 24 }, () => 48);
    const bands = roofBracePanelBandsFromWidths(widths);
    const planeWidthIn = 24 * 48;
    const snap = snapRoofBracingToSeams(planeWidthIn, 60, bands);

    expect(snap.snapped).toBe(false);
    expect(snap.bays).toEqual([]);
    expect(snap.refusal).toMatch(/NOT snapped to the panel seams/);
    expect(snap.refusal).toMatch(/12 bays/);
    expect(snap.refusal).toMatch(/48 in all, against the 24 this run has/);
    expect(snap.why).toBe(snap.refusal);

    /* And the figure it returns is the unsnapped one, unchanged. */
    const unsnapped = roofPlaneBracing(planeWidthIn, 60);
    expect(snap.segments).toEqual(unsnapped.segments);
    expect(snap.totalLengthIn).toBeCloseTo(unsnapped.totalLengthIn, 9);
    expect(snap.segments).toHaveLength(snap.choice.bays * ROOF_BRACE_SEGMENTS_PER_BAY);

    /* The offcuts are still there, which is what the refusal is warning
       about rather than papering over. */
    const sliced = sliceRoofPlaneBracing(snap, bands);
    expect(sliced.meanSlicesPerPanel).toBeGreaterThan(4);
  });

  /* The boundary: a plane with exactly four panels a bay snaps, and one
     panel fewer does not. */
  it("snaps at exactly four panels a bay and gives up one panel short", () => {
    /* A 192in plane on an 80in slope: one X across it is 22.6deg, under the
       band, so the angle rule takes two bays at 39.8deg — and two bays need
       eight panels. The same plane cut into seven cannot carry the figure. */
    const planeWidthIn = 8 * 24;
    const planeSlopeIn = 80;
    const exact = roofBracePanelBandsFromWidths(Array.from({ length: 8 }, () => 24));
    const snapExact = snapRoofBracingToSeams(planeWidthIn, planeSlopeIn, exact);
    expect(snapExact.choice.bays).toBe(2);
    expect(snapExact.snapped).toBe(true);

    const short = roofBracePanelBandsFromWidths(
      Array.from({ length: 7 }, () => planeWidthIn / 7),
    );
    const snapShort = snapRoofBracingToSeams(planeWidthIn, planeSlopeIn, short);
    expect(snapShort.choice.bays).toBe(2);
    expect(snapShort.snapped).toBe(false);
    expect(snapShort.refusal).toMatch(/8 in all, against the 7 this run has/);
  });

  /* A single-bay plane needs four panels and nothing more, so the narrowest
     plane the app builds still snaps. */
  it("snaps a small single-bay plane", () => {
    const bands = realRun(16 * 12);
    const snap = snapRoofBracingToSeams(16 * 12, slopeIn(12, 4), bands);
    expect(snap.choice.bays).toBe(1);
    expect(snap.snapped).toBe(true);
    expect(sliceRoofPlaneBracing(snap, bands).maxSlicesPerPanel).toBe(4);
  });
});

describe("snapping does not change what the figure is", () => {
  it("keeps ten members a bay, two of them the X", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), realRun(widthFt * 12));
      expect(snap.segments, `${widthFt}ft plane`).toHaveLength(
        snap.choice.bays * ROOF_BRACE_SEGMENTS_PER_BAY,
      );
      for (const bay of snap.bays) {
        const inBay = snap.segments.filter((s) => s.bayIndex === bay.bayIndex);
        expect(inBay.filter((s) => s.figure === "x")).toHaveLength(2);
        expect(inBay.filter((s) => s.figure === "carrot")).toHaveLength(8);
      }
    }
  });

  it("gives every member a real length and no axis-aligned member", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), realRun(widthFt * 12));
      for (const segment of snap.segments) {
        const length = roofBraceSegmentLengthIn(segment);
        expect(Number.isFinite(length)).toBe(true);
        expect(length).toBeGreaterThan(0);
        const angle = roofBraceSegmentAngleDeg(segment);
        expect(angle).toBeGreaterThan(0);
        expect(angle).toBeLessThan(90);
      }
    }
  });

  /* The bay COUNT is still the angle rule's decision — the seams have no
     opinion on it, and snapping must not quietly change it. */
  it("leaves the bay count to the angle rule", () => {
    for (const widthFt of PLANE_WIDTHS_FT) {
      const snap = snapRoofBracingToSeams(widthFt * 12, slopeIn(12, 4), realRun(widthFt * 12));
      const unsnapped = roofPlaneBracing(widthFt * 12, slopeIn(12, 4));
      expect(snap.choice, `${widthFt}ft plane`).toEqual(unsnapped.choice);
    }
  });
});
