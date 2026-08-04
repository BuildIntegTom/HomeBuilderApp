import { describe, expect, it } from "vitest";
import { shouldAutoUpgradeToBigHeader } from "./bigHeaderAutoUpgrade";

describe("shouldAutoUpgradeToBigHeader", () => {
  it("stays a plain header for a typical door-sized opening", () => {
    // 36in wide, 22.5in tall -> rise 18in -> 45deg at 1 peak, right at the edge but in range.
    expect(shouldAutoUpgradeToBigHeader(36, 22.5)).toBe(false);
  });

  it("stays a plain header for a modest window width at a reasonable height", () => {
    expect(shouldAutoUpgradeToBigHeader(48, 24)).toBe(false);
  });

  it("upgrades a very wide opening at a short height — 1 peak would be far too shallow", () => {
    expect(shouldAutoUpgradeToBigHeader(200, 18)).toBe(true);
  });

  it("upgrades a very narrow, tall opening — 1 peak would be far too steep", () => {
    expect(shouldAutoUpgradeToBigHeader(20, 60)).toBe(true);
  });

  it("upgrades when the rise collapses to zero/negative (a degenerate angle)", () => {
    expect(shouldAutoUpgradeToBigHeader(60, 4)).toBe(true);
  });

  it("stays a plain header even at a width that used to need several peaks under the old multi-peak math, as long as the height keeps 1 peak's own angle in range", () => {
    // A width this large would have needed several peaks under the OLD
    // multi-peak formula — confirms the trigger is driven purely by the
    // single-peak angle now, not by how many peaks the old formula would
    // have picked.
    expect(shouldAutoUpgradeToBigHeader(240, 120)).toBe(false);
  });
});
