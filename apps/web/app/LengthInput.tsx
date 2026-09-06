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
   * `value`. Never called for an unparseable entry. */
  onCommit: (next: number) => void;
  id?: string;
  title?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

const INVALID_STYLE: CSSProperties = { outline: "2px solid #c0392b", outlineOffset: 0 };

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
    setInvalid(false);
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
    </>
  );
}
