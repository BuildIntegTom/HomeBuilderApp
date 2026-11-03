import { describe, expect, it } from "vitest";
import { getOpeningAnchors, retileWithOpenings } from "./tiling";
import { reconcileBracedPlacement } from "./bracedPlacement";
import { panelTypeChangeNeedsRetile, transitionPanelType, type PanelTypeTransitionWall, type PanelTypeTransitionWidths } from "./panelTypeTransition";
import type { PanelSlot } from "./types";

/** His 43ft 9in test wall, as the tiler builds it: 525in, corners at both
 *  ends, gap at the end. */
const WALL: PanelTypeTransitionWall = {
  lengthIn: 525,
  standardWidthIn: 48,
  cornerWidthIn: 15.5,
  gapEnd: "end",
  hasCornerStart: true,
  hasCornerEnd: true,
  allowBorrow: true,
  cornerMayWiden: true,
  markSafetyCornerAtGapEnd: false,
};

/** The catalog's own defaults, as `page.tsx` reads them. */
const WIDTHS: PanelTypeTransitionWidths = {
  columnWidthIn: 25.5,
  windowWidthIn: 48,
  doorWidthIn: 36,
  bigHeaderWidthIn: 96,
  bigHeaderHeightIn: 24,
};

const tile = (anchors: Parameters<typeof retileWithOpenings>[6] = []) =>
  retileWithOpenings(
    WALL.lengthIn,
    WALL.standardWidthIn,
    WALL.cornerWidthIn,
    WALL.gapEnd,
    WALL.hasCornerStart,
    WALL.hasCornerEnd,
    anchors,
    WALL.allowBorrow,
    WALL.cornerMayWiden,
  ).slots;

const sumEighths = (slots: readonly PanelSlot[]) => slots.reduce((a, s) => a + Math.round(s.widthIn * 8), 0);
const shape = (slots: readonly PanelSlot[]) => slots.map((s) => `${s.type}@${s.widthIn}`);
const only = (slots: readonly PanelSlot[], type: string) => slots.filter((s) => s.type === type);

describe("panelTypeChangeNeedsRetile", () => {
  it("is true exactly when a width moves", () => {
    // Standard-family to standard-family: a field change, nothing moves.
    expect(panelTypeChangeNeedsRetile("standard", "braced")).toBe(false);
    expect(panelTypeChangeNeedsRetile("braced", "standard")).toBe(false);
    // Any reservation on either side moves width.
    for (const t of ["window", "door", "column", "big-header"] as const) {
      expect(panelTypeChangeNeedsRetile("standard", t), `standard->${t}`).toBe(true);
      expect(panelTypeChangeNeedsRetile(t, "standard"), `${t}->standard`).toBe(true);
    }
    // ⚠ Becoming a void never moves width — it keeps the panel's own.
    expect(panelTypeChangeNeedsRetile("standard", "open")).toBe(false);
    expect(panelTypeChangeNeedsRetile("big-header", "open")).toBe(false);
    // Coming out of one does.
    expect(panelTypeChangeNeedsRetile("open", "standard")).toBe(true);
    expect(panelTypeChangeNeedsRetile("open", "window")).toBe(true);
  });
});

describe("transitionPanelType", () => {
  it("returns null when there is nothing to do", () => {
    const slots = tile();
    expect(transitionPanelType(slots, 1, { type: slots[1]!.type }, WALL, WIDTHS)).toBeNull();
    expect(transitionPanelType(slots, 99, { type: "window" }, WALL, WIDTHS)).toBeNull();
  });

  it("⚠ never loses an eighth of the wall, for every transition in both directions", () => {
    /* The dimensional-tightness rule, swept rather than spot-checked: this is
       the one edit that re-tiles a whole wall to change one label, so every
       pair has to come back summing to 525in exactly. */
    const base = tile();
    const target = 2; // a plain standard panel mid-run
    for (const to of ["window", "door", "column", "big-header", "braced", "open"] as const) {
      const out = transitionPanelType(base, target, { type: to }, WALL, WIDTHS);
      if (to === "open") {
        // Not this function's job — see panelTypeChangeNeedsRetile.
        expect(panelTypeChangeNeedsRetile("standard", to)).toBe(false);
        continue;
      }
      expect(out, `standard->${to}`).not.toBeNull();
      expect(sumEighths(out!.slots), `standard->${to} sum`).toBe(525 * 8);
      expect(out!.slotIndex, `standard->${to} found`).not.toBe(-1);
      expect(out!.slots[out!.slotIndex]!.type, `standard->${to} landed type`).toBe(to);

      // ...and straight back again.
      const back = transitionPanelType(out!.slots, out!.slotIndex, { type: "standard" }, WALL, WIDTHS);
      expect(back, `${to}->standard`).not.toBeNull();
      expect(sumEighths(back!.slots), `${to}->standard sum`).toBe(525 * 8);
      expect(back!.slots[back!.slotIndex]!.type, `${to}->standard landed type`).toBe("standard");
    }
  });

  it("⚠ a big header asked to become a door comes back a DOOR, at a buildable width", () => {
    /* The measured B19 defect, in one test. On his 43'9" wall a Big Header
       asked for Door stayed a big header: the anchor inherited the header's
       96in, a 96in door header failed the single-peak angle rule, and the
       auto-upgrade put it straight back. The panel count fell by one on the
       way through, so the slot looked lost. (That upgrade has since been
       deleted outright — headers take as many peaks as they need — but a door
       inheriting a big header's width was wrong on its own.) */
    const withHeader = transitionPanelType(tile(), 2, { type: "big-header" }, WALL, WIDTHS)!;
    expect(withHeader.slots[withHeader.slotIndex]!.widthIn).toBe(96);

    const asDoor = transitionPanelType(withHeader.slots, withHeader.slotIndex, { type: "door" }, WALL, WIDTHS)!;
    const landed = asDoor.slots[asDoor.slotIndex]!;
    expect(landed.type).toBe("door");
    /* ⚠ NOT 96. A door replacing another reservation takes its own default,
       because the 96in belonged to the big header — see `doorDefaultWidthIn`. */
    expect(landed.widthIn).toBe(36);
    expect(only(asDoor.slots, "big-header")).toHaveLength(0);
    expect(only(asDoor.slots, "door")).toHaveLength(1);
    expect(sumEighths(asDoor.slots)).toBe(525 * 8);
  });

  it("a door replacing a STANDARD panel still keeps that panel's width", () => {
    /* Tommy: "A door keeps the slot's width: its own widths come from a door
       schedule, not from this module." That rule is about replacing a panel of
       the tiler's own run, and it is untouched. */
    const base = tile();
    const standardWidth = base[2]!.widthIn;
    const out = transitionPanelType(base, 2, { type: "door" }, WALL, WIDTHS)!;
    expect(out.slots[out.slotIndex]!.type).toBe("door");
    expect(out.slots[out.slotIndex]!.widthIn).toBe(standardWidth);
  });

  it("⚠ a big header asked to become a STANDARD panel actually changes the wall", () => {
    /* The other half of the measured defect: Big Header -> Standard silently
       did nothing. Freeing 96in has to put real panels back on the run. */
    const withHeader = transitionPanelType(tile(), 2, { type: "big-header" }, WALL, WIDTHS)!;
    const back = transitionPanelType(withHeader.slots, withHeader.slotIndex, { type: "standard" }, WALL, WIDTHS)!;
    expect(only(back.slots, "big-header")).toHaveLength(0);
    expect(only(back.slots, "standard").length).toBeGreaterThan(only(withHeader.slots, "standard").length);
    expect(shape(back.slots)).toEqual(shape(tile()));
  });

  it("a fresh window takes the 4ft module, a fresh column its fabricated width", () => {
    const window = transitionPanelType(tile(), 2, { type: "window" }, WALL, WIDTHS)!;
    expect(window.slots[window.slotIndex]!.widthIn).toBe(48);
    const column = transitionPanelType(tile(), 2, { type: "column" }, WALL, WIDTHS)!;
    expect(column.slots[column.slotIndex]!.widthIn).toBe(25.5);
    const header = transitionPanelType(tile(), 2, { type: "big-header" }, WALL, WIDTHS)!;
    expect(header.slots[header.slotIndex]!.widthIn).toBe(96);
    expect(header.slots[header.slotIndex]!.heightIn).toBe(24);
  });

  it("⚠ records where the user put a fresh reservation, and never re-measures an old one", () => {
    const first = transitionPanelType(tile(), 2, { type: "window" }, WALL, WIDTHS)!;
    const recorded = first.slots[first.slotIndex]!.anchorOffsetIn;
    expect(recorded).toBeGreaterThan(0);
    // A second, unrelated change elsewhere must leave that intent untouched.
    const second = transitionPanelType(first.slots, 5, { type: "door" }, WALL, WIDTHS)!;
    const windowAfter = only(second.slots, "window")[0]!;
    expect(windowAfter.anchorOffsetIn).toBe(recorded);
  });

  it("⚠ keeps every OTHER reservation's own height, sill and width across the retile", () => {
    let slots = transitionPanelType(tile(), 2, { type: "window" }, WALL, WIDTHS)!.slots;
    slots = slots.map((s) => (s.type === "window" ? { ...s, heightIn: 61, sillHeightIn: 33, widthIn: 60 } : s));
    // Re-tile driven by a change to a DIFFERENT slot.
    const out = transitionPanelType(slots, slots.length - 3, { type: "door" }, WALL, WIDTHS)!;
    const window = only(out.slots, "window")[0]!;
    expect(window.heightIn).toBe(61);
    expect(window.sillHeightIn).toBe(33);
    expect(window.widthIn).toBe(60);
  });

  it("⚠ carries a braced panel elsewhere on the wall through the retile", () => {
    /* Index 5, not 4 — the 24ft rule puts a second safety gap at 4 on this
       525in run. `tile()`'s own shape: corner, 3 standards, gap, 6 standards,
       2 narrow standards, gap, standard, corner. */
    const base = tile().map((s, i) => (i === 5 && s.type === "standard" ? { ...s, type: "braced" as const, bracedPattern: "hatch" as const } : s));
    expect(only(base, "braced")).toHaveLength(1);
    const out = transitionPanelType(base, 2, { type: "window" }, WALL, WIDTHS)!;
    const braced = only(out.slots, "braced");
    expect(braced).toHaveLength(1);
    expect(braced[0]!.bracedPattern).toBe("hatch");
  });

  it("⚠ an explicit Braced target wins over whatever was carried onto that position", () => {
    const base = tile();
    const out = transitionPanelType(base, 2, { type: "braced", bracedPattern: "chevron", bracedMirrored: true }, WALL, WIDTHS);
    // standard -> braced moves no width, so this is not even this function's
    // job; assert that contract rather than a retiled result.
    expect(panelTypeChangeNeedsRetile("standard", "braced")).toBe(false);
    expect(out!.slots[out!.slotIndex]!.type).toBe("braced");
    expect(out!.slots[out!.slotIndex]!.bracedPattern).toBe("chevron");
  });

  it("⚠ a window asked to become braced does not keep the window's reservation width", () => {
    const window = transitionPanelType(tile(), 2, { type: "window" }, WALL, WIDTHS)!;
    const braced = transitionPanelType(window.slots, window.slotIndex, { type: "braced", bracedPattern: "chevron" }, WALL, WIDTHS)!;
    const landed = braced.slots[braced.slotIndex]!;
    expect(landed.type).toBe("braced");
    expect(landed.bracedPattern).toBe("chevron");
    expect(landed.widthIn).toBeLessThanOrEqual(WALL.standardWidthIn);
    expect(sumEighths(braced.slots)).toBe(525 * 8);
  });

  it("⚠ a void comes back OUT without the wall losing its length", () => {
    /* `open` goes IN through setPanelSlotType (no width moves). Coming back out
       is this function's job, and the void's width has to be absorbed by the
       run rather than left stranded. */
    const emptied = tile().map((s, i) => (i === 2 ? { ...s, type: "open" as const } : s));
    const out = transitionPanelType(emptied, 2, { type: "window" }, WALL, WIDTHS)!;
    expect(only(out.slots, "open")).toHaveLength(0);
    expect(out.slots[out.slotIndex]!.type).toBe("window");
    expect(out.slots[out.slotIndex]!.widthIn).toBe(48);
    expect(sumEighths(out.slots)).toBe(525 * 8);
  });
});

describe("reconcileBracedPlacement knows a big header is a reservation", () => {
  /* ⚠ The misalignment only shows when the reservation is BRAND NEW at its
     position, which is exactly what a type change does. A reservation that sat
     at the same place in both arrays is consumed out of the map either way, so
     a test built from a wall that already had the big header passes with the
     bug still in — the first version of this test did, and proved nothing. */
  const oldWall: PanelSlot[] = [
    { type: "corner", widthIn: 15.5 },
    { type: "standard", widthIn: 48 },
    { type: "standard", widthIn: 48 },
    { type: "braced", widthIn: 48, bracedPattern: "hatch" },
    { type: "standard", widthIn: 48 },
    { type: "corner", widthIn: 15.5 },
  ];
  /** The same wall as the tiler would rebuild it with a reservation newly
   *  occupying index 2 — the position the old wall's SECOND standard held. */
  const freshWith = (type: "big-header" | "open" | "window"): PanelSlot[] => [
    { type: "corner", widthIn: 15.5 },
    { type: "standard", widthIn: 48 },
    { type, widthIn: 48 },
    { type: "standard", widthIn: 48 },
    { type: "standard", widthIn: 48 },
    { type: "corner", widthIn: 15.5 },
  ];

  it("⚠ carries the braced panel onto the right slot after a NEW big header", () => {
    /* The old wall's braced panel was the third standard-family member. The new
       big header consumed the second, so the braced marker belongs on index 3.
       The bug put it on index 4 — one panel too far along, every time, on every
       retile of any wall with a big header on it. */
    const out = reconcileBracedPlacement(oldWall, freshWith("big-header"));
    expect(out.map((s) => s.type)).toEqual(["corner", "standard", "big-header", "braced", "standard", "corner"]);
    expect(out[3]!.bracedPattern).toBe("hatch");
  });

  it("⚠ and after a new VOID, which nothing treated as a reservation at all", () => {
    const out = reconcileBracedPlacement(oldWall, freshWith("open"));
    expect(out.map((s) => s.type)).toEqual(["corner", "standard", "open", "braced", "standard", "corner"]);
    expect(out[3]!.bracedPattern).toBe("hatch");
  });

  it("matches what a window — which was never broken — already did", () => {
    const out = reconcileBracedPlacement(oldWall, freshWith("window"));
    expect(out.map((s) => s.type)).toEqual(["corner", "standard", "window", "braced", "standard", "corner"]);
  });
});

describe("a void is a reservation", () => {
  it("⚠ survives a retile driven by something else on the wall", () => {
    /* Stride 1 shipped `open` as a slot type but not as a reservation, so the
       first retile of its wall — a window resize, a wall-length edit, another
       type change — handed the void's width back to the tiler and the void
       vanished. This is the regression that fix is here to stop. */
    const emptied = tile().map((s, i) => (i === 2 ? { ...s, type: "open" as const } : s));
    const voidWidth = emptied[2]!.widthIn;
    const out = transitionPanelType(emptied, 6, { type: "window" }, WALL, WIDTHS)!;
    const voids = only(out.slots, "open");
    expect(voids).toHaveLength(1);
    expect(voids[0]!.widthIn).toBe(voidWidth);
    expect(sumEighths(out.slots)).toBe(525 * 8);
  });

  it("is read as an anchor by getOpeningAnchors", () => {
    const emptied = tile().map((s, i) => (i === 2 ? { ...s, type: "open" as const } : s));
    expect(getOpeningAnchors(emptied).map((a) => a.type)).toEqual(["open"]);
  });
});

describe("a fresh big header carries the rest of the wall correctly", () => {
  it("⚠ leaves a braced panel further along the wall exactly where it was", () => {
    /* The same misalignment, reached the way the app reaches it. */
    const base = tile().map((s, i) => (i === 5 ? { ...s, type: "braced" as const, bracedPattern: "hatch" as const } : s));
    const bracedWidthBefore = base[5]!.widthIn;
    const out = transitionPanelType(base, 13, { type: "big-header" }, WALL, WIDTHS)!;
    const braced = only(out.slots, "braced");
    expect(braced).toHaveLength(1);
    expect(braced[0]!.bracedPattern).toBe("hatch");
    /* Index 5 is before the change, so it must not have moved along the wall
       at all — only its width may have been re-budgeted. */
    expect(out.slots[5]!.type).toBe("braced");
    expect(bracedWidthBefore).toBeGreaterThan(0);
    expect(sumEighths(out.slots)).toBe(525 * 8);
  });
});
