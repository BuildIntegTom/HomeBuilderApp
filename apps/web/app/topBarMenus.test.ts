import { describe, expect, it } from "vitest";
import { roleDisclaimers } from "./viewerRole";
import {
  NOTE_WIDTH_PX,
  VIEWPORT_MARGIN_PX,
  clampMenuLeft,
  roleControlLabel,
  roleOptions,
  settingsMenuHasAdminGroup,
} from "./topBarMenus";

describe("clampMenuLeft", () => {
  it("anchors under the button when the whole note fits to its right", () => {
    expect(clampMenuLeft(100, 1920)).toBe(100);
  });

  it("pulls a note left so it does not spill off the right edge", () => {
    // 710px is Tommy's measured viewport.
    const left = clampMenuLeft(600, 710);
    expect(left).toBe(710 - NOTE_WIDTH_PX - VIEWPORT_MARGIN_PX);
    expect(left + NOTE_WIDTH_PX).toBeLessThanOrEqual(710 - VIEWPORT_MARGIN_PX);
  });

  it("never moves a note further right than the button that opened it", () => {
    expect(clampMenuLeft(40, 710)).toBe(40);
  });

  it("pins to the left margin on a viewport narrower than one note, never off-screen left", () => {
    // At 360px the note is narrowed by its own CSS max-width; the anchor must
    // still be a positive margin rather than the negative maxLeft.
    expect(clampMenuLeft(250, 360)).toBe(VIEWPORT_MARGIN_PX);
  });

  it("only ever moves a note left when re-clamped after the window narrows", () => {
    const opened = clampMenuLeft(900, 1920);
    const narrowed = clampMenuLeft(opened, 710);
    expect(narrowed).toBeLessThanOrEqual(opened);
    expect(narrowed + NOTE_WIDTH_PX).toBeLessThanOrEqual(710);
  });
});

describe("the collapsed viewer-role control", () => {
  it("still offers every role the four buttons did", () => {
    expect(roleOptions).toEqual(["public", "fabricator", "admin", "engineer"]);
  });

  it("reads 'Role: <label>', never a bare label that looks like a job title", () => {
    for (const role of roleOptions) {
      expect(roleControlLabel(role)).toBe(`Role: ${roleDisclaimers[role].label}`);
      expect(roleControlLabel(role)).not.toBe(roleDisclaimers[role].label);
    }
  });
});

describe("the Settings menu", () => {
  it("has no Admin Options group at all for public", () => {
    expect(settingsMenuHasAdminGroup("public")).toBe(false);
  });

  it("has the Admin Options group for every other role", () => {
    for (const role of roleOptions.filter((r) => r !== "public")) {
      expect(settingsMenuHasAdminGroup(role)).toBe(true);
    }
  });
});
