import { panelKey } from "./panelKey";

/**
 * ⚠ **ONE NUMBER PER PANEL — `0001`, `0002`, … — B36 stride 2, 2026-11-18.**
 *
 * > *"gosh i do like the 0001 naming convention though... true true confusing
 * > if panels move around and such but like... who cares if at the begining of
 * > the design the panels jump around drastically. if there was some fool
 * > proof way to make 0001 naming scheme work id be open to it."*
 * > — Tommy, 2026-11-17
 *
 * He can have it, and this module is the foolproof part.
 *
 * ## ⚠ There used to be THREE numbers on one panel, and two of them were four
 * digits long
 *
 * | | what it was | frozen? |
 * | --- | --- | --- |
 * | `N3` | which wall, which position along it | derived |
 * | `0042` (B35's install number) | position in the install sequence | derived |
 * | `P-0017` (the crew code) | the join key a crew's pay hangs on | stored at first export |
 *
 * ⚠ **A panel could be install number `0042` and code `P-0017` at the same
 * time**, and both were shown to crews. Worse, the two counted in DIFFERENT
 * ORDERS: codes were stamped in the export pipeline's order (walls, roof
 * bearing, beams, decks) while install numbers counted in his own install
 * order, so the two never agreed about which panel `0028` was, from the very
 * first export. That is the question this stride answers.
 *
 * ## ⚠ A NUMBER is an identity. An ORDER is an order.
 *
 * - **The number identifies the panel.** It must never change once anybody
 *   has acted on it — and before that, nobody cares what it is.
 * - **The install order is a separate fact** — *"step 42 of 134"* — recomputed
 *   freely forever, because it describes the build, not the part. It is a
 *   plain integer now, deliberately **not** zero-padded, so a column of steps
 *   can never be misread as a column of panel numbers. That padding was the
 *   whole mechanism of the hazard above.
 *
 * ## The rule, in three lines
 *
 * 1. **While designing**: nothing is stored. A panel's number is its install
 *    position, so it reads `0001`… from the first drawn wall and it JUMPS as
 *    the design changes. That is his *"who cares"*, and it is why a
 *    provisional number says so wherever it is printed.
 * 2. **At issue** — the project going to a shop or a crew — every panel takes
 *    the next unused number **in install order**, and the ledger is stored
 *    with the project. ⚠ Numbering in install order is what makes a fresh
 *    project's numbers CONTINUOUS across that moment: the provisional `0042`
 *    is stamped as `0042`, so nothing a person has already read moves.
 * 3. **After that**: a stamped panel keeps its number forever. A panel added
 *    later takes the next unused number at the NEXT issue, and reads as
 *    awaiting one until then — never as a provisional number, which could
 *    collide with a number already issued to a different panel. ⚠ **A deleted
 *    panel's number is retired, never reissued**, because `nextSeq` only ever
 *    goes forward.
 *
 * ⚠ **His rule that panel identity is DERIVED — *"not from a memory file"* —
 * is the one thing this crosses, and deliberately.** It was written against a
 * CATEGORY field that a drawing would contradict, and the derived thing it
 * protects (which wall, which position) is untouched and is now carried as its
 * own separate field. What is stored here is the opposite case: a number whose
 * entire job is to survive a redraw, which no derivation can do. A panel's
 * location is still derived; its NUMBER is remembered.
 */
export interface PanelNumberLedger {
  /**
   * Key (see `panelKey`) to the number it was stamped with — `"0042"`.
   *
   * ⚠ **The field is called `codesByKey` for a reason worth stating: it is the
   * name in every project file already written.** Renaming it would make an
   * older build read `undefined` and reissue every number in the project,
   * which is the one failure this whole module exists to prevent. The name is
   * historical; the thing is a panel number.
   */
  codesByKey: Record<string, string>;
  /** The next number to issue. ⚠ Monotonic — see the doc comment above. */
  nextSeq: number;
}

export const EMPTY_PANEL_NUMBER_LEDGER: PanelNumberLedger = { codesByKey: {}, nextSeq: 1 };

/**
 * ⚠ **Four digits, 1-based.** He wrote both `0000` and `0001`; it starts at
 * **0001**, because `0000` reads as "unset" wherever it turns up and a crew
 * should never see a panel that looks unassigned.
 *
 * Zero-padded to four so the numbers sort lexically and line up in a column on
 * a printed sheet. ⚠ A building past 9999 panels simply gets a fifth digit
 * rather than wrapping or truncating — the padding is for reading, and
 * silently reusing `0001` is the one thing that must not happen.
 *
 * ⚠ **No prefix.** It carried `P-` while it was a crew-app join key nobody
 * saw; it is now the token stencilled on the panel, and his shop has no hyphen
 * stencil (*"there is no huphen stencil. So let's drop the hyphen"*,
 * 2026-09-24). A file written before this strips the prefix on load.
 */
export function formatPanelNumber(n: number): string {
  return String(n).padStart(4, "0");
}

/** Whether this project's numbers have been issued, i.e. frozen. */
export function panelNumbersIssued(ledger: PanelNumberLedger): boolean {
  return Object.keys(ledger.codesByKey).length > 0;
}

/**
 * Every key with no number yet takes the next one, **in install order**.
 * Existing keys are never touched — which is the whole point, and is what his
 * acceptance check tests: issue, make an unrelated edit, re-issue, every
 * existing panel kept its number and only new panels are new.
 *
 * ⚠ **The install order is what makes the numbers continuous across the moment
 * of issue** (see this module's own doc comment). A key the sequence has never
 * heard of still gets a number — it sorts last, in the caller's own order,
 * because leaving a real panel unnumbered is worse than numbering it late.
 */
export function stampPanelNumbers(
  keys: readonly string[],
  ledger: PanelNumberLedger,
  installOrder: ReadonlyMap<string, number>,
): PanelNumberLedger {
  const unnumbered = keys.filter((key) => ledger.codesByKey[key] === undefined);
  if (unnumbered.length === 0) return ledger;
  const callerOrder = new Map(keys.map((key, i) => [key, i] as const));
  const ordered = [...new Set(unnumbered)].sort((a, b) => {
    /* `Infinity` rather than 0: an unplaced item sorts AFTER every placed one
       instead of ahead of the whole building. */
    const sa = installOrder.get(a) ?? Infinity;
    const sb = installOrder.get(b) ?? Infinity;
    if (sa !== sb) return sa - sb;
    return (callerOrder.get(a) ?? 0) - (callerOrder.get(b) ?? 0);
  });
  let nextSeq = ledger.nextSeq;
  const codesByKey = { ...ledger.codesByKey };
  for (const key of ordered) {
    codesByKey[key] = formatPanelNumber(nextSeq);
    nextSeq += 1;
  }
  return { codesByKey, nextSeq };
}

export interface PanelNumbering {
  /** The number to show, paint and export, by `panelKey`. */
  numberByKey: ReadonlyMap<string, string>;
  /**
   * ⚠ **True once anything is stored**, which is the line between "a number
   * that jumps" and "a number somebody has acted on". Everything printed has
   * to say which side of it the number came from.
   */
  issued: boolean;
  /**
   * ⚠ Live keys with no number — only possible after issue, and only for
   * panels added since. They read as awaiting a number, never as a provisional
   * one: a provisional number could collide with one already issued to a
   * different panel.
   */
  awaiting: string[];
  /**
   * ⚠ Numbers in the ledger whose panel is gone. **Retired, never reissued** —
   * the failure a crew would feel in their pay.
   */
  retired: string[];
}

/**
 * What every consumer wants: one number per live panel, and the honest story
 * about where it came from.
 *
 * ⚠ **Before issue the number IS the install position** — formatted the same
 * way, because it is the same number, one frozen and one not. That continuity
 * is deliberate: see `stampPanelNumbers`.
 */
export function panelNumbering(
  liveKeys: readonly string[],
  ledger: PanelNumberLedger,
  installOrder: ReadonlyMap<string, number>,
): PanelNumbering {
  const issued = panelNumbersIssued(ledger);
  const numberByKey = new Map<string, string>();
  const awaiting: string[] = [];
  for (const key of liveKeys) {
    if (issued) {
      const stored = ledger.codesByKey[key];
      if (stored === undefined) awaiting.push(key);
      else numberByKey.set(key, stored);
      continue;
    }
    const step = installOrder.get(key);
    if (step !== undefined) numberByKey.set(key, formatPanelNumber(step));
  }
  const live = new Set(liveKeys);
  const retired = Object.entries(ledger.codesByKey)
    .filter(([key]) => !live.has(key))
    .map(([, number]) => number)
    .sort();
  return { numberByKey, issued, awaiting, retired };
}

/**
 * One key per physical panel, in the order the building's own pipelines
 * produce them — walls, then roof bearing, then beams, then decks.
 *
 * ⚠ It reads `instanceNames`, whose length always equals `copies`, so the key
 * count is the panel count by construction rather than by agreement.
 *
 * ⚠ **This order is the PIPELINE's, not the install order**, and that is why
 * `stampPanelNumbers` takes the install sequence separately rather than
 * numbering this list as it stands. Numbering it as it stands is exactly what
 * made a crew code and an install number disagree about which panel `0028`
 * was.
 */
export function panelNumberKeys(
  assemblies: readonly { panelType: string; instanceNames: readonly string[] }[],
): string[] {
  const keys: string[] = [];
  for (const assembly of assemblies) {
    assembly.instanceNames.forEach((name, i) => keys.push(panelKey(assembly.panelType, name, i)));
  }
  return keys;
}
