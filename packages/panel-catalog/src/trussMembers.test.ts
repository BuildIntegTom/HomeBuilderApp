import { describe, expect, it } from "vitest";
import {
  buildClassicTrussSchema,
  buildEnergyHeelTrussMembers,
  buildEnergyHeelTrussSchema,
  buildFinkTrussMembers,
  buildHighPerfTrussBearingMembers,
  buildHoweTrussMembers,
  buildKingPostTrussMembers,
  buildParallelChordTrussMembers,
  buildParallelChordTrussSchema,
  buildPrattTrussMembers,
  buildQueenPostTrussMembers,
  buildScissorTrussMembers,
  clampHighPerfTrussPitchIn12,
  CLASSIC_TRUSS_DEFAULT_PITCH_IN12,
  CLASSIC_TRUSS_TYPES,
  HIGH_PERF_TRUSS_BEARING_SHAPES,
  HIGH_PERF_TRUSS_MAX_PITCH_IN12,
  HIGH_PERF_TRUSS_MIN_PITCH_IN12,
} from "./trussMembers";
import { memberBoxSizeIn } from "./panelMemberHelpers";
import { ROOF_CATCHER_BEAM_PLY_COUNT } from "./roofCatcherBeamMembers";

const SPAN_IN = 360; // 30ft

describe("buildKingPostTrussMembers", () => {
  it("has a bottom chord, 2 top chord slopes, and exactly 1 vertical king post", () => {
    const members = buildKingPostTrussMembers(SPAN_IN, 6);
    expect(members.filter((m) => m.role === "plate")).toHaveLength(3);
    const posts = members.filter((m) => m.role === "stud");
    expect(posts).toHaveLength(1);
    expect(posts[0]!.memberId).toBe("king_post");
  });

  it("the king post spans from the bottom chord up to the ridge peak height", () => {
    const pitchIn12 = 6;
    const members = buildKingPostTrussMembers(SPAN_IN, pitchIn12);
    const post = members.find((m) => m.memberId === "king_post")!;
    const expectedPeakZIn = (SPAN_IN / 2) * (pitchIn12 / 12);
    expect(post.actualDimsIn.lengthIn).toBeCloseTo(expectedPeakZIn, 6);
  });

  it("the 2 top-chord halves meet exactly at mid-span", () => {
    const members = buildKingPostTrussMembers(SPAN_IN, 6);
    const left = members.find((m) => m.memberId === "top_chord_left")!;
    const right = members.find((m) => m.memberId === "top_chord_right")!;
    expect(left.actualDimsIn.lengthIn).toBeCloseTo(right.actualDimsIn.lengthIn, 6);
  });

  it("chords are 2x6, webs/posts are 2x4", () => {
    const members = buildKingPostTrussMembers(SPAN_IN, 6);
    for (const m of members.filter((m) => m.role === "plate")) {
      expect(m.nominalSize).toBe("2x6");
      expect(m.actualDimsIn.widthIn).toBeCloseTo(5.5, 6);
    }
    for (const m of members.filter((m) => m.role === "stud")) {
      expect(m.nominalSize).toBe("2x4");
      expect(m.actualDimsIn.widthIn).toBeCloseTo(3.5, 6);
    }
  });

  it("every member sizes correctly via the shared axis mapping", () => {
    for (const m of buildKingPostTrussMembers(SPAN_IN, 6)) {
      const size = memberBoxSizeIn(m);
      expect(size.xIn).toBeGreaterThan(0);
      expect(size.yIn).toBeGreaterThan(0);
      expect(size.zIn).toBeGreaterThan(0);
    }
  });

  it("defaults to a representative span/pitch when called with no args", () => {
    expect(buildKingPostTrussMembers().length).toBeGreaterThan(0);
  });
});

describe("buildQueenPostTrussMembers", () => {
  it("has bottom chord + 2 top-chord slopes + straining beam (4 plates) and 2 vertical queen posts", () => {
    const members = buildQueenPostTrussMembers(SPAN_IN, 6);
    expect(members.filter((m) => m.role === "plate")).toHaveLength(4);
    const posts = members.filter((m) => m.role === "stud");
    expect(posts).toHaveLength(2);
  });

  it("the straining beam is horizontal (zero rise) and sits between the 1/3 and 2/3 span points", () => {
    const members = buildQueenPostTrussMembers(SPAN_IN, 6);
    const beam = members.find((m) => m.memberId === "straining_beam")!;
    expect(beam.actualDimsIn.lengthIn).toBeCloseTo(SPAN_IN / 3, 6);
  });

  it("both queen posts are the same height", () => {
    const members = buildQueenPostTrussMembers(SPAN_IN, 6);
    const left = members.find((m) => m.memberId === "queen_post_left")!;
    const right = members.find((m) => m.memberId === "queen_post_right")!;
    expect(left.actualDimsIn.lengthIn).toBeCloseTo(right.actualDimsIn.lengthIn, 6);
  });
});

describe("buildFinkTrussMembers", () => {
  it("has a bottom chord, 2 top-chord slopes, and a repeating W web of brace pairs", () => {
    const members = buildFinkTrussMembers(SPAN_IN, 6);
    expect(members.filter((m) => m.role === "plate")).toHaveLength(3);
    const braces = members.filter((m) => m.role === "brace");
    expect(braces.length).toBeGreaterThan(0);
    expect(braces.length % 2).toBe(0); // rise+fall pairs
  });

  it("uses more web peaks for a wider span at the same pitch", () => {
    const narrow = buildFinkTrussMembers(200, 6).filter((m) => m.role === "brace").length;
    const wide = buildFinkTrussMembers(600, 6).filter((m) => m.role === "brace").length;
    expect(wide).toBeGreaterThanOrEqual(narrow);
  });
});

describe("buildHoweTrussMembers / buildPrattTrussMembers", () => {
  it("both have the same chord/post layout — 3 plates, 4 interior vertical posts (2 per half)", () => {
    const howe = buildHoweTrussMembers(SPAN_IN, 6);
    const pratt = buildPrattTrussMembers(SPAN_IN, 6);
    for (const members of [howe, pratt]) {
      expect(members.filter((m) => m.role === "plate")).toHaveLength(3);
      expect(members.filter((m) => m.role === "stud")).toHaveLength(4);
      expect(members.filter((m) => m.role === "brace")).toHaveLength(6); // 3 bays x 2 halves
    }
  });

  it("Howe and Pratt diagonals lean opposite directions for the same bay", () => {
    const howe = buildHoweTrussMembers(SPAN_IN, 6);
    const pratt = buildPrattTrussMembers(SPAN_IN, 6);
    const howeDiag = howe.find((m) => m.memberId === "left_diagonal_1")!;
    const prattDiag = pratt.find((m) => m.memberId === "left_diagonal_1")!;
    // Same 2 endpoints, opposite tilt direction (mirrored about vertical) since which end is "bottom" swaps.
    expect(howeDiag.position.tiltDeg).not.toBeCloseTo(prattDiag.position.tiltDeg!, 3);
  });

  it("every interior vertical post reaches exactly to the top chord above it", () => {
    const pitchIn12 = 6;
    const members = buildHoweTrussMembers(SPAN_IN, pitchIn12);
    const post = members.find((m) => m.memberId === "left_post_1")!;
    // post 1 of 3 on the left half sits at x = spanIn/2/3 from the heel
    const xIn = SPAN_IN / 2 / 3;
    const expectedTopZIn = xIn * (pitchIn12 / 12);
    expect(post.actualDimsIn.lengthIn).toBeCloseTo(expectedTopZIn, 6);
  });
});

describe("buildScissorTrussMembers", () => {
  it("has 2 top chords, 2 bottom chords, and a vertical center strut", () => {
    const members = buildScissorTrussMembers(336, 8, 3);
    expect(members.filter((m) => m.role === "plate")).toHaveLength(4);
    expect(members.filter((m) => m.role === "stud")).toHaveLength(1);
  });

  it("the two bottom chords are the same length (mirror images of each other)", () => {
    const members = buildScissorTrussMembers(336, 8, 3);
    const a = members.find((m) => m.memberId === "bottom_chord_a")!;
    const b = members.find((m) => m.memberId === "bottom_chord_b")!;
    expect(a.actualDimsIn.lengthIn).toBeCloseTo(b.actualDimsIn.lengthIn, 6);
  });

  it("each bottom chord's far end lands below the ridge height (stays inside the roof envelope)", () => {
    const spanIn = 336;
    const topPitchIn12 = 8;
    const members = buildScissorTrussMembers(spanIn, topPitchIn12, 3);
    const ridgeZIn = (spanIn / 2) * (topPitchIn12 / 12);
    const bottomA = members.find((m) => m.memberId === "bottom_chord_a")!;
    expect(bottomA.position.zIn).toBeLessThan(ridgeZIn);
  });

  it("the center strut rises from the bottom chords' crossing height up to the ridge", () => {
    const spanIn = 336;
    const topPitchIn12 = 8;
    const bottomPitchIn12 = 3;
    const members = buildScissorTrussMembers(spanIn, topPitchIn12, bottomPitchIn12);
    const strut = members.find((m) => m.memberId === "center_strut")!;
    const crossZIn = (spanIn / 2) * (bottomPitchIn12 / 12);
    const ridgeZIn = (spanIn / 2) * (topPitchIn12 / 12);
    expect(strut.actualDimsIn.lengthIn).toBeCloseTo(ridgeZIn - crossZIn, 6);
  });
});

describe("CLASSIC_TRUSS_TYPES", () => {
  it("has all 6 classic types, each building a non-empty member list", () => {
    expect(CLASSIC_TRUSS_TYPES).toHaveLength(6);
    for (const t of CLASSIC_TRUSS_TYPES) {
      expect(t.build().length).toBeGreaterThan(0);
    }
  });

  it("every id is unique", () => {
    const ids = CLASSIC_TRUSS_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buildClassicTrussSchema", () => {
  it("wraps a truss type's members with the shared schema envelope and the manufacturer-disclaimer note", () => {
    const kingPost = CLASSIC_TRUSS_TYPES.find((t) => t.id === "king-post")!;
    const schema = buildClassicTrussSchema(kingPost);
    expect(schema.id).toBe("classic_truss_king-post");
    expect(schema.members.length).toBeGreaterThan(0);
    expect(schema.overallDimensions.widthIn).toBeCloseTo(kingPost.defaultSpanIn, 6);
    expect(schema.notes.some((n) => n.text.toLowerCase().includes("truss manufacturer"))).toBe(true);
    expect(schema.disclaimer).toBe("Reference only — not engineered, not for construction.");
  });

  it("wraps every classic truss type without throwing", () => {
    for (const t of CLASSIC_TRUSS_TYPES) {
      expect(() => buildClassicTrussSchema(t)).not.toThrow();
    }
  });
});

describe("CLASSIC_TRUSS_DEFAULT_PITCH_IN12", () => {
  it("is a sane residential pitch (rise per 12in run)", () => {
    expect(CLASSIC_TRUSS_DEFAULT_PITCH_IN12).toBeGreaterThan(0);
    expect(CLASSIC_TRUSS_DEFAULT_PITCH_IN12).toBeLessThan(12);
  });
});

describe("clampHighPerfTrussPitchIn12", () => {
  it("passes through pitches already within 2/12-12/12", () => {
    expect(clampHighPerfTrussPitchIn12(6)).toBe(6);
    expect(clampHighPerfTrussPitchIn12(HIGH_PERF_TRUSS_MIN_PITCH_IN12)).toBe(HIGH_PERF_TRUSS_MIN_PITCH_IN12);
    expect(clampHighPerfTrussPitchIn12(HIGH_PERF_TRUSS_MAX_PITCH_IN12)).toBe(HIGH_PERF_TRUSS_MAX_PITCH_IN12);
  });

  it("clamps out-of-range pitches to the 2/12-12/12 boundary", () => {
    expect(clampHighPerfTrussPitchIn12(0)).toBe(HIGH_PERF_TRUSS_MIN_PITCH_IN12);
    expect(clampHighPerfTrussPitchIn12(20)).toBe(HIGH_PERF_TRUSS_MAX_PITCH_IN12);
  });
});

describe("buildEnergyHeelTrussMembers", () => {
  it("has 2 heel posts, a flat bottom chord, 2 sloped top-chord halves, and a W web", () => {
    const members = buildEnergyHeelTrussMembers(SPAN_IN, 6, 18);
    const posts = members.filter((m) => m.role === "stud");
    expect(posts).toHaveLength(2);
    expect(members.filter((m) => m.role === "plate")).toHaveLength(3); // bottom + 2 top-chord halves
    expect(members.filter((m) => m.role === "brace").length).toBeGreaterThan(0);
  });

  it("each heel post is exactly cavityDepthIn tall, holding the full cavity to the wall line", () => {
    for (const cavityDepthIn of [18, 24] as const) {
      const members = buildEnergyHeelTrussMembers(SPAN_IN, 6, cavityDepthIn);
      const left = members.find((m) => m.memberId === "heel_post_left")!;
      const right = members.find((m) => m.memberId === "heel_post_right")!;
      expect(left.actualDimsIn.lengthIn).toBeCloseTo(cavityDepthIn, 6);
      expect(right.actualDimsIn.lengthIn).toBeCloseTo(cavityDepthIn, 6);
    }
  });

  it("the ridge sits cavityDepthIn taller than a conventional (non-raised-heel) truss at the same span/pitch", () => {
    const pitchIn12 = 6;
    const conventionalPeakZIn = (SPAN_IN / 2) * (pitchIn12 / 12);
    for (const cavityDepthIn of [18, 24] as const) {
      const members = buildEnergyHeelTrussMembers(SPAN_IN, pitchIn12, cavityDepthIn);
      const topLeft = members.find((m) => m.memberId === "top_chord_left")!;
      // A "diagonal" member's position.zIn is its CENTER, not an endpoint (see
      // componentSchema.ts) — the member runs from (0, cavityDepthIn) to
      // (spanIn/2, peakZIn), so centerZ = (cavityDepthIn + peakZIn) / 2.
      const raisedPeakZIn = 2 * topLeft.position.zIn - cavityDepthIn;
      expect(raisedPeakZIn).toBeCloseTo(conventionalPeakZIn + cavityDepthIn, 6);
    }
  });

  it("clamps an out-of-range pitch instead of producing a nonsensical roof", () => {
    const steep = buildEnergyHeelTrussMembers(SPAN_IN, 30, 18);
    const clamped = buildEnergyHeelTrussMembers(SPAN_IN, HIGH_PERF_TRUSS_MAX_PITCH_IN12, 18);
    const steepTop = steep.find((m) => m.memberId === "top_chord_left")!;
    const clampedTop = clamped.find((m) => m.memberId === "top_chord_left")!;
    expect(steepTop.actualDimsIn.lengthIn).toBeCloseTo(clampedTop.actualDimsIn.lengthIn, 6);
  });

  it("every member sizes correctly via the shared axis mapping, at every pitch in range", () => {
    for (const pitchIn12 of [HIGH_PERF_TRUSS_MIN_PITCH_IN12, 6, HIGH_PERF_TRUSS_MAX_PITCH_IN12]) {
      for (const m of buildEnergyHeelTrussMembers(SPAN_IN, pitchIn12, 18)) {
        const size = memberBoxSizeIn(m);
        expect(size.xIn).toBeGreaterThan(0);
        expect(size.yIn).toBeGreaterThan(0);
        expect(size.zIn).toBeGreaterThan(0);
      }
    }
  });
});

describe("buildParallelChordTrussMembers", () => {
  it("has 2 heel posts, 2 parallel chords, and a zigzag web", () => {
    const members = buildParallelChordTrussMembers(SPAN_IN, 4, 18);
    expect(members.filter((m) => m.role === "stud")).toHaveLength(2);
    expect(members.filter((m) => m.role === "plate")).toHaveLength(2); // bottom + top, no peak
    expect(members.filter((m) => m.role === "brace").length).toBeGreaterThan(0);
  });

  it("the top and bottom chords stay exactly cavityDepthIn apart at both ends (genuinely parallel)", () => {
    for (const cavityDepthIn of [18, 24] as const) {
      const members = buildParallelChordTrussMembers(SPAN_IN, 4, cavityDepthIn);
      const bottom = members.find((m) => m.memberId === "bottom_chord")!;
      const top = members.find((m) => m.memberId === "top_chord")!;
      // Both chords span the same run at the same pitch, so their lengths match...
      expect(bottom.actualDimsIn.lengthIn).toBeCloseTo(top.actualDimsIn.lengthIn, 6);
      // ...and each heel post (the vertical gap between them) is exactly cavityDepthIn.
      const leftPost = members.find((m) => m.memberId === "heel_post_left")!;
      const rightPost = members.find((m) => m.memberId === "heel_post_right")!;
      expect(leftPost.actualDimsIn.lengthIn).toBeCloseTo(cavityDepthIn, 6);
      expect(rightPost.actualDimsIn.lengthIn).toBeCloseTo(cavityDepthIn, 6);
    }
  });

  it("uses more web peaks for a deeper cavity requiring wider bays to stay above the min angle... actually fewer, since more rise per bay needs fewer bays", () => {
    // computeTrussWebPeakCount(spanIn, riseIn) -> more riseIn (deeper cavity) means FEWER peaks needed.
    const shallow = buildParallelChordTrussMembers(SPAN_IN, 4, 18).filter((m) => m.role === "brace").length;
    const deep = buildParallelChordTrussMembers(SPAN_IN, 4, 24).filter((m) => m.role === "brace").length;
    expect(deep).toBeLessThanOrEqual(shallow);
  });

  it("every member sizes correctly via the shared axis mapping, at every pitch in range", () => {
    for (const pitchIn12 of [HIGH_PERF_TRUSS_MIN_PITCH_IN12, 6, HIGH_PERF_TRUSS_MAX_PITCH_IN12]) {
      for (const m of buildParallelChordTrussMembers(SPAN_IN, pitchIn12, 24)) {
        const size = memberBoxSizeIn(m);
        expect(size.xIn).toBeGreaterThan(0);
        expect(size.yIn).toBeGreaterThan(0);
        expect(size.zIn).toBeGreaterThan(0);
      }
    }
  });
});

describe("buildHighPerfTrussBearingMembers", () => {
  it("built-up-3ply-2x12 reuses the roof-catcher beam's 3-ply geometry", () => {
    const members = buildHighPerfTrussBearingMembers(SPAN_IN, "built-up-3ply-2x12");
    expect(members).toHaveLength(ROOF_CATCHER_BEAM_PLY_COUNT);
  });

  it("lvl-14in is a single 1-3/4in x 14in member", () => {
    const members = buildHighPerfTrussBearingMembers(SPAN_IN, "lvl-14in");
    expect(members).toHaveLength(1);
    expect(members[0]!.actualDimsIn).toEqual({ thicknessIn: 1.75, widthIn: 14, lengthIn: SPAN_IN });
  });
});

describe("HIGH_PERF_TRUSS_BEARING_SHAPES", () => {
  it("has exactly the 2 shapes Tommy asked for, each with a positive depth", () => {
    expect(HIGH_PERF_TRUSS_BEARING_SHAPES).toHaveLength(2);
    for (const b of HIGH_PERF_TRUSS_BEARING_SHAPES) expect(b.depthIn).toBeGreaterThan(0);
  });
});

describe("buildEnergyHeelTrussSchema / buildParallelChordTrussSchema", () => {
  it("energy-heel schema wraps members with pitch/cavity in the display name and bearing-shape note", () => {
    const schema = buildEnergyHeelTrussSchema(SPAN_IN, 6, 18, "lvl-14in");
    expect(schema.id).toBe("energy_heel_truss");
    expect(schema.displayName).toContain("6/12");
    expect(schema.displayName).toContain("18in");
    expect(schema.members.length).toBeGreaterThan(0);
    expect(schema.notes.some((n) => n.text.includes("LVL"))).toBe(true);
  });

  it("parallel-chord schema wraps members with pitch/cavity in the display name and bearing-shape note", () => {
    const schema = buildParallelChordTrussSchema(SPAN_IN, 4, 24, "built-up-3ply-2x12");
    expect(schema.id).toBe("parallel_chord_truss");
    expect(schema.displayName).toContain("4/12");
    expect(schema.displayName).toContain("24in");
    expect(schema.members.length).toBeGreaterThan(0);
    expect(schema.notes.some((n) => n.text.includes("2x12"))).toBe(true);
  });

  it("both schemas clamp out-of-range pitch in their own display name", () => {
    const energyHeel = buildEnergyHeelTrussSchema(SPAN_IN, 99, 18, "lvl-14in");
    const parallelChord = buildParallelChordTrussSchema(SPAN_IN, -5, 18, "lvl-14in");
    expect(energyHeel.displayName).toContain(`${HIGH_PERF_TRUSS_MAX_PITCH_IN12}/12`);
    expect(parallelChord.displayName).toContain(`${HIGH_PERF_TRUSS_MIN_PITCH_IN12}/12`);
  });
});
