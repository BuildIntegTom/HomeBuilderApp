import { describe, expect, it } from "vitest";
import { panelKey } from "./panelKey";
import {
  EMPTY_PANEL_NUMBER_LEDGER,
  formatPanelNumber,
  panelNumbering,
  panelNumberKeys,
  panelNumbersIssued,
  stampPanelNumbers,
} from "./panelNumber";

/* ──────────────────────────────────────────────────────────────────────────
   B36 stride 2 — ONE NUMBER PER PANEL

   > *"gosh i do like the 0001 naming convention though... if there was some
   > fool proof way to make 0001 naming scheme work id be open to it."*
   > — Tommy, 2026-11-17

   ⚠ There were THREE numbers on one panel and two of them were four digits
   long: `N3`, B35's install number `0042`, and the crew code `P-0017`. The
   two four-digit ones counted in DIFFERENT ORDERS, so they never agreed about
   which panel `0028` was. This file pins the merge.
   ────────────────────────────────────────────────────────────────────────── */

/** The export seam's own shape, cut down to what the keys need. */
const asm = (panelType: string, names: string[]) => ({ panelType, instanceNames: names });

/** A whole building, in PIPELINE order — walls, then the deck. */
const building = [asm("Wall panel", ["N1", "N2", "N3"]), asm("Deck panel", ["F1", "F2"])];

/** ⚠ The INSTALL order, which is the opposite way round for these families:
 *  his packet order puts the floor deck first and the walls after it. */
const installOrder = new Map([
  [panelKey("Deck panel", "F1", 0), 1],
  [panelKey("Deck panel", "F2", 1), 2],
  [panelKey("Wall panel", "N1", 0), 3],
  [panelKey("Wall panel", "N2", 1), 4],
  [panelKey("Wall panel", "N3", 2), 5],
]);

describe("the number as it prints", () => {
  it("⚠ starts at 0001, not 0000 — he wrote both", () => {
    /* `0000` reads as "unset" wherever it appears, and a crew should never be
       handed a panel that looks unassigned. */
    expect(formatPanelNumber(1)).toBe("0001");
  });

  it("is zero-padded to four so a printed column lines up", () => {
    expect([1, 12, 123, 1234].map(formatPanelNumber)).toEqual(["0001", "0012", "0123", "1234"]);
  });

  it("⚠ a building past 9999 gets a fifth digit rather than wrapping", () => {
    expect(formatPanelNumber(10000)).toBe("10000");
  });

  it("⚠ carries NO prefix — his shop has no hyphen stencil", () => {
    /* It was `P-0001` while it was a join key nobody saw. It is the token
       stencilled on the panel now, and *"there is no huphen stencil"*. */
    expect(formatPanelNumber(1)).not.toContain("-");
    expect(formatPanelNumber(1)).toMatch(/^\d+$/);
  });
});

describe("⚠ while designing, the number is the install position and it JUMPS", () => {
  it("every live panel reads its own install step, zero-padded", () => {
    const n = panelNumbering(panelNumberKeys(building), EMPTY_PANEL_NUMBER_LEDGER, installOrder);
    expect(n.issued).toBe(false);
    /* ⚠ The deck is 0001/0002 and the walls follow, because the INSTALL order
       says so — not the pipeline order, which produces the walls first. */
    expect(n.numberByKey.get(panelKey("Deck panel", "F1", 0))).toBe("0001");
    expect(n.numberByKey.get(panelKey("Wall panel", "N1", 0))).toBe("0003");
    expect(n.awaiting).toEqual([]);
    expect(n.retired).toEqual([]);
  });

  it("⚠ it moves when the design does — which is his own 'who cares'", () => {
    /* > *"who cares if at the begining of the design the panels jump around
       >  drastically."* Pinned rather than assumed: this is the behaviour the
       issue step exists to END, so it has to be real before then. */
    const shifted = new Map([
      [panelKey("Wall panel", "N1", 0), 9],
      [panelKey("Deck panel", "F1", 0), 1],
    ]);
    const before = panelNumbering(panelNumberKeys(building), EMPTY_PANEL_NUMBER_LEDGER, installOrder);
    const after = panelNumbering(panelNumberKeys(building), EMPTY_PANEL_NUMBER_LEDGER, shifted);
    expect(before.numberByKey.get(panelKey("Wall panel", "N1", 0))).toBe("0003");
    expect(after.numberByKey.get(panelKey("Wall panel", "N1", 0))).toBe("0009");
  });

  it("a key the sequence has not placed gets no number rather than a guessed one", () => {
    const n = panelNumbering(["Ridge beam|RB1"], EMPTY_PANEL_NUMBER_LEDGER, installOrder);
    expect(n.numberByKey.size).toBe(0);
  });
});

describe("⚠ at issue, numbers are stamped IN INSTALL ORDER — the continuity property", () => {
  it("⚠ the provisional number a person read is the number that gets stamped", () => {
    /* THIS IS THE WHOLE POINT OF THE STRIDE. Numbering the pipeline list as it
       stands — which is what `stampPanelCodes` did — gave the walls 0001-0003
       and the deck 0004-0005, while B35's chip showed the deck as 0001. Two
       four-digit numbers, same panel, both shown to crews, disagreeing from
       the first export. Stamping in install order makes the moment of issue
       invisible: nothing a person has already read moves. */
    const keys = panelNumberKeys(building);
    const provisional = panelNumbering(keys, EMPTY_PANEL_NUMBER_LEDGER, installOrder).numberByKey;
    const issued = panelNumbering(keys, stampPanelNumbers(keys, EMPTY_PANEL_NUMBER_LEDGER, installOrder), installOrder);
    expect(issued.issued).toBe(true);
    for (const key of keys) {
      expect({ key, number: issued.numberByKey.get(key) }).toEqual({ key, number: provisional.get(key) });
    }
  });

  it("⚠ and the OLD behaviour is what happens with no install order — the regression, pinned", () => {
    /* The parameter is required precisely so this cannot happen by omission.
       Handed an EMPTY order, every key is unplaced and falls back to the
       caller's own pipeline order, which is what used to ship: the walls take
       0001-0003 and the floor deck — the first thing a crew installs — takes
       0004. */
    const keys = panelNumberKeys(building);
    const pipelineOrdered = stampPanelNumbers(keys, EMPTY_PANEL_NUMBER_LEDGER, new Map());
    expect(pipelineOrdered.codesByKey[panelKey("Wall panel", "N1", 0)]).toBe("0001");
    expect(pipelineOrdered.codesByKey[panelKey("Deck panel", "F1", 0)]).toBe("0004");
  });

  it("an item the sequence does not place still gets a number, and it sorts LAST", () => {
    /* Leaving a real panel unnumbered is worse than numbering it late. */
    const keys = [...panelNumberKeys(building), "Ridge beam|RB1"];
    const ledger = stampPanelNumbers(keys, EMPTY_PANEL_NUMBER_LEDGER, installOrder);
    expect(ledger.codesByKey["Ridge beam|RB1"]).toBe("0006");
  });

  it("nothing is issued until it is, and the ledger says which", () => {
    expect(panelNumbersIssued(EMPTY_PANEL_NUMBER_LEDGER)).toBe(false);
    expect(panelNumbersIssued(stampPanelNumbers(["a|1"], EMPTY_PANEL_NUMBER_LEDGER, new Map()))).toBe(true);
  });
});

describe("⚠ after issue a number never moves — his acceptance check, as a test", () => {
  const keys = panelNumberKeys(building);
  const issued = stampPanelNumbers(keys, EMPTY_PANEL_NUMBER_LEDGER, installOrder);

  it("an unrelated edit keeps every existing number", () => {
    const grown = [...building, asm("Deck panel", ["R1", "R2"])];
    const grownKeys = panelNumberKeys(grown);
    const order2 = new Map([...installOrder, [panelKey("Deck panel", "R1", 0), 6], [panelKey("Deck panel", "R2", 1), 7]]);
    const next = stampPanelNumbers(grownKeys, issued, order2);
    for (const key of keys) {
      expect({ key, n: next.codesByKey[key] }).toEqual({ key, n: issued.codesByKey[key] });
    }
    expect(next.codesByKey[panelKey("Deck panel", "R1", 0)]).toBe("0006");
  });

  it("re-issuing with nothing changed mints nothing and returns the SAME ledger", () => {
    /* Reference equality on purpose — the caller skips a save on it. */
    expect(stampPanelNumbers(keys, issued, installOrder)).toBe(issued);
  });

  it("⚠ a panel added since issue reads as AWAITING a number, never as a provisional one", () => {
    /* A provisional number is an install position, and after issue an install
       position belongs to some OTHER panel. Showing one would put two panels
       on the same number — the exact failure a crew feels in their pay. */
    const grownKeys = [...keys, panelKey("Wall panel", "N4", 3)];
    const n = panelNumbering(grownKeys, issued, new Map([...installOrder, [panelKey("Wall panel", "N4", 3), 4]]));
    expect(n.awaiting).toEqual([panelKey("Wall panel", "N4", 3)]);
    expect(n.numberByKey.has(panelKey("Wall panel", "N4", 3))).toBe(false);
    /* And 0004, which that panel's install step would have produced, is still
       the panel it was issued to. */
    expect(n.numberByKey.get(panelKey("Wall panel", "N2", 1))).toBe("0004");
  });

  it("⚠ a deleted panel's number is RETIRED, never reissued to a different panel", () => {
    const n3 = issued.codesByKey[panelKey("Wall panel", "N3", 2)];
    const shrunk = [asm("Wall panel", ["N1", "N2"]), asm("Deck panel", ["F1", "F2"])];
    const shrunkKeys = panelNumberKeys(shrunk);
    const numbering = panelNumbering(shrunkKeys, issued, installOrder);
    expect(numbering.retired).toEqual([n3]);
    /* Re-issue after adding a different panel: it takes the NEXT number, not
       the dead one. */
    const grown = [...shrunk, asm("Deck panel", ["F9"])];
    const after = stampPanelNumbers(panelNumberKeys(grown), issued, installOrder);
    expect(after.codesByKey[panelKey("Deck panel", "F9", 0)]).not.toBe(n3);
    expect(after.nextSeq).toBeGreaterThan(issued.nextSeq);
  });

  it("⚠ nextSeq only ever goes forward, even across a shrink", () => {
    const shrunk = panelNumberKeys([asm("Wall panel", ["N1"])]);
    expect(stampPanelNumbers(shrunk, issued, installOrder).nextSeq).toBe(issued.nextSeq);
  });
});

describe("the key is scoped by family", () => {
  it("⚠ a wall panel and a deck panel named alike are two panels with two numbers", () => {
    /* Stencil names are unique within a pipeline, not across them. Without the
       family in the key a crew would be paid once for two panels. */
    const keys = panelNumberKeys([asm("Wall panel", ["N1"]), asm("Deck panel", ["N1"])]);
    const ledger = stampPanelNumbers(keys, EMPTY_PANEL_NUMBER_LEDGER, new Map());
    expect(new Set(Object.values(ledger.codesByKey)).size).toBe(2);
  });

  it("an unnamed instance still gets a stable key from its position in its own group", () => {
    expect(panelNumberKeys([asm("Ridge beam", ["", ""])])).toEqual(["Ridge beam|#0", "Ridge beam|#1"]);
  });
});
