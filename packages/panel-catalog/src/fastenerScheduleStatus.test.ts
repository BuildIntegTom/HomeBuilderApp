import { describe, expect, it } from "vitest";

import { fastenerSpacingTable, fastenerTableStatus } from "./data";

/**
 * ⚠ **His two statements, pinned.**
 *
 * > *"typically we are doing every 16" of 5/16" 4" grk structural screws on
 * > the outside of the panel and 2' on the inside."* — 2026-11-18
 *
 * > *"might as well just have jack studs also get big screws. just the one
 * > schedule."* — 2026-11-19
 *
 * The first moved the two panel-to-panel rows off `pending-BI-confirmation`.
 * The second moved the jack stud onto the SAME schedule, settling a clash the
 * Reference Points page found the day before: his own 2x T25 #9 every 6in was
 * the only rule the app counted, while this table quoted a GRK for the same
 * joint and nothing counted it. These tests exist so a later edit cannot
 * quietly take any of that back, and so the remaining five rows cannot drift
 * onto `confirmed` without somebody saying who confirmed them.
 */
describe("the fastener schedule's per-row provenance", () => {
  it("gives every row a status", () => {
    expect(fastenerSpacingTable.length).toBeGreaterThan(0);
    for (const row of fastenerSpacingTable) {
      expect(row.status, row.connection).toMatch(/^(confirmed|pending-BI-confirmation)$/);
    }
  });

  it("⚠ confirms EXACTLY the three rows Tommy stated himself", () => {
    const confirmed = fastenerSpacingTable.filter((r) => r.status === "confirmed").map((r) => r.connection);
    expect(confirmed.sort()).toEqual([
      "Jack stud to panel",
      "Panel to panel, exterior",
      "Panel to panel, interior",
    ]);
  });

  it("⚠ puts the jack stud on THE ONE SCHEDULE — the same screw, the same spacings", () => {
    /* "just the one schedule." A jack-stud row that drifted back to its own
       spacing, or to its own fastener, would recreate the clash he settled. */
    const jack = fastenerSpacingTable.find((r) => r.connection === "Jack stud to panel")!;
    const exterior = fastenerSpacingTable.find((r) => r.connection === "Panel to panel, exterior")!;
    expect(jack.fastener).toBe(exterior.fastener);
    expect(jack.spacing).toContain('16"');
    expect(jack.spacing).toContain('24"');
    /* ⚠ And the note must record WHAT IT SUPERSEDED. A row that simply reads
       "16/24, confirmed" loses the fact that the shop was told something else
       until 2026-11-19. */
    expect(jack.note).toContain("SUPERSEDES");
    expect(jack.note).toContain("T25 #9");
    expect(jack.note).toContain("just the one schedule");
  });

  it("⚠ records that a jack stud is a WEAKER connection at the same spacing", () => {
    /* Its side member is 3/4in plywood, not the 1 1/2in a panel-to-panel seam
       presents, so ESR-2442 Table 3's 3/4in row applies rather than its
       1 1/2in row. Identical schedule, different capacity per screw — the
       kind of thing a reader would otherwise assume away. */
    const jack = fastenerSpacingTable.find((r) => r.connection === "Jack stud to panel")!;
    expect(jack.note).toContain("3/4in plywood");
    expect(jack.note).toContain("ESR-2442");
  });

  it("holds his two spacings exactly: 16in outside, 24in inside", () => {
    const exterior = fastenerSpacingTable.find((r) => r.connection === "Panel to panel, exterior");
    const interior = fastenerSpacingTable.find((r) => r.connection === "Panel to panel, interior");
    expect(exterior?.spacing).toContain('16"');
    expect(interior?.spacing).toContain('24"');
    /* Both are the same screw, which is the half of his sentence that is easy
       to drop: one fastener at two spacings, not two fasteners. */
    expect(exterior?.fastener).toBe(interior?.fastener);
    expect(exterior?.fastener).toContain('5/16"x4"');
  });

  it("⚠ cites him in every confirmed row's note, so nothing reads as confirmed by nobody", () => {
    for (const row of fastenerSpacingTable.filter((r) => r.status === "confirmed")) {
      expect(row.note, row.connection).toBeDefined();
      /* A date and a quotation. Which statement differs by row. */
      expect(row.note!, row.connection).toMatch(/2026-11-1[89]/);
      expect(row.note!, row.connection).toMatch(/typically we are doing|just the one schedule/);
    }
  });

  it("⚠ the exterior row no longer claims 16in is unattributed", () => {
    /* It used to read "Building Integrity's resolved value — NFW's own two
       source docs conflicted at 6" vs 18"", i.e. a number carried without his
       having said it. He has now said it, and the note records both. */
    const exterior = fastenerSpacingTable.find((r) => r.connection === "Panel to panel, exterior")!;
    expect(exterior.note).toContain("SETTLES");
    expect(exterior.note).toContain('6" vs 18"');
  });

  it("⚠ leaves the table-wide status PENDING, because five rows still are", () => {
    expect(fastenerTableStatus.status).toBe("pending-BI-confirmation");
    const pending = fastenerSpacingTable.filter((r) => r.status === "pending-BI-confirmation");
    expect(pending).toHaveLength(fastenerSpacingTable.length - 3);
    expect(fastenerTableStatus.note).toContain("Five of the eight");
  });

  it("⚠ the table-wide note says no row is tied to a LOAD", () => {
    /* The thing a reader is most likely to assume from a confirmed spacing.
       Phase 2 of the roof-bracing item is what changes this. */
    expect(fastenerTableStatus.note).toContain("not a figure derived from a force");
    /* ⚠ ...but it must now also point at the capacity that DOES exist, or a
       reader would conclude the app still knows nothing about loads. */
    expect(fastenerTableStatus.note).toContain("ESR-2442");
  });

  it("⚠ THERE IS STILL NO ROOF ROW, and this test is the reminder", () => {
    /* Not a defect to fix here — the roof schedule is phase 3/4 of the
       roof-bracing item. This asserts the Reference Points page is telling the
       truth when it reports the gap, and it will fail the day a roof row is
       added, which is exactly when the page's wording needs revisiting. */
    const roofRows = fastenerSpacingTable.filter((r) => /roof|ridge|rafter/i.test(r.connection));
    expect(roofRows).toEqual([]);
  });
});
