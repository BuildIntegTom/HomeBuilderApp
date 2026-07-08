import { describe, expect, it } from "vitest";
import { fastenerSpacingTable, foundationTypes } from "./data";
import { foundationFastenerSchedule } from "./foundationDetails";

describe("foundationFastenerSchedule", () => {
  it("pulls the crawlspace's 4 fastened connections from the full table, in load-path order, skipping the pier step", () => {
    const crawlspace = foundationTypes.find((f) => f.id === "crawlspace")!;
    const schedule = foundationFastenerSchedule(crawlspace, fastenerSpacingTable);
    expect(schedule.map((row) => row.connection)).toEqual([
      "Pier to beam",
      "Floor panel to beam",
      "Toe-up to floor panel",
      "Wall panel to toe-up",
    ]);
  });

  it("returns each row exactly as it appears in the shared fastener table (single-sourced, not duplicated)", () => {
    const crawlspace = foundationTypes.find((f) => f.id === "crawlspace")!;
    const schedule = foundationFastenerSchedule(crawlspace, fastenerSpacingTable);
    const pierToBeam = fastenerSpacingTable.find((row) => row.connection === "Pier to beam");
    expect(schedule[0]).toBe(pierToBeam);
  });

  it("returns an empty schedule for a foundation type with no defined load path yet", () => {
    const slab = foundationTypes.find((f) => f.id === "slab")!;
    expect(foundationFastenerSchedule(slab, fastenerSpacingTable)).toEqual([]);
  });
});
