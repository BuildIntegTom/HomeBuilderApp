/**
 * ⚠ **THE ONE KEY A PANEL IS LOOKED UP BY — `family|leaf` — B36 stride 2,
 * 2026-11-18.**
 *
 * It was two functions with byte-identical bodies, `panelCodeKey` in
 * `tip4urTimeCsv` and `installSequenceKey` in `installSequence`, pinned equal
 * by a test because neither module could import the other without closing a
 * cycle. That workaround is gone: this module imports nothing, so both can
 * import it, and the formula exists once.
 *
 * ⚠ **The family is half the key, and that is not decoration.** A stencilled
 * name is only unique WITHIN a pipeline — a wall panel and a deck panel can
 * both be the first of their run — so two families sharing a name would share
 * a number, and a crew would be paid once for two panels.
 *
 * ⚠ **A name is LETTERS then DIGITS and nothing else** (B36 stride 1): the
 * interior-wall series counts in letters (`C`, `CB`, `CC`) precisely so that
 * `C2` + `1` can no longer collide with `C` + `21` in this very string. Any
 * new series has to keep that property, because this key is where the
 * collision lands.
 */
export function panelKey(family: string, instanceName: string, indexWithinGroup: number): string {
  /* An unnamed instance still needs a stable key, and its position within
     its own group is the only thing it has. */
  const leaf = instanceName.length > 0 ? instanceName : `#${indexWithinGroup}`;
  return `${family}|${leaf}`;
}
