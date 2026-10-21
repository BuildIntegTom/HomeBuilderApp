"use client";

import { useState } from "react";
import {
  octagonMeasures,
  setFlatToFlat,
  setMiteredWall,
  setRegularFlatToFlat,
  setRegularPointToPoint,
  setStraightWall,
  type OctagonBox,
  type OctagonResize,
  type OctagonWallGroup,
} from "@building-integrity/geometry";
import { resolveLengthEntry } from "./canvasGeometry";

/**
 * SIZING AN OCTAGON BY ITS OWN NUMBERS — Tommy, 2026-10-20:
 *
 * > *"Octagons are now very difficult to edit the size of... Can we add a left
 * > sidebar button when an octagon is drawn to edit the diameter (point to
 * > point and flat to flat) and also size of each wall that shares the same
 * > size."*
 *
 * Every field here commits through `octagonSize.ts`, which SOLVES for the
 * `W x D` box rather than adding a stale clip to a typed length. That is the
 * fix for the "weird numbers": typing 16 into a 40x24 octagon's side wall used
 * to give back 12.46 and quietly move the opposite wall three and a half feet.
 *
 * ⚠ **The panel tells the truth about the coupling instead of hiding it.** An
 * octagon has exactly two degrees of freedom, so the three wall groups cannot
 * be set independently — fixing the mitered walls fixes `clip`, which fixes
 * `min(W, D)`, which moves whichever straight group sits on that axis. Each
 * field says what else it will move BEFORE it is committed, because "panels
 * that shouldn't be changing values" is precisely the complaint this panel
 * exists to answer, and a control that moved them silently would be the same
 * bug with a nicer front end.
 */

const GROUP_LABEL: Record<OctagonWallGroup, string> = {
  straightWidth: "top & bottom walls",
  straightDepth: "left & right walls",
  mitered: "the four corner walls",
};

export interface OctagonSizePanelProps {
  box: OctagonBox;
  /** Commits a new box. The caller rebuilds the footprint and resizes panels —
   * this component never touches a footprint itself. */
  onChange: (next: OctagonBox) => void;
}

/** One labelled length field. Holds its own draft text so a half-typed entry
 * is never committed, and shows the parser's own resolved hint — the same
 * `resolveLengthEntry` every other length field in the app uses, so `20 1/2`
 * means the same thing here as it does on a wall. */
function LengthField({
  label,
  valueFt,
  onCommit,
  note,
  disabled,
}: {
  label: string;
  valueFt: number;
  onCommit: (ft: number) => void;
  note?: string;
  disabled?: boolean;
}) {
  /**
   * The half-typed entry, TAGGED with the value it was typed against.
   *
   * ⚠ Tagged rather than cleared by an effect. Editing one field moves the
   * others, so a draft has to be dropped when the shape changes underneath it
   * — and the obvious `useEffect(() => setDraft(null), [valueFt])` is a
   * `react-hooks/set-state-in-effect`, a rule AGENTS.md says may never rise
   * because it tracks correctness. It cost two the first time this panel was
   * written. Comparing the tag during render does the same job with no effect
   * and no extra render: a draft whose tag no longer matches is simply
   * ignored.
   */
  const [draft, setDraft] = useState<{ text: string; forValueFt: number } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const draftText = draft !== null && draft.forValueFt === valueFt ? draft.text : null;

  const shown = draftText ?? formatFt(valueFt);
  const resolved = draftText === null ? null : resolveLengthEntry(draftText, "ft");

  const commit = () => {
    if (draftText === null) return;
    const entry = resolveLengthEntry(draftText, "ft");
    if (entry.value === null || entry.value <= 0) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    onCommit(entry.value);
  };

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11, color: "#444" }}>
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        disabled={disabled}
        onChange={(e) => {
          setDraft({ text: e.target.value, forValueFt: valueFt });
          setInvalid(false);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(null);
            setInvalid(false);
          }
        }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "4px 6px",
          fontSize: 12,
          border: `1px solid ${invalid ? "#c0392b" : "#ccc"}`,
          borderRadius: 4,
          background: disabled ? "#f4f4f4" : "#fff",
        }}
      />
      {invalid && <span style={{ color: "#c0392b" }}>Didn&apos;t understand that length</span>}
      {!invalid && resolved && <span style={{ color: "#777" }}>{resolved.hint}</span>}
      {!invalid && !resolved && note && <span style={{ color: "#8a6d1f" }}>{note}</span>}
    </label>
  );
}

/** Feet with up to two decimals, trailing zeros dropped — compact enough for a
 * 240px sidebar column, and re-parsed by the same entry parser on commit. */
function formatFt(valueFt: number): string {
  return String(Math.round(valueFt * 100) / 100);
}

/** "also moves the top & bottom walls and the four corner walls" */
function alsoMovesNote(groups: OctagonWallGroup[]): string | undefined {
  if (groups.length === 0) return undefined;
  const names = groups.map((g) => GROUP_LABEL[g]);
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]!}`;
  return `also moves ${list}`;
}

export default function OctagonSizePanel({ box, onChange }: OctagonSizePanelProps) {
  const m = octagonMeasures(box);
  /**
   * Whether the user has ASKED for a regular octagon. Whether they are getting
   * one is `m.isRegular`, read off the shape.
   *
   * ⚠ The lock is the AND of the two, derived during render. An octagon made
   * irregular by some other edit must stop claiming it is locked, and doing
   * that with `useEffect(() => { if (!m.isRegular) setKeepRegular(false) })`
   * is a `set-state-in-effect` — the correctness rule that may never rise.
   * Deriving it needs no effect and cannot get out of step with the shape,
   * which an effect can for one render.
   */
  const [wantsRegular, setWantsRegular] = useState(m.isRegular);
  const keepRegular = wantsRegular && m.isRegular;

  const commit = (r: OctagonResize) => onChange(r.box);

  /**
   * What a given edit WOULD move, computed without committing.
   *
   * ⚠ Probed with a ONE INCH nudge rather than a large fraction of the current
   * value. The consequence can depend on magnitude — a big enough edit flips
   * which axis is the shorter one, and with it which group `clip` is tied to —
   * so a note derived from a 10% change would describe an edit the user has
   * not typed. An inch describes the field as it sits.
   */
  const NUDGE_FT = 1 / 12;
  const preview = (fn: (nudged: number) => OctagonResize, fromFt: number): string | undefined =>
    alsoMovesNote(fn(fromFt + NUDGE_FT).alsoMoves);

  return (
    <div
      role="group"
      aria-label="Octagon size"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        padding: 8,
        boxSizing: "border-box",
        border: "1px solid #ddd",
        borderRadius: 6,
        background: "#fcfcfb",
      }}
    >
      <strong style={{ fontSize: 12 }}>Octagon Size</strong>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#444" }}>
        <input
          type="checkbox"
          checked={keepRegular}
          onChange={(e) => {
            setWantsRegular(e.target.checked);
            // Turning the lock ON squares the box immediately, so the state and
            // the shape never disagree about what "regular" means.
            if (e.target.checked && !m.isRegular) {
              commit(setRegularFlatToFlat(Math.max(box.widthFt, box.depthFt)));
            }
          }}
        />
        Regular octagon (all eight walls equal)
      </label>

      {keepRegular ? (
        <>
          <LengthField
            label="Across the flats"
            valueFt={m.flatToFlatWidthFt}
            onCommit={(ft) => commit(setRegularFlatToFlat(ft))}
          />
          <LengthField
            label="Across the corners"
            valueFt={m.pointToPointAcrossWidthFt}
            onCommit={(ft) => commit(setRegularPointToPoint(ft))}
          />
          <LengthField
            label="Each wall (all eight)"
            valueFt={m.straightWidthWallFt}
            onCommit={(ft) => commit(setRegularFlatToFlat(ft / (1 - 2 * (1 - 1 / Math.SQRT2))))}
          />
          <span style={{ fontSize: 10, color: "#777", lineHeight: 1.35 }}>
            The eight walls come out equal to within about ¼in — a 45° wall between two ⅛in grid points has no exact
            length, and the residual is absorbed at the mitered corner joint.
          </span>
        </>
      ) : (
        <>
          <LengthField
            label="Across the flats — width"
            valueFt={m.flatToFlatWidthFt}
            onCommit={(ft) => commit(setFlatToFlat(box, "width", ft))}
            note={preview((v) => setFlatToFlat(box, "width", v), m.flatToFlatWidthFt)}
          />
          <LengthField
            label="Across the flats — depth"
            valueFt={m.flatToFlatDepthFt}
            onCommit={(ft) => commit(setFlatToFlat(box, "depth", ft))}
            note={preview((v) => setFlatToFlat(box, "depth", v), m.flatToFlatDepthFt)}
          />

          <div style={{ borderTop: "1px solid #e4e4e0", paddingTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#444" }}>Walls that share a size</span>
            <LengthField
              label="Top & bottom (2)"
              valueFt={m.straightWidthWallFt}
              onCommit={(ft) => commit(setStraightWall(box, "straightWidth", ft))}
              note={preview((v) => setStraightWall(box, "straightWidth", v), m.straightWidthWallFt)}
            />
            <LengthField
              label="Left & right (2)"
              valueFt={m.straightDepthWallFt}
              onCommit={(ft) => commit(setStraightWall(box, "straightDepth", ft))}
              note={preview((v) => setStraightWall(box, "straightDepth", v), m.straightDepthWallFt)}
            />
            <LengthField
              label="Corner walls (4)"
              valueFt={m.miteredWallFt}
              onCommit={(ft) => commit(setMiteredWall(box, ft))}
              note={preview((v) => setMiteredWall(box, v), m.miteredWallFt)}
            />
          </div>

          <span style={{ fontSize: 10, color: "#777", lineHeight: 1.35 }}>
            Across the corners: {formatFt(m.pointToPointAcrossWidthFt)}ft one way,{" "}
            {formatFt(m.pointToPointAcrossDepthFt)}ft the other. An elongated octagon has two, so there is no single
            diameter to type — tick Regular above to set one.
          </span>
        </>
      )}
    </div>
  );
}
