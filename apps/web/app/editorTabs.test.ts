import { describe, expect, it } from "vitest";
import {
  EDITOR_TAB_LABEL,
  EDITOR_TAB_ORDER,
  editorTabsInScope,
  enabledScopeBranchCount,
  isLastEnabledScopeBranch,
  type ScopeOfWork,
} from "./editorTabs";

describe("editorTabsInScope", () => {
  it("offers every tab in building order when all are enabled", () => {
    expect(editorTabsInScope(["wall", "foundation", "floor", "roof"])).toEqual(["wall", "foundation", "floor", "roof"]);
  });

  it("drops a tab Panelizer has ruled out rather than showing it inert", () => {
    expect(editorTabsInScope(["wall", "foundation", "roof"])).toEqual(["wall", "foundation", "roof"]);
  });

  it("returns building order regardless of the order the caller listed them", () => {
    expect(editorTabsInScope(["roof", "foundation", "wall"])).toEqual(["wall", "foundation", "roof"]);
  });

  it("falls back to every tab when given none, so no control is left empty", () => {
    expect(editorTabsInScope([])).toEqual([...EDITOR_TAB_ORDER]);
  });
});

describe("the last checked scope branch (Smearforn Stage 0)", () => {
  const scope = (overrides: Partial<ScopeOfWork> = {}): ScopeOfWork => ({
    walls: true,
    foundation: false,
    floors: false,
    roof: false,
    ...overrides,
  });

  it("refuses to let the only checked branch be unchecked", () => {
    expect(isLastEnabledScopeBranch(scope(), "walls")).toBe(true);
  });

  it("frees that branch again the moment a second one is checked", () => {
    expect(isLastEnabledScopeBranch(scope({ foundation: true }), "walls")).toBe(false);
    expect(isLastEnabledScopeBranch(scope({ foundation: true }), "foundation")).toBe(false);
  });

  it("never blocks a branch that is already unchecked — there is nothing to refuse", () => {
    expect(isLastEnabledScopeBranch(scope(), "foundation")).toBe(false);
    expect(isLastEnabledScopeBranch(scope(), "floors")).toBe(false);
  });

  it("holds for Foundation specifically, the branch that made an empty scope reachable", () => {
    const foundationOnly = scope({ walls: false, foundation: true });
    expect(isLastEnabledScopeBranch(foundationOnly, "foundation")).toBe(true);
    expect(enabledScopeBranchCount(foundationOnly)).toBe(1);
  });

  it("counts every checked branch", () => {
    expect(enabledScopeBranchCount(scope({ foundation: true, floors: true, roof: true }))).toBe(4);
  });
});

describe("EDITOR_TAB_LABEL", () => {
  it("labels every tab in the order", () => {
    expect(EDITOR_TAB_ORDER.map((tab) => EDITOR_TAB_LABEL[tab])).toEqual(["Wall", "Foundation", "Floor", "Roof"]);
  });
});
