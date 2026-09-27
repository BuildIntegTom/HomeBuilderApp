/**
 * What a typed SLOT INDEX resolves to — the rule behind `SlotIndexInput`.
 *
 * ### The defect this exists to remove, which is the same one twice
 *
 * The spanning header's "Spans panels" fields were raw
 * `<input type="number" onChange>`, committing on every keystroke. Clearing
 * the field to retype it sent `Number("") === 0`, which is a perfectly legal
 * slot index — so the header silently jumped to the first panel on the wall
 * and nothing refused it.
 *
 * `LengthInput` already carries this lesson in its own header: a number input
 * hands back `""` for anything it dislikes, and `Number("")` is 0, so the
 * fields most likely to receive a hand-typed dimension were the ones that
 * quietly zeroed it. The answer there was parse-on-commit rather than
 * per-keystroke, and it is the answer here.
 *
 * Splitting out the rule (rather than inlining it in the component) is what
 * makes "an empty field commits nothing" a test rather than a claim.
 */

/** A typed index, or null when there is nothing to commit. Null is never
 * silently turned into 0 — that substitution IS the defect. */
export function resolveSlotIndexEntry(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  // Rejected rather than truncated: `2.5` is not a panel, and a field that
  // accepts it by rounding has decided something the user did not type.
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}
