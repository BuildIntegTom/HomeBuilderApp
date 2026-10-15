import { describe, expect, it } from "vitest";
import type { PanelSlot } from "@building-integrity/geometry";
import { repanelizeConfirmation,
  repanelizeWallConfirmation, wallSignature, wallsThatWouldChange } from "./repanelize";

const std = (widthIn: number): PanelSlot => ({ type: "standard", widthIn });
const corner = (): PanelSlot => ({ type: "corner", widthIn: 25.5 });
const win = (widthIn: number, extra: Partial<PanelSlot> = {}): PanelSlot => ({ type: "window", widthIn, ...extra });

describe("wallSignature — what counts as 'this wall would change'", () => {
  it("is type and width, in order", () => {
    expect(wallSignature([corner(), std(40), corner()])).toBe("corner:25.5|standard:40|corner:25.5");
    expect(wallSignature([corner(), std(40), corner()])).not.toBe(wallSignature([corner(), std(38), corner()]));
    // Order matters: the same multiset in a different arrangement is a
    // different wall to look at.
    expect(wallSignature([std(40), std(24)])).not.toBe(wallSignature([std(24), std(40)]));
  });

  it("⚠ ignores what a re-tile carries through untouched, so it reports no false change", () => {
    // heightIn, sillHeightIn and anchorOffsetIn all survive a re-tile by
    // design. Counting them would tell the user a wall is about to change
    // when they would see nothing happen — and a warning that cries wolf is
    // how the one that matters gets clicked through.
    expect(wallSignature([win(48, { heightIn: 60, sillHeightIn: 36, anchorOffsetIn: 137.25 })])).toBe(
      wallSignature([win(48)]),
    );
  });

  it("does NOT ignore a secondary type, which is a visibly different part", () => {
    const gap: PanelSlot = { type: "safety-gap", widthIn: 0.75 };
    const absorbed: PanelSlot = { type: "safety-gap", widthIn: 0.75, secondaryType: "braced" };
    expect(wallSignature([gap])).not.toBe(wallSignature([absorbed]));
  });
});

describe("wallsThatWouldChange", () => {
  it("names only the walls that differ, sorted", () => {
    const current = { AB: [std(40)], BC: [std(40)], CD: [std(40)] };
    const next = { AB: [std(40)], BC: [std(38)], CD: [std(24), std(16)] };
    expect(wallsThatWouldChange(current, next)).toEqual(["BC", "CD"]);
  });

  it("reports nothing when every wall already matches", () => {
    const current = { AB: [corner(), std(40)], BC: [std(24)] };
    const next = { AB: [corner(), std(40)], BC: [std(24)] };
    expect(wallsThatWouldChange(current, next)).toEqual([]);
  });

  it("counts a wall that appears or disappears", () => {
    expect(wallsThatWouldChange({ AB: [std(40)] }, {})).toEqual(["AB"]);
    expect(wallsThatWouldChange({}, { AB: [std(40)] })).toEqual(["AB"]);
  });
});

describe("⚠ the confirmation tells the truth, including when there is nothing to lose", () => {
  it("says so plainly when NOTHING would change", () => {
    // The case the generic "this will retile over any hand edits" warning
    // gets wrong. It is a lie here, and a lie the user can catch, which
    // costs the warning its credibility everywhere else.
    const text = repanelizeConfirmation({ changedWallIds: [], totalWalls: 4 });
    expect(text).toContain("Nothing would change");
    expect(text).toContain("all 4 walls");
    expect(text).not.toContain("will be replaced");
  });

  it("names the real count when some walls would change", () => {
    const text = repanelizeConfirmation({ changedWallIds: ["BC", "CD"], totalWalls: 8 });
    expect(text).toContain("2 of 8 walls");
    expect(text).toContain("will be replaced");
  });

  it("says 'all' rather than 'N of N' when every wall would change", () => {
    expect(repanelizeConfirmation({ changedWallIds: ["A", "B", "C"], totalWalls: 3 })).toContain("all 3 walls");
  });

  it("gets the singular right, because '1 walls' reads as a bug in the app", () => {
    const one = repanelizeConfirmation({ changedWallIds: ["AB"], totalWalls: 4 });
    expect(one).toContain("1 of 4 wall");
    expect(one).not.toContain("1 of 4 walls");
    expect(one).toContain("that wall");
    // Subject-verb agreement too — this caught a real "all 1 wall already match".
    expect(repanelizeConfirmation({ changedWallIds: [], totalWalls: 1 })).toContain("all 1 wall already matches");
    expect(repanelizeConfirmation({ changedWallIds: [], totalWalls: 4 })).toContain("all 4 walls already match");
  });

  it("⚠ warns that openings may MOVE, since that is now accepted behaviour", () => {
    // Decided 2026-10-10: a re-tile may drift an opening (measured up to
    // 19in) but may never resize one. Finding that out by noticing a window
    // has shifted is the surprise this feature exists to prevent.
    const text = repanelizeConfirmation({ changedWallIds: ["AB"], totalWalls: 2 });
    expect(text).toContain("keep their sizes");
    expect(text).toContain("shift position");
  });
});

describe("repanelizeWallConfirmation — one wall at a time", () => {
  it("⚠ does NOT warn about losing work on a wall that already matches", () => {
    // The same rule the building-wide sentence follows. On the single wall the
    // user is looking at, a false "your edits will be replaced" is the fastest
    // possible way to teach them this dialog lies.
    const text = repanelizeWallConfirmation("AB", false);
    expect(text).toContain("Nothing would change");
    expect(text).toContain("wall AB");
    expect(text).not.toContain("will be replaced");
  });

  it("names the wall, and states what it will NOT touch", () => {
    // "and no other wall" is the entire reason to reach for this instead of
    // Repanelize, so the guarantee has to be stated or it cannot be relied on.
    const text = repanelizeWallConfirmation("CD", true);
    expect(text).toContain("wall CD");
    expect(text).toContain("no other wall");
    expect(text).toContain("will be replaced");
  });

  it("carries the openings warning, exactly as the building-wide one does", () => {
    // A re-tile may MOVE an opening though it may never resize one (measured
    // up to 19in). That surprise is no smaller for being confined to one wall.
    const text = repanelizeWallConfirmation("AB", true);
    expect(text).toContain("keep their sizes");
    expect(text).toContain("may shift position");
  });

  it("says nothing about other walls when there is nothing to lose", () => {
    // No "no other wall" promise on the no-op path: there is no action to
    // scope, and a guarantee about an operation that does nothing is noise.
    expect(repanelizeWallConfirmation("AB", false)).not.toContain("no other wall");
  });
});
