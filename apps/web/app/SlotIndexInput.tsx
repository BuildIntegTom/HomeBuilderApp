"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { resolveSlotIndexEntry } from "./slotIndexEntry";

/**
 * A slot-index field that commits on **blur or Enter**, not per keystroke.
 *
 * `LengthInput`'s shape, deliberately, and for the same reason: a field that
 * commits on every keystroke commits the half-typed states too. On the
 * spanning header's "Spans panels" pair that was not cosmetic —
 *
 * - **clearing the field to retype it** sent `Number("") === 0`, and slot 0 is
 *   a legal index, so the header moved to the first panel on the wall and
 *   nothing refused it;
 * - **re-aiming a range** could dead-end: raise the start first and the range
 *   is momentarily inverted (refused); raise the end first and the span can
 *   exceed the 144in maximum (refused). The intermediate state the user never
 *   meant to commit is the one that gets validated. This branch's own browser
 *   harness had to walk a range one index at a time, alternating ends, to get
 *   around exactly that.
 *
 * With the commit deferred, the whole edit arrives as one number and the
 * validating handler sees only what the user meant.
 *
 * `draft === null` means "not being edited", so the field shows the committed
 * value — a range the app shifted underneath it (an insert, a delete, a load)
 * appears immediately instead of being pinned by stale local state. Escape
 * discards the draft. An unreadable or empty entry **commits nothing** and
 * marks itself invalid: silent substitution is the defect, and a visible gap
 * beats a plausible number.
 */
export interface SlotIndexInputProps {
  /** The committed index. */
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
  title?: string;
  style?: CSSProperties;
}

export default function SlotIndexInput({ value, onCommit, ariaLabel, title, style }: SlotIndexInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const commit = () => {
    if (draft === null) return;
    const resolved = resolveSlotIndexEntry(draft);
    if (resolved === null) {
      // Left red and uncommitted, with the typed text still there to be
      // corrected — the same call LengthInput makes rather than forcing focus
      // back, which would be a trap.
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    if (resolved !== value) onCommit(resolved);
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
    <input
      // `text`, not `number`, for the reason LengthInput documents at length:
      // a number input hands back `""` for anything it dislikes, and the
      // spinner arrows would commit per click anyway.
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      title={title}
      autoComplete="off"
      spellCheck={false}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        setInvalid(false);
      }}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      style={{ ...style, ...(invalid ? { outline: "2px solid #c0392b" } : {}) }}
    />
  );
}
