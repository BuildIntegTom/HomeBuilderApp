import { describe, expect, it } from "vitest";
import { resolveSlotIndexEntry } from "./slotIndexEntry";

describe("resolveSlotIndexEntry", () => {
  it("reads a plain whole number", () => {
    expect(resolveSlotIndexEntry("0")).toBe(0);
    expect(resolveSlotIndexEntry("4")).toBe(4);
    expect(resolveSlotIndexEntry(" 12 ")).toBe(12);
  });

  it("returns null for an EMPTY field rather than 0 — the whole point", () => {
    // `Number("") === 0` is what moved a spanning header to the first panel
    // on the wall the moment its field was cleared to be retyped. Slot 0 is a
    // legal index, so nothing refused it; nothing could.
    expect(resolveSlotIndexEntry("")).toBeNull();
    expect(resolveSlotIndexEntry("   ")).toBeNull();
  });

  it("returns null for anything that is not a whole panel", () => {
    expect(resolveSlotIndexEntry("2.5")).toBeNull();
    expect(resolveSlotIndexEntry("-1")).toBeNull();
    expect(resolveSlotIndexEntry("1e3")).toBeNull();
    expect(resolveSlotIndexEntry("two")).toBeNull();
    expect(resolveSlotIndexEntry("3px")).toBeNull();
  });

  it("never substitutes a plausible value for an unreadable one", () => {
    // A silent substitution is the same failure class as silent rounding —
    // the caller commits nothing on null and leaves the stored index alone.
    for (const text of ["", "-", "+", ".", "1/2", "NaN", "Infinity"]) {
      expect(resolveSlotIndexEntry(text)).toBeNull();
    }
  });
});
