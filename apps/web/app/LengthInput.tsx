"use client";

import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  formatLengthForDomain,
  resolveLengthEntry,
  type LengthDomain,
} from "./canvasGeometry";

/**
 * A length field a shop user can type a fraction into.
 *
 * **Why this is `type="text"` and not `type="number"`.** Every one of these
 * fields used to be an `<input type="number">`, and a number input *cannot
 * hold* `47 5/8` — the browser refuses the text, `e.target.value` comes
 * back `""`, and `Number("")` is **0**. So in exactly the fields most
 * likely to receive a hand-typed panel dimension, a typed fraction didn't
 * lose its fraction, it **zeroed the dimension**. No parser change could
 * fix that; the input type had to change. (The old fields already carried
 * `step={0.125}`, so the spinner arrows had been stepping by an eighth all
 * along — `step` just never constrains a *typed* value.)
 *
 * Three behaviours this owes the user, all of them per the spec's
 * "Fraction input" and "Typed entry, and a formatter that never lies":
 *
 * 1. **Parse on commit, not per keystroke** (blur/Enter), so a half-typed
 *    `47 5/` never becomes a stored number.
 * 2. **Snap on commit and redisplay the snapped value.** `47 5/16` stores
 *    47⅜" and immediately reads back as `47⅜`. The user is never shown one
 *    number while another is stored.
 * 3. **A failed parse is visible.** The old wall-length editor did
 *    `if (parsed !== null)` with no `else` and simply closed — a silent
 *    no-op. Here the field marks itself invalid and leaves the committed
 *    value untouched. It never commits a different number: silent
 *    substitution is the same failure class as silent rounding.
 *
 *    It deliberately does NOT force focus back on a failed blur. A field
 *    the caret cannot leave is a trap, and what was asked for is a
 *    *visible* failure, not an inescapable one — the red outline, the
 *    `aria-invalid` and the `= —, unrecognized` hint all persist after the
 *    user clicks away, which says the same thing without holding them
 *    hostage.
 *
 * Note on "restore the previous value": the *stored* value is what gets
 * restored (nothing commits). The text the user typed is deliberately left
 * in the box so it can be corrected — wiping it would destroy the input,
 * which is the exact failure this whole stage exists to remove. Escape
 * still discards the draft outright.
 *
 * **The live hint is a requirement, not a nicety.** In a feet-domain field
 * `47 5/8` resolves to 47ft + ⅝in, and the competing reading (fraction
 * switches the whole field to inches) is 3'-11⅝" — a factor of twelve, and
 * silent if the parser guesses wrong. The hint puts the resolved number on
 * screen before it lands. It is also where a failed parse lives.
 */
export interface LengthInputProps {
  /** The committed value, in this field's own unit. */
  value: number;
  /** Which unit the field's bare whole number is in. The fraction is
   * always inches either way. */
  domain: LengthDomain;
  /** Called only with a parsed, grid-snapped value that differs from
   * `value`. Never called for an unparseable entry, and never for one
   * `validate` refuses. */
  onCommit: (next: number) => void;
  /**
   * A REFUSAL, not a clamp: return a message and the entry does not commit.
   *
   * Added for Smearforn Stage 1's 24in fabrication minimum, where the right
   * answer is explicitly not "quietly give them 24" — a panel the shop
   * cannot build is not a thing to negotiate at the keyboard. It reuses the
   * unparseable-entry path exactly: the field marks itself invalid, keeps
   * the text the user typed so it can be corrected, and says why. Pressing
   * Enter therefore leaves the caret where it is; blurring leaves the field
   * red and uncommitted rather than trapping the caret, which is the same
   * deliberate choice documented above.
   *
   * A clamp is NOT this. A value above a ceiling still commits and the
   * caller shows its own clamp notice — see `handleSetWindowWidth`.
   */
  validate?: (next: number) => string | null;
  id?: string;
  title?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

const INVALID_STYLE: CSSProperties = { outline: "2px solid #c0392b", outlineOffset: 0 };

const REFUSAL_STYLE: CSSProperties = {
  margin: "4px 0 0",
  fontSize: 12,
  color: "#c0392b",
};

const HINT_STYLE: CSSProperties = {
  marginLeft: 6,
  fontSize: 11,
  whiteSpace: "nowrap",
  color: "#555",
};

export default function LengthInput({
  value,
  domain,
  onCommit,
  validate,
  id,
  title,
  style,
  ariaLabel,
}: LengthInputProps) {
  // `null` means "not being edited" — the field then renders the committed
  // value, so an external change (a clamp in the handler, a project load, a
  // drag on the canvas) shows up immediately instead of being pinned by
  // stale local state.
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  /** A refusal from `validate` — held separately from `invalid` so the
   * message can say WHICH limit was hit rather than just "unrecognized". */
  const [refusal, setRefusal] = useState<string | null>(null);
  // The hint is wired up with `aria-describedby` rather than an aria-live
  // region: it changes on every keystroke, and a live region would have a
  // screen reader read the half-resolved value out loud each time.
  const hintId = useId();

  const text = draft ?? formatLengthForDomain(value, domain);
  const entry = draft === null ? null : resolveLengthEntry(draft, domain);

  /** Returns false when the entry could not be parsed — the caller keeps
   * the caret here rather than letting the field close on a typo. */
  const commit = (): boolean => {
    if (draft === null) return true;
    const resolved = resolveLengthEntry(draft, domain);
    if (resolved.value === null) {
      setInvalid(true);
      return false;
    }
    // Checked against the SNAPPED value, which is the number that would
    // actually be stored — a limit applied to the raw text would refuse (or
    // admit) a value the field never commits.
    const refusedFor = validate?.(resolved.value) ?? null;
    if (refusedFor) {
      setInvalid(true);
      setRefusal(refusedFor);
      return false;
    }
    setInvalid(false);
    setRefusal(null);
    setDraft(null);
    if (resolved.value !== value) onCommit(resolved.value);
    return true;
  };

  const handleBlur = () => {
    // The return value is deliberately ignored: a failed commit leaves the
    // field red and uncommitted, and that is the whole of the response.
    commit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
      setInvalid(false);
      setRefusal(null);
    }
  };

  return (
    <>
      <input
        type="text"
        inputMode="text"
        id={id}
        title={title}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={entry ? hintId : undefined}
        autoComplete="off"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
          setRefusal(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={invalid ? { ...style, ...INVALID_STYLE } : style}
      />
      {entry && (
        <span
          id={hintId}
          style={entry.value === null ? { ...HINT_STYLE, color: "#c0392b" } : HINT_STYLE}
        >
          {entry.hint}
          {/* The one affordance a field stuck in the invalid state needs,
              now that it no longer holds the caret to explain itself. */}
          {entry.value === null ? " (Esc to revert)" : ""}
        </span>
      )}
      {refusal && (
        // role="alert" because this one is not a live-updating hint: it
        // appears once, on a commit that was turned down, and a screen
        // reader user needs to hear the reason their entry did not take.
        <p role="alert" style={REFUSAL_STYLE}>
          {refusal} (Esc to revert)
        </p>
      )}
    </>
  );
}
