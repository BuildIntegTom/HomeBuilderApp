import { buildBracedPanelMembers, buildStandardPanelMembers } from "@building-integrity/panel-catalog";
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

  it("⚠ sorts faces FARTHEST FIRST, which is the whole painter's algorithm", () => {
    // Out of order, near members draw behind far ones and the panel turns
    // inside out — a failure that still looks like a panel.
    for (let i = 1; i < proj.faces.length; i++) {
      expect(proj.faces[i - 1]!.depthIn).toBeGreaterThanOrEqual(proj.faces[i]!.depthIn);
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
