import { describe, expect, it } from "vitest";
import { roleDisclaimers } from "./viewerRole";
import {
  NOTE_WIDTH_PX,
  VIEWPORT_MARGIN_PX,
  clampMenuLeft,
  roleControlLabel,
  roleOptions,
  settingsMenuHasAdminGroup,
  settingsMenuSections,
  SETTINGS_SECTION_IDS,
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

describe("the Settings menu's sections — U3", () => {
  it("holds Site Properties and the Panelizer, which used to be Project menu items", () => {
    // The relocation itself, asserted rather than only rendered: Tommy, "we
    // should move the content of the panelizer into the settings in the top
    // right".
    expect(settingsMenuSections("admin")).toContain("site");
    expect(settingsMenuSections("admin")).toContain("panelizer");
  });

  it("puts the Panelizer FIRST — panelizer → site → units → sandbox → admin", () => {
    // ⚠ The order is the answer to "where is it?". Landing on the units switch
    // when you opened Settings looking for the Panelizer is the same problem
    // one level shallower, so the Panelizer leads and Site Properties follows
    // it. Accepted as a review finding 2026-09-29; one line to reverse.
    expect(settingsMenuSections("admin")).toEqual(["panelizer", "site", "units", "sandbox", "admin"]);
    expect(settingsMenuSections("admin")[0]).toBe("panelizer");
    expect(settingsMenuSections("public")[0]).toBe("panelizer");
  });

  it("⚠ never role-gates Site Properties or the Panelizer — every role sees both", () => {
    // THE REGRESSION THIS FILE EXISTS FOR. Settings is also the note carrying
    // the role-gated Admin Options group, so the one mistake this move could
    // make invisibly is dropping either section inside that gate. The Panelizer
    // holds the scope-of-work checkboxes that decide which editors exist at
    // all; hiding it from a signed-out visitor would raise no error anywhere.
    for (const role of roleOptions) {
      expect(settingsMenuSections(role)).toContain("site");
      expect(settingsMenuSections(role)).toContain("panelizer");
      expect(settingsMenuSections(role)).toContain("units");
      expect(settingsMenuSections(role)).toContain("sandbox");
    }
  });

  it("withholds admin, and ONLY admin, from public", () => {
    expect(settingsMenuSections("public")).toEqual(SETTINGS_SECTION_IDS.filter((id) => id !== "admin"));
    expect(settingsMenuSections("public")).not.toContain("admin");
  });

  it("agrees with settingsMenuHasAdminGroup for every role, so the two cannot drift", () => {
    for (const role of roleOptions) {
      expect(settingsMenuSections(role).includes("admin")).toBe(settingsMenuHasAdminGroup(role));
    }
  });

  it("lists every section exactly once — a duplicate would render a section twice", () => {
    expect(new Set(SETTINGS_SECTION_IDS).size).toBe(SETTINGS_SECTION_IDS.length);
  });
});
