import {
  buildBracedPanelMembers,
  buildGablePanelMembers,
  buildStandardPanelMembers,
  memberLocalCornersIn,
  overlappingMemberPairs,
  type PanelMember,
} from "@building-integrity/panel-catalog";
import { describe, expect, it } from "vitest";
import { projectPanelAxonometric, projectPoint, shadeHex, SHOP_DRAWING_ANGLES } from "./panelAxonometric";

const PANEL = () => buildStandardPanelMembers(40, 15.5, 120, false);

describe("the projection itself", () => {
  it("⚠ returns SVG-DOWN vertical, so a panel is not drawn upside down", () => {
    // Forgetting this flip renders a plausible-looking but inverted panel, which
    // on a symmetrical one survives a glance. A point higher in the world must
    // come back SMALLER in v.
    const low = projectPoint(0, 0, 0, SHOP_DRAWING_ANGLES);
    const high = projectPoint(0, 100, 0, SHOP_DRAWING_ANGLES);
    expect(high.vIn).toBeLessThan(low.vIn);
  });

  it("looks at the exterior face: the panel's width dominates its depth on screen", () => {
    // The whole point of the camera Tommy asked for. A 40in-wide, 15.5in-deep
    // panel must read as wide, not as an end-on slab.
    const widthSpan = Math.abs(
      projectPoint(40, 0, 0, SHOP_DRAWING_ANGLES).uIn - projectPoint(0, 0, 0, SHOP_DRAWING_ANGLES).uIn,
    );
    const depthSpan = Math.abs(
      projectPoint(0, 0, 15.5, SHOP_DRAWING_ANGLES).uIn - projectPoint(0, 0, 0, SHOP_DRAWING_ANGLES).uIn,
    );
    expect(widthSpan).toBeGreaterThan(depthSpan * 3);
  });

  it("is tilted up: the top of the panel shows, so depth separates vertically too", () => {
    const front = projectPoint(0, 0, 0, SHOP_DRAWING_ANGLES);
    const back = projectPoint(0, 0, 15.5, SHOP_DRAWING_ANGLES);
    expect(Math.abs(back.vIn - front.vIn)).toBeGreaterThan(1);
  });

  it("⚠ is tilted LEFT: the panel's LEFT end is nearer, so its end face is the one you see", () => {
    /* Tommy's "up and left". The test first asserted the opposite, with a
       comment that contradicted its own assertion — "+X nearer" while checking
       that x=0 was farther. x=0 IS the left end, and it is the near one, which
       is what makes the left end face visible and gives the panel its form.
       Written out explicitly because a sign error here produces a perfectly
       reasonable-looking drawing of the wrong side. */
    const leftEnd = projectPoint(0, 0, 0, SHOP_DRAWING_ANGLES);
    const rightEnd = projectPoint(40, 0, 0, SHOP_DRAWING_ANGLES);
    expect(leftEnd.depthIn).toBeLessThan(rightEnd.depthIn);
  });

  it("straight-on angles collapse to a plain elevation", () => {
    // A sanity anchor for the maths: with no yaw and no pitch, the projection is
    // just (x, -y) and depth is z.
    const p = projectPoint(12, 34, 56, { yawDeg: 0, pitchDeg: 0 });
    expect(p.uIn).toBeCloseTo(12, 9);
    expect(p.vIn).toBeCloseTo(-34, 9);
    expect(p.depthIn).toBeCloseTo(56, 9);
  });
});

describe("a whole panel", () => {
  const proj = projectPanelAxonometric(PANEL());

  it("gives one centroid per member, in input order", () => {
    expect(proj.centroids).toHaveLength(PANEL().length);
  });

  it("⚠ sorts each MEMBER's own faces farthest first, which is exact for one convex board", () => {
    // The whole-drawing order is no longer monotonic in depth and must not be
    // — see `orderSolidsBackToFront`. Within one member it still is, and that
    // is what keeps a single board from turning inside out.
    const runs = new Map<number, number[]>();
    for (const f of proj.faces) {
      const run = runs.get(f.memberIndex);
      if (run) run.push(f.depthIn);
      else runs.set(f.memberIndex, [f.depthIn]);
    }
    for (const [memberIndex, depths] of runs) {
      for (let i = 1; i < depths.length; i++) {
        expect(depths[i - 1], `member ${memberIndex}`).toBeGreaterThanOrEqual(depths[i]!);
      }
    }
  });

  it("⚠ draws each member's faces in ONE unbroken run — a board is never split around another", () => {
    const seen = new Set<number>();
    let current: number | null = null;
    for (const f of proj.faces) {
      if (f.memberIndex === current) continue;
      expect(seen.has(f.memberIndex), `member ${f.memberIndex} drawn in two pieces`).toBe(false);
      seen.add(f.memberIndex);
      current = f.memberIndex;
    }
  });

  it("every face has at least 3 points and a real shade", () => {
    expect(proj.faces.length).toBeGreaterThan(20);
    for (const f of proj.faces) {
      expect(f.points.length).toBeGreaterThanOrEqual(3);
      expect(f.shade).toBeGreaterThanOrEqual(0.62);
      expect(f.shade).toBeLessThanOrEqual(1);
    }
  });

  it("⚠ NO FACE IS DROPPED — every member contributes, including edge-on boards", () => {
    // Back-face culling is deliberately not done: a thin board seen nearly
    // edge-on can round to zero projected area and vanish, leaving a hole in a
    // drawing someone is going to build from.
    const seen = new Set(proj.faces.map((f) => f.memberIndex));
    expect(seen.size).toBe(PANEL().length);
  });

  it("bounds enclose every projected point", () => {
    for (const f of proj.faces) {
      for (const p of f.points) {
        expect(p.uIn).toBeGreaterThanOrEqual(proj.bounds.minU - 1e-9);
        expect(p.uIn).toBeLessThanOrEqual(proj.bounds.maxU + 1e-9);
        expect(p.vIn).toBeGreaterThanOrEqual(proj.bounds.minV - 1e-9);
        expect(p.vIn).toBeLessThanOrEqual(proj.bounds.maxV + 1e-9);
      }
    }
  });

  it("handles a braced panel's true trapezoid braces without special-casing", () => {
    // The braces are trapezoid prisms, not boxes — the same corner/face
    // functions the OBJ exporter uses, so this needs no extra code at all.
    const braced = buildBracedPanelMembers(40, 15.5, 120, false, "chevron", false);
    const p = projectPanelAxonometric(braced);
    expect(p.centroids).toHaveLength(braced.length);
    expect(new Set(p.faces.map((f) => f.memberIndex)).size).toBe(braced.length);
  });

  it("an empty member list does not produce infinite bounds", () => {
    // Guards the Infinity seeds — a Safety/Gap panel can be very nearly nothing.
    const empty = projectPanelAxonometric([]);
    expect(empty.bounds).toEqual({ minU: 0, minV: 0, maxU: 0, maxV: 0 });
    expect(empty.faces).toEqual([]);
  });
});

/**
 * ⚠ **The drawing is SCORED, not trusted.**
 *
 * The defect this replaces was invisible to every assertion this file had:
 * the order was perfectly monotonic in face depth, and the drawing was still
 * wrong, because mean depth conflates TALL with FAR (see
 * `orderSolidsBackToFront`). So this measures the thing that actually matters
 * — how much of the drawn area is painted by a face that is genuinely FARTHER
 * than the face it covers — and pins it per panel.
 *
 * Tommy, 2026-11-24, on the gable tile that found it: *"It appears as though
 * they are overlapping at the bottom of the studs."* They were not. That
 * panel now scores zero.
 */
describe("⚠ how much of the drawing is painted in the wrong order", () => {
  interface ScoredPoint {
    u: number;
    v: number;
    d: number;
  }

  function clip(subject: ScoredPoint[], clipper: ScoredPoint[]): ScoredPoint[] {
    let out = subject;
    for (let i = 0; i < clipper.length && out.length > 0; i++) {
      const a = clipper[i]!;
      const b = clipper[(i + 1) % clipper.length]!;
      const side = (p: ScoredPoint) => (b.u - a.u) * (p.v - a.v) - (b.v - a.v) * (p.u - a.u);
      const input = out;
      out = [];
      for (let j = 0; j < input.length; j++) {
        const cur = input[j]!;
        const prev = input[(j + input.length - 1) % input.length]!;
        const sc = side(cur);
        const sp = side(prev);
        const lerp = (t: number): ScoredPoint => ({
          u: prev.u + t * (cur.u - prev.u),
          v: prev.v + t * (cur.v - prev.v),
          d: prev.d + t * (cur.d - prev.d),
        });
        if (sc >= 0) {
          if (sp < 0) out.push(lerp(sp / (sp - sc)));
          out.push(cur);
        } else if (sp >= 0) {
          out.push(lerp(sp / (sp - sc)));
        }
      }
    }
    return out;
  }

  function area(poly: ScoredPoint[]): number {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      a += p.u * q.v - q.u * p.v;
    }
    return Math.abs(a) / 2;
  }

  function counterClockwise(poly: ScoredPoint[]): ScoredPoint[] {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      a += p.u * q.v - q.u * p.v;
    }
    return a < 0 ? [...poly].reverse() : poly;
  }

  function depthAt(poly: ScoredPoint[], u: number, v: number): number | null {
    for (let i = 1; i + 1 < poly.length; i++) {
      const a = poly[0]!;
      const b = poly[i]!;
      const c = poly[i + 1]!;
      const den = (b.v - c.v) * (a.u - c.u) + (c.u - b.u) * (a.v - c.v);
      if (Math.abs(den) < 1e-12) continue;
      const wa = ((b.v - c.v) * (u - c.u) + (c.u - b.u) * (v - c.v)) / den;
      const wb = ((c.v - a.v) * (u - c.u) + (a.u - c.u) * (v - c.v)) / den;
      const wc = 1 - wa - wb;
      if (wa >= -1e-9 && wb >= -1e-9 && wc >= -1e-9) return wa * a.d + wb * b.d + wc * c.d;
    }
    return null;
  }

  /**
   * Percent of drawn area covered by a face that is really behind it.
   *
   * `"legacy"` re-sorts the very same faces by their own mean depth, which is
   * exactly what this module did before 2026-11-24 — so the two numbers are
   * the same drawing scored two ways, not two drawings.
   */
  function misPaintedPercent(members: PanelMember[], order: "renderer" | "legacy" = "renderer"): number {
    const projected = projectPanelAxonometric(members);
    const faces =
      order === "legacy" ? [...projected.faces].sort((a, b) => b.depthIn - a.depthIn) : projected.faces;
    /* `AxonometricFace` keeps only the face's mean depth, so each corner's own
       depth is re-derived here from the same projection the renderer used —
       by matching the corner back to the member it came from. */
    const projectedByMember = members.map((m) =>
      memberLocalCornersIn(m).map((c) => projectPoint(c[0], c[1], c[2], SHOP_DRAWING_ANGLES)),
    );
    const polys = faces.map((f) => {
      const corners = projectedByMember[f.memberIndex]!;
      return counterClockwise(
        f.points.map((p) => {
          const hit = corners.find((q) => Math.abs(q.uIn - p.uIn) < 1e-9 && Math.abs(q.vIn - p.vIn) < 1e-9);
          return { u: p.uIn, v: p.vIn, d: hit ? hit.depthIn : f.depthIn };
        }),
      );
    });
    const total = polys.reduce((sum, p) => sum + area(p), 0);
    let wrong = 0;
    for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) {
        // j is drawn after i, so j covers it. Wrong if j is really farther.
        const shared = clip(polys[j]!, polys[i]!);
        if (shared.length < 3) continue;
        const a = area(shared);
        if (a < 1e-6) continue;
        const cu = shared.reduce((sum, p) => sum + p.u, 0) / shared.length;
        const cv = shared.reduce((sum, p) => sum + p.v, 0) / shared.length;
        const later = depthAt(polys[j]!, cu, cv);
        const earlier = depthAt(polys[i]!, cu, cv);
        if (later !== null && earlier !== null && later > earlier + 1e-6) wrong += a;
      }
    }
    return (wrong / total) * 100;
  }

  it("the gable tile Tommy found it on is painted exactly right", () => {
    // 1'9 1/2" x 15 1/2" gable end, studs 15 5/8in and 19 7/8in. It scored
    // 10.05% before the member-by-member order: the plywood plate was
    // painting over the bottom of every stud but one.
    const tile = buildGablePanelMembers(21.5, 15.5, 17.1, 21.5, false);
    expect(overlappingMemberPairs(tile)).toEqual([]); // the geometry was never the problem
    expect(misPaintedPercent(tile)).toBeCloseTo(0, 6);
    expect(misPaintedPercent(tile, "legacy")).toBeGreaterThan(9); // and this is what he was looking at
  });

  it("a hairline everywhere else, and it is pinned", () => {
    /* Not zero, and the remainder is honest: a girt bar and the web resting
       on it genuinely interleave in projection — over part of the shared
       outline the bar is nearer and over the rest the web is — which no
       per-member order can settle without splitting faces. Measured
       2026-11-24: 2.11%, 1.88%, 3.66% and 3.24%, against 10.05%, 9.81%,
       9.11% and 9.22% under the old whole-drawing sort. */
    const cases: [string, PanelMember[], number][] = [
      ["gable 48", buildGablePanelMembers(48, 15.5, 96, 103, false), 2.5],
      ["standard 48, no nailer", buildStandardPanelMembers(48, 15.5, 120, false), 2.5],
      ["braced chevron 48", buildBracedPanelMembers(48, 15.5, 120, false, "chevron", false), 4],
      ["braced hatch 48", buildBracedPanelMembers(48, 15.5, 120, false, "hatch", false), 4],
    ];
    for (const [name, members, ceiling] of cases) {
      expect(misPaintedPercent(members), name).toBeLessThan(ceiling);
      // And every one of them is a large multiple better than it was.
      expect(misPaintedPercent(members, "legacy") / misPaintedPercent(members), `${name} improvement`).toBeGreaterThan(2.4);
    }
  });

  it("⚠ a panel whose MEMBERS overlap cannot be drawn right, and the score says so", () => {
    /* `standard + nailer` is the Review Log's own open item — on a panel wide
       enough for a centre nailer stud, the optional nailer is centred on the
       same line, so it is the same board asked for twice. Two boards in one
       volume have no correct draw order at all, so the stripe stays until the
       overlap goes: 6.33% here where the same panel without the nailer scores
       1.88%. Pinned so that fixing the panel visibly fixes the drawing. */
    const withNailer = buildStandardPanelMembers(48, 15.5, 120, true);
    expect(overlappingMemberPairs(withNailer)).toEqual(["stud_centre_1_exterior x nailer"]);
    expect(misPaintedPercent(withNailer)).toBeGreaterThan(3);
  });
});

describe("shading a colour", () => {
  it("darkens proportionally and stays a valid hex", () => {
    expect(shadeHex("#c9a876", 1)).toBe("#c9a876");
    expect(shadeHex("#ffffff", 0.5)).toBe("#808080");
    expect(shadeHex("#000000", 0.5)).toBe("#000000");
  });

  it("leaves anything that is not a plain 6-digit hex alone", () => {
    expect(shadeHex("rgb(1,2,3)", 0.5)).toBe("rgb(1,2,3)");
  });

  it("never emits a channel outside 00..ff", () => {
    for (const shade of [0, 0.3, 0.62, 1]) {
      expect(shadeHex("#c9a876", shade)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("picking which occurrence gets the badge", () => {
  /* ⚠ The sheet labels one occurrence per cut letter, and it must be the
     NEAREST one: a leader pointing at a member hidden behind another is worse
     than no leader. This lives here rather than in the component because the
     failure mode is invisible on screen — a badge is present either way, just
     attached to the wrong board, and the drawing looks fine. */
  const members = buildBracedPanelMembers(40, 15.5, 120, false, "chevron", false);
  const proj = projectPanelAxonometric(members);

  it("centroids carry a depth, so nearest is decidable at all", () => {
    expect(proj.centroids).toHaveLength(members.length);
    for (const c of proj.centroids) expect(Number.isFinite(c.depthIn)).toBe(true);
  });

  it("⚠ the two wythes really are at different depths — otherwise there is nothing to pick between", () => {
    // A braced panel builds each brace twice, once per wythe. If both came back
    // at the same depth, "nearest" would be a coin toss and this whole rule
    // would be decorative.
    const ext = members.findIndex((m) => m.memberId === "diagonal_brace_upper_ext");
    const int = members.findIndex((m) => m.memberId === "diagonal_brace_upper_int");
    expect(ext).toBeGreaterThanOrEqual(0);
    expect(int).toBeGreaterThanOrEqual(0);
    expect(Math.abs(proj.centroids[ext]!.depthIn - proj.centroids[int]!.depthIn)).toBeGreaterThan(1);
  });

  it("sorting nearest-first and keeping the FIRST of each letter keeps the near one", () => {
    // The shape of the component's own selection, asserted directly: a Map
    // built from [key, value] pairs would keep the LAST and silently select the
    // farthest instead.
    const byDepth = members
      .map((m, i) => ({ id: m.memberId, depth: proj.centroids[i]!.depthIn }))
      .sort((a, b) => a.depth - b.depth);
    const seen = new Set<string>();
    const kept = byDepth.filter((e) => {
      const key = e.id.replace(/_(ext|int)$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    for (const k of kept) {
      const siblings = byDepth.filter((e) => e.id.replace(/_(ext|int)$/, "") === k.id.replace(/_(ext|int)$/, ""));
      expect(k.depth).toBe(Math.min(...siblings.map((s) => s.depth)));
    }
  });
});
