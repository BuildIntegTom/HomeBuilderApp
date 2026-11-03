import { describe, expect, it } from "vitest";
import {
  bracePairAddedMembers,
  buildStandardPanelMembers,
  overlappingMemberPairs,
  newVerticalSpec,
} from "@building-integrity/panel-catalog";
import type { StoredPanelMemberSpec } from "@building-integrity/geometry";
import { standardPanelMembersFor, toAddedMemberSpecs } from "./standardPanelMembers";

/**
 * **THE SEAM THE PANEL EDITOR WRITES THROUGH — B19, 2026-11-03.**
 *
 * `standardPanelMembersFor` is the one function the plan, the elevation, the 3D
 * view, the cut list, the weight, the price, the shear check and every file
 * export read a standard panel's members from. These tests are about the three
 * states a panel can be in — no pattern, a pattern, and its own edited list —
 * and specifically about the one that is easy to get wrong: a stored list
 * REPLACES the pattern, it does not add to it.
 */

const W = 48;
const D = 15.5;
const H = 120;

describe("standardPanelMembersFor", () => {
  it("a panel with no pattern is exactly the plain builder", () => {
    /* ⚠ Not "equivalent to the recipe path with an empty list" — the plain
       call, so nothing downstream depends on the two being the same. */
    expect(standardPanelMembersFor({}, W, D, H, false)).toEqual(buildStandardPanelMembers(W, D, H, false));
  });

  it("a panel with a pattern gets the pattern's members", () => {
    const members = standardPanelMembersFor(
      { bracePairPattern: "superbrace", bracePairHalf: "left", braceFigure: "super-carrot" },
      W,
      D,
      H,
      false,
    );
    const expected = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", figure: "super-carrot" });
    expect(expected.length).toBeGreaterThan(0);
    for (const spec of expected) expect(members.some((m) => m.memberId === spec.id)).toBe(true);
  });

  it("⚠ an edited list REPLACES the pattern — a deleted leg stays deleted", () => {
    /* The whole reason the field is authoritative rather than additive. With an
       additive field, the pattern would hand the carrot straight back on the
       next render and nothing the user removed would ever stay removed. */
    const pattern = bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "left", figure: "super-carrot" });
    const kept = pattern.slice(1) as StoredPanelMemberSpec[];
    const members = standardPanelMembersFor(
      { bracePairPattern: "superbrace", bracePairHalf: "left", braceFigure: "super-carrot", editedMembers: kept },
      W,
      D,
      H,
      false,
    );
    expect(members.some((m) => m.memberId === pattern[0]!.id)).toBe(false);
    for (const spec of kept) expect(members.some((m) => m.memberId === spec.id)).toBe(true);
  });

  it("⚠ an EMPTY edited list is a bare panel, not a missing field", () => {
    /* The two states the editor has to be able to express: `undefined` means
       "follow the pattern", `[]` means "this panel has nothing added". A panel
       stripped bare has to stay bare. */
    const bare = standardPanelMembersFor(
      { bracePairPattern: "superbrace", bracePairHalf: "left", editedMembers: [] },
      W,
      D,
      H,
      false,
    );
    const following = standardPanelMembersFor({ bracePairPattern: "superbrace", bracePairHalf: "left" }, W, D, H, false);
    expect(bare.length).toBeLessThan(following.length);
    expect(bare.filter((m) => m.role === "brace")).toEqual([]);
  });

  it("an unedited panel and one edited back to its pattern's own list are the same panel", () => {
    /* ⚠ Uniqueness falls out of the members, not from a hand-edited flag —
       `recipeFingerprint`'s own rule. So opening the editor and changing
       nothing must not fork the panel off its group. */
    const source = { bracePairPattern: "superbrace", bracePairHalf: "right", braceFigure: "little-carrot" } as const;
    const derived = standardPanelMembersFor(source, W, D, H, true);
    const edited = standardPanelMembersFor(
      { ...source, editedMembers: bracePairAddedMembers({ pattern: "superbrace", widthIn: W, heightIn: H, half: "right", figure: "little-carrot" }) },
      W,
      D,
      H,
      true,
    );
    expect(edited).toEqual(derived);
  });

  it("an edited panel is still overlap-clean when the editor placed the member", () => {
    const base = buildStandardPanelMembers(W, D, H, false);
    const spec = newVerticalSpec({ widthIn: W, depthIn: D, heightIn: H }, { wythe: "exterior", existing: base, id: "e1" });
    const members = standardPanelMembersFor({ editedMembers: [spec] }, W, D, H, false);
    expect(members.some((m) => m.memberId === "e1")).toBe(true);
    expect(overlappingMemberPairs(members)).toEqual([]);
  });
});

describe("toAddedMemberSpecs", () => {
  it("narrows both kinds without touching the numbers", () => {
    const stored: StoredPanelMemberSpec[] = [
      { kind: "diagonal", id: "a", fromXIn: 1.5, fromZIn: 2.25, toXIn: 46.5, toZIn: 117.75, wythe: "exterior" },
      { kind: "straight", id: "b", fromXIn: 23.25, fromZIn: 2.25, toXIn: 23.25, toZIn: 117.75, wythe: "interior" },
    ];
    expect(toAddedMemberSpecs(stored)).toEqual(stored);
  });
});
