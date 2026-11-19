import { describe, expect, it } from "vitest";

import { fastenerSpacingTable, fastenerTableStatus } from "./data";

/**
 * ⚠ **His 2026-11-18 statement, pinned.**
 *
 * > *"typically we are doing every 16" of 5/16" 4" grk structural screws on
 * > the outside of the panel and 2' on the inside."*
 *
 * He quoted, from memory, the two rows this table had carried all along — and
 * in doing so moved them off `pending-BI-confirmation`. These tests exist so
 * that a later edit cannot quietly take them back, and so that the other six
 * rows cannot drift onto `confirmed` without somebody saying who confirmed
 * them.
 */
describe("the fastener schedule's per-row provenance", () => {
  it("gives every row a status", () => {
    expect(fastenerSpacingTable.length).toBeGreaterThan(0);
    for (const row of fastenerSpacingTable) {
      expect(row.status, row.connection).toMatch(/^(confirmed|pending-BI-confirmation)$/);
    }
  });

  it("⚠ confirms EXACTLY the two panel-to-panel rows Tommy stated himself", () => {
    const confirmed = fastenerSpacingTable.filter((r) => r.status === "confirmed").map((r) => r.connection);
    expect(confirmed.sort()).toEqual(["Panel to panel, exterior", "Panel to panel, interior"]);
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

  it("⚠ cites him in both confirmed rows' notes, so nothing reads as confirmed by nobody", () => {
    for (const row of fastenerSpacingTable.filter((r) => r.status === "confirmed")) {
      expect(row.note, row.connection).toBeDefined();
      expect(row.note!, row.connection).toContain("2026-11-18");
      expect(row.note!, row.connection).toContain("typically we are doing");
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

  it("⚠ leaves the table-wide status PENDING, because six rows still are", () => {
    expect(fastenerTableStatus.status).toBe("pending-BI-confirmation");
    const pending = fastenerSpacingTable.filter((r) => r.status === "pending-BI-confirmation");
    expect(pending).toHaveLength(fastenerSpacingTable.length - 2);
    expect(fastenerTableStatus.note).toContain("Six of the eight");
  });

  it("⚠ the table-wide note says no row is tied to a LOAD", () => {
    /* The thing a reader is most likely to assume from a confirmed spacing.
       Phase 2 of the roof-bracing item is what changes this. */
    expect(fastenerTableStatus.note).toContain("not a figure derived from a force");
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
