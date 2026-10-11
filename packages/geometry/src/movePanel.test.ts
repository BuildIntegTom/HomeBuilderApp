import { describe, expect, it } from "vitest";
import { canMovePanel, dropIndexForOffset, movableRange, movePanelWithinWall } from "./movePanel";
import { tileWall } from "./tiling";
import type { PanelSlot } from "./types";

const corner = (w = 25.5): PanelSlot => ({ type: "corner", widthIn: w });
const std = (w: number): PanelSlot => ({ type: "standard", widthIn: w });
const gap = (): PanelSlot => ({ type: "safety-gap", widthIn: 0.75 });
const win = (w: number): PanelSlot => ({ type: "window", widthIn: w });

const shape = (slots: readonly PanelSlot[]) => slots.map((s) => `${s.type}:${s.widthIn}`).join("|");
const sumEighths = (slots: readonly PanelSlot[]) => slots.reduce((n, s) => n + Math.round(s.widthIn * 8), 0);

describe("what can move", () => {
  const wall = [corner(), std(40), gap(), std(32), win(48), std(24), corner()];

  it("the movable range is everything between the corner panels", () => {
    expect(movableRange(wall)).toEqual({ first: 1, last: 5 });
  });

  it("a corner cannot be picked up — its position IS its geometry", () => {
    expect(canMovePanel(wall, 0)).toBe(false);
    expect(canMovePanel(wall, 6)).toBe(false);
    expect(movePanelWithinWall(wall, 0, 3)).toBeNull();
    expect(movePanelWithinWall(wall, 6, 3)).toBeNull();
  });

  it("⚠ the safety gap CAN be picked up — Tommy's 'gap free, corners stuck'", () => {
    expect(canMovePanel(wall, 2)).toBe(true);
    expect(movePanelWithinWall(wall, 2, 5)).not.toBeNull();
  });

  it("a wall with no corners is movable end to end", () => {
    const open = [std(40), std(32), std(24)];
    expect(movableRange(open)).toEqual({ first: 0, last: 2 });
  });

  it("a wall that is nothing but corners has nothing to move", () => {
    expect(movableRange([corner(100)])).toBeNull();
    expect(canMovePanel([corner(100)], 0)).toBe(false);
  });
});

describe("the move itself", () => {
  const wall = [corner(), std(40), gap(), std(32), win(48), std(24), corner()];

  it("slides everything between, which is 'switching places with each panel it passes'", () => {
    // Take the 40in standard at 1 and drop it at 4.
    expect(shape(movePanelWithinWall(wall, 1, 4)!)).toBe(
      "corner:25.5|safety-gap:0.75|standard:32|window:48|standard:40|standard:24|corner:25.5",
    );
    // ...and back the other way.
    expect(shape(movePanelWithinWall(wall, 5, 1)!)).toBe(
      "corner:25.5|standard:24|standard:40|safety-gap:0.75|standard:32|window:48|corner:25.5",
    );
  });

  it("⚠ CONSERVES THE WALL BY CONSTRUCTION — same multiset, same exact total", () => {
    // The point of the whole operation. Not asserted once but over every
    // legal from/to pair on a real tiled wall, because "a permutation cannot
    // change a sum" is the claim and this is what makes it a measurement.
    const real = tileWall(360, 40, 25.5, "end", true, true).slots;
    const range = movableRange(real)!;
    let moves = 0;
    for (let from = range.first; from <= range.last; from++) {
      for (let to = range.first; to <= range.last; to++) {
        const moved = movePanelWithinWall(real, from, to);
        if (!moved) continue;
        moves++;
        expect(moved.length).toBe(real.length);
        expect(sumEighths(moved)).toBe(sumEighths(real));
        expect([...moved].map((s) => s.widthIn).sort((a, b) => a - b)).toEqual(
          [...real].map((s) => s.widthIn).sort((a, b) => a - b),
        );
      }
    }
    expect(moves).toBeGreaterThan(20);
  });

  it("never moves a corner panel off its end", () => {
    const real = tileWall(360, 40, 25.5, "end", true, true).slots;
    const range = movableRange(real)!;
    for (let from = range.first; from <= range.last; from++) {
      for (const to of [-50, 0, range.last + 50, real.length + 9]) {
        const moved = movePanelWithinWall(real, from, to);
        if (!moved) continue;
        expect(moved[0]!.type).toBe(real[0]!.type);
        expect(moved[moved.length - 1]!.type).toBe(real[real.length - 1]!.type);
      }
    }
  });

  it("clamps an overshoot instead of refusing the whole gesture", () => {
    // Dragging hard at a corner means "as far as it goes".
    expect(shape(movePanelWithinWall(wall, 1, 999)!)).toBe(
      "corner:25.5|safety-gap:0.75|standard:32|window:48|standard:24|standard:40|corner:25.5",
    );
    expect(shape(movePanelWithinWall(wall, 5, -999)!)).toBe(
      "corner:25.5|standard:24|standard:40|safety-gap:0.75|standard:32|window:48|corner:25.5",
    );
  });

  it("returns null for a no-op, so a caller can skip a pointless re-render", () => {
    expect(movePanelWithinWall(wall, 3, 3)).toBeNull();
    expect(movePanelWithinWall(wall, 1, 0)).toBeNull(); // clamps to 1, which is where it already is
  });

  it("is reversible — moving back restores the wall exactly", () => {
    const moved = movePanelWithinWall(wall, 1, 5)!;
    expect(shape(movePanelWithinWall(moved, 5, 1)!)).toBe(shape(wall));
  });
});

describe("where the cursor drops it", () => {
  // Widths chosen to be unequal, because the whole point is that this is
  // measured in inches rather than in slots.
  const wall = [corner(), std(40), std(24), std(48), corner()];

  it("⚠ steps by INCHES, not by slot count, so wide and narrow panels drag alike", () => {
    // With slot 1 (40in) in the air the others sit: corner 0-25.5,
    // 24in 25.5-49.5, 48in 49.5-97.5, corner 97.5-123.
    expect(dropIndexForOffset(wall, 1, 0)).toBe(1); // clamped off the corner
    expect(dropIndexForOffset(wall, 1, 30)).toBe(1); // not yet past the 24in's middle
    expect(dropIndexForOffset(wall, 1, 40)).toBe(2); // past it
    expect(dropIndexForOffset(wall, 1, 80)).toBe(3); // past the 48in's middle
    expect(dropIndexForOffset(wall, 1, 10_000)).toBe(3); // clamped at the far corner
  });

  it("refuses to compute a drop for something that cannot be picked up", () => {
    expect(dropIndexForOffset(wall, 0, 60)).toBeNull();
    expect(dropIndexForOffset(wall, 4, 60)).toBeNull();
  });

  it("a drop index always survives the move it describes", () => {
    const real = tileWall(420, 40, 25.5, "end", true, true).slots;
    const range = movableRange(real)!;
    const total = real.reduce((n, s) => n + s.widthIn, 0);
    for (let from = range.first; from <= range.last; from++) {
      for (let offsetIn = 0; offsetIn <= total; offsetIn += 7.5) {
        const to = dropIndexForOffset(real, from, offsetIn);
        expect(to).not.toBeNull();
        const moved = movePanelWithinWall(real, from, to!);
        // Null only when it is already there; otherwise it must conserve.
        if (moved) expect(sumEighths(moved)).toBe(sumEighths(real));
      }
    }
  });
});
