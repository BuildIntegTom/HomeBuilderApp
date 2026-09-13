import { describe, expect, it } from "vitest";
import { EDITOR_TAB_LABEL, EDITOR_TAB_ORDER, editorTabsInScope } from "./editorTabs";

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

describe("EDITOR_TAB_LABEL", () => {
  it("labels every tab in the order", () => {
    expect(EDITOR_TAB_ORDER.map((tab) => EDITOR_TAB_LABEL[tab])).toEqual(["Wall", "Foundation", "Floor", "Roof"]);
  });
});
