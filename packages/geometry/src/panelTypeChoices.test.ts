import { describe, expect, it } from "vitest";
import { PANEL_TYPE_MENU_ORDER, panelTypeChoices, setPanelSlotType } from "./panelTypeChoices";
import type { PanelSlot } from "./types";

/** A plain tiled wall: corner, standard, gap, standard, standard, corner. */
const wall = (): PanelSlot[] => [
  { type: "corner", widthIn: 15.5 },
  { type: "standard", widthIn: 48 },
  { type: "safety-gap", widthIn: 0.75 },
  { type: "standard", widthIn: 48 },
  { type: "standard", widthIn: 44 },
  { type: "corner", widthIn: 15.5 },
];

const choice = (slots: PanelSlot[], i: number, type: string) => panelTypeChoices(slots, i).find((c) => c.type === type)!;

describe("panelTypeChoices", () => {
  it("⚠ lists EVERY type for every slot, always in the same order", () => {
    /* His choice when asked whether to hide the impossible ones: show all,
       grey out, give a reason. That only pays off if the list never changes
       shape — the menu has to read the same under every right click, or
       muscle memory never builds. */
    for (const i of [0, 1, 2, 3, 5]) {
      expect(panelTypeChoices(wall(), i).map((c) => c.type), `slot ${i}`).toEqual([...PANEL_TYPE_MENU_ORDER]);
    }
  });

  it("marks the type the slot already is, and leaves it allowed", () => {
    const standard = panelTypeChoices(wall(), 1);
    expect(standard.filter((c) => c.current).map((c) => c.type)).toEqual(["standard"]);
    expect(choice(wall(), 1, "standard").allowed).toBe(true);
    // A corner is told it IS a corner rather than told it may not be one.
    const corner = panelTypeChoices(wall(), 0);
    expect(corner.find((c) => c.current)!.type).toBe("corner");
    expect(choice(wall(), 0, "corner").allowed).toBe(true);
  });

  it("⚠ refuses a corner mid-run, and refuses one at the end too — for different reasons", () => {
    /* Mid-run it is geometric nonsense; at an end it is still not the user's
       to place, because corner ownership is resolved from which wall is
       longer through the joint. Two refusals, two different sentences, so the
       tooltip tells the truth in both places. */
    const mid = choice(wall(), 3, "corner");
    expect(mid.allowed).toBe(false);
    expect(mid.reason).toMatch(/end of a wall/);

    const end = choice(wall(), 5, "safety-oct-corner");
    expect(end.allowed).toBe(false);
    expect(end.reason).toMatch(/tiler/);
  });

  it("⚠ refuses a second safety gap on a run that already has one", () => {
    const withGap = choice(wall(), 1, "safety-gap");
    expect(withGap.allowed).toBe(false);
    expect(withGap.reason).toMatch(/already has its safety gap/);

    // And on a run with none, it is still the tiler's to place, not a hand edit.
    const noGap: PanelSlot[] = [
      { type: "corner", widthIn: 15.5 },
      { type: "standard", widthIn: 48 },
      { type: "corner", widthIn: 15.5 },
    ];
    expect(choice(noGap, 1, "safety-gap").allowed).toBe(false);
  });

  it("⚠ will not retype a rule-placed slot, but WILL let you empty it", () => {
    /* The safety gap is slot 2. Turning it into a window would have the tiler
       put the gap back on the next retile and the wall would carry both. */
    expect(choice(wall(), 2, "window").allowed).toBe(false);
    expect(choice(wall(), 2, "window").reason).toMatch(/empty it first/);
    // Emptying is always on the table — it is the menu's "delete / no panel".
    expect(choice(wall(), 2, "open").allowed).toBe(true);
    expect(choice(wall(), 0, "open").allowed).toBe(true);
  });

  it("lets an ordinary panel become any placeable type", () => {
    for (const type of ["standard", "braced", "window", "door", "column", "big-header"]) {
      expect(choice(wall(), 1, type).allowed, type).toBe(true);
    }
  });

  it("⚠ lets an emptied slot be filled again", () => {
    /* Otherwise "delete / no panel" would be a one-way door, and the only way
       back would be a retile that discards every other hand edit on the wall. */
    const emptied = setPanelSlotType(wall(), 1, "open");
    expect(emptied[1]!.type).toBe("open");
    for (const type of ["standard", "braced", "window", "door"]) {
      expect(choice(emptied, 1, type).allowed, type).toBe(true);
    }
  });

  it("returns nothing at all for a slot index that is not there", () => {
    expect(panelTypeChoices(wall(), 99)).toEqual([]);
    expect(panelTypeChoices([], 0)).toEqual([]);
  });
});

describe("setPanelSlotType", () => {
  const sumEighths = (slots: readonly PanelSlot[]) => slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0);

  it("⚠ never moves a single eighth of the wall", () => {
    /* The contract. Every other wall edit redistributes; this one changes a
       label and nothing else, so the run sums to the wall by identity rather
       than by arithmetic. */
    const before = wall();
    for (const type of ["braced", "window", "door", "column", "big-header", "open"] as const) {
      const after = setPanelSlotType(before, 3, type);
      expect(sumEighths(after), type).toBe(sumEighths(before));
      expect(after.length, type).toBe(before.length);
      expect(after[3]!.widthIn, type).toBe(before[3]!.widthIn);
      expect(after[3]!.type, type).toBe(type);
    }
  });

  it("touches no other slot", () => {
    const before = wall();
    const after = setPanelSlotType(before, 3, "window");
    for (let i = 0; i < before.length; i++) {
      if (i === 3) continue;
      expect(after[i], `slot ${i}`).toEqual(before[i]);
    }
  });

  it("⚠ drops a stale braced style when the slot stops being braced", () => {
    /* `resolveBracedStyle`'s "absent = default" fallback makes an ABSENT
       pattern safe. A stale one is not: it would be handed to whatever reads
       the slot next, describing a figure the panel no longer carries. */
    const braced: PanelSlot[] = [{ type: "braced", widthIn: 48, bracedPattern: "hatch", bracedMirrored: true }];
    const plain = setPanelSlotType(braced, 0, "standard");
    expect(plain[0]!.bracedPattern).toBeUndefined();
    expect(plain[0]!.bracedMirrored).toBeUndefined();
    expect(plain[0]!.widthIn).toBe(48);
  });

  it("keeps the wall pattern's own fields, because they are re-derived anyway", () => {
    /* `bracePairPattern`/`bracePairHalf`/`braceFigure` are written by
       `applyDrawTimeBracing` on every render from the wall's current slots, so
       stripping them here would change nothing and would read as if they were
       the panel's own. */
    const patterned: PanelSlot[] = [
      { type: "standard", widthIn: 48, bracePairPattern: "superbrace", bracePairHalf: "left", braceFigure: "super-carrot" },
    ];
    const asWindow = setPanelSlotType(patterned, 0, "window");
    expect(asWindow[0]!.bracePairPattern).toBe("superbrace");
    expect(asWindow[0]!.braceFigure).toBe("super-carrot");
  });

  it("is a true no-op when the type is already what was asked for", () => {
    /* Reference equality: a menu click that changes nothing must not push an
       undo entry or re-render the world. */
    const before = wall();
    expect(setPanelSlotType(before, 1, "standard")).toBe(before);
    expect(setPanelSlotType(before, 99, "window")).toBe(before);
  });
});
