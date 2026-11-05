"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { PanelSlotType, PanelTypeChoice, StoredPanelMemberSpec } from "@building-integrity/geometry";
import {
  type EditorOpResult,
  type PanelMember,
  type PanelRecipe,
  SNAP_TOLERANCE_IN,
  deleteMemberSpec,
  dragMemberSpec,
  duplicateMemberSpec,
  editorClearArea,
  newEditorMemberId,
  setMemberNominalSize,
  setMemberWythe,
  newDiagonalSpec,
  newHorizontalSpec,
  newVerticalSpec,
  overlappingMemberPairs,
  recipeConflicts,
  rotateSpec,
  specAnchorLengthIn,
  specAngleDeg,
} from "@building-integrity/panel-catalog";
import PanelMembersGroup from "./PanelMembersGroup";
import LengthInput from "./LengthInput";
import { PANEL_TYPE_LABELS } from "./panelColors";
import { toAddedMemberSpecs } from "./standardPanelMembers";

/**
 * **THE PANEL EDITOR — B19's last stride, 2026-11-03.**
 *
 * > *"Right click should have an option to go to a panel editor. An editor all
 * > for editing that panel. It should be possible to turn it into any other
 * > panel, as well as recategorize it or name it. This panel editor isolates
 * > the panel in question in its own 3d framed view and the left bar is
 * > dedicated to having options such as change panel type, add diagonal, add
 * > vertical, add horizontal. ... If you right click on a member in the panel
 * > editor, you get a selection to change it to anything. Left bar also has an
 * > option to rotate 90 or custom degrees."* — Tommy, 2026-11-02
 *
 * ⚠ **Every edit commits immediately — there is no Save.** That is the app's
 * own editing model: *"tile only on first draw, everything after is direct
 * manipulation"*. A Save button would introduce a second, contradictory one,
 * and a draft that can be abandoned is a draft that can be lost.
 *
 * ⚠ **It edits a LIST OF SPECS, not the members on screen.** The 3D view is
 * rendered from `members`, which the page derives from the slot through the one
 * seam every other consumer reads (`standardPanelMembersFor`) — so what the
 * editor shows is the same panel the cut list cuts and the exporter exports,
 * never a private copy of it.
 */

const IN_PER_FT = 12;

/** How far one press of a move button shifts a board. Half a 2x4's width, so
 * two presses clear a stud and one press is still fine enough to walk a board
 * into a snap. */
const EDITOR_NUDGE_IN = 1.75;
/* The camera rule is `StandardPanel3DView`'s, and deliberately the same
   numbers: a panel isolated in 3D should look the way it looks on its own shop
   drawing. See that file for why -62deg rather than -35. */
const ELEVATION_DEG = 28;
const AZIMUTH_DEG = -62;
const SELECTED_COLOR = "#1f7ae0";

export interface PanelEditorBodyProps {
  /** The panel's generated series name — `W12`, `H1`. Not editable: a shop
   * finds the panel on the drawing by this. */
  seriesLabel: string;
  panelType: PanelSlotType;
  panel: { widthIn: number; depthIn: number; heightIn: number };
  /** The panel exactly as the rest of the app sees it. */
  members: PanelMember[];
  /**
   * The added-member list this panel effectively has: its own stored list if it
   * has been edited, otherwise the one its pattern derives. Seeding from the
   * pattern is what makes the first edit non-destructive — see
   * `PanelSlot.editedMembers`.
   */
  specs: StoredPanelMemberSpec[];
  /** True when this panel has its own stored list, i.e. it has been edited. */
  isEdited: boolean;
  /** False for a panel whose members do not come through the recipe seam — a
   * window, a corner, a column. Those can still be renamed and retyped. */
  canEditMembers: boolean;
  /** Why not, in words, when `canEditMembers` is false. */
  memberEditRefusal?: string;
  panelName?: string;
  typeChoices: PanelTypeChoice[];
  onSetSpecs: (next: StoredPanelMemberSpec[] | undefined) => void;
  onSetPanelName: (name: string | undefined) => void;
  onChangeType: (type: PanelSlotType) => void;
}

/* ⚠ **Narrow enough that the panel and the bar both fit a note that has not
   been expanded.** At 268 they did not: a StickyNote's content is ~538px wide,
   the bar took 282 of it with its gap, and the 3D view's own 320px minimum
   pushed it onto a second row BELOW the fold — a panel editor you have to
   scroll to see the panel in. The view is given room to shrink for the same
   reason. Expanding the note is still the comfortable way to work in here. */
const BAR_WIDTH_PX = 236;

function describeSpec(spec: StoredPanelMemberSpec): string {
  const lengthIn = specAnchorLengthIn(spec);
  const angleDeg = Math.abs(specAngleDeg(spec));
  const run = angleDeg > 89.9 && angleDeg < 90.1 ? "vertical" : angleDeg < 0.1 || angleDeg > 179.9 ? "horizontal" : `${angleDeg.toFixed(1)}°`;
  return `${spec.kind === "diagonal" ? "Diagonal" : "Straight"} · ${run} · ${lengthIn.toFixed(2)}″ · ${spec.wythe}`;
}

export default function PanelEditorBody({
  seriesLabel,
  panelType,
  panel,
  members,
  specs,
  isEdited,
  canEditMembers,
  memberEditRefusal,
  panelName,
  typeChoices,
  onSetSpecs,
  onSetPanelName,
  onChangeType,
}: PanelEditorBodyProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wythe, setWythe] = useState<"exterior" | "interior">("exterior");
  const [customRotateDeg, setCustomRotateDeg] = useState(15);
  const [rotateNotice, setRotateNotice] = useState<string | null>(null);
  /** What the last stride-2 op had to say — a refusal's reason, or the notice
   * that a dragged brace became a nailer. */
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const [showStraw, setShowStraw] = useState(false);

  const area = useMemo(() => editorClearArea(panel), [panel]);
  const selected = specs.find((s) => s.id === selectedId) ?? null;

  /* ⚠ The overlap check runs on the REAL members, not on the specs — the specs
     are centrelines and a diagonal's real board is a trapezoid grown around
     one. `overlappingMemberPairs` compares the true prisms, which is what his
     *no overlapping members* rule is enforced by everywhere else in the app. */
  const overlaps = useMemo(() => overlappingMemberPairs(members), [members]);
  const conflicts = useMemo(
    () => recipeConflicts({ name: seriesLabel, ...panel, added: toAddedMemberSpecs(specs) }),
    [seriesLabel, panel, specs],
  );

  const replace = (next: StoredPanelMemberSpec) => onSetSpecs(specs.map((s) => (s.id === next.id ? next : s)));

  const add = (make: typeof newDiagonalSpec) => {
    const spec = make(panel, { wythe, existing: members });
    onSetSpecs([...specs, spec]);
    setSelectedId(spec.id);
    setRotateNotice(null);
  };

  /**
   * ⚠ **Every stride-2 action goes through one runner, and through the
   * catalog's pure ops — 2026-11-05.**
   *
   * The ops take a recipe and hand back a recipe plus a verdict. Running them
   * here rather than reimplementing the rules in the component is the whole
   * point: the snapping, the retype and the overlap refusal are rules about
   * the building, and a second copy of them living in a React file is how the
   * editor and the shop sheet come to disagree about what a panel is.
   *
   * A refused op changes NOTHING — `out.recipe` is the recipe it was given —
   * and its reason goes on screen.
   */
  const runOp = (op: (recipe: PanelRecipe) => EditorOpResult) => {
    const out = op({ name: seriesLabel, ...panel, added: toAddedMemberSpecs(specs) });
    setMemberNotice(out.message);
    if (!out.accepted) return;
    onSetSpecs(out.recipe.added as StoredPanelMemberSpec[]);
    if (!out.recipe.added.some((s) => s.id === selectedId)) setSelectedId(null);
  };

  /** His answer on the drag, applied to a keyboard/button nudge: the move goes
   * through the SAME pipeline a pointer drag will — translate, snap to the
   * neighbours' faces, retype if it lands on an axis, refuse if it overlaps. */
  const nudge = (dxIn: number, dzIn: number) => {
    if (!selectedId) return;
    runOp((recipe) => dragMemberSpec(recipe, selectedId, dxIn, dzIn));
  };

  const rotate = (deg: number) => {
    if (!selected) return;
    const { spec, shortenedByIn } = rotateSpec(toAddedMemberSpecs([selected])[0]!, deg, area);
    replace(spec);
    setRotateNotice(
      shortenedByIn > 0.01
        ? `Rotated ${deg}° and shortened ${shortenedByIn.toFixed(2)}″ to fit — the angle is kept, the length gives way.`
        : null,
    );
  };

  const widthFt = panel.widthIn / IN_PER_FT;
  const heightFt = panel.heightIn / IN_PER_FT;
  const depthFt = panel.depthIn / IN_PER_FT;
  const centre: [number, number, number] = [widthFt / 2, heightFt / 2, depthFt / 2];
  const maxDim = Math.max(widthFt, heightFt, depthFt);
  const distance = maxDim * 1.7;
  const elevationRad = (ELEVATION_DEG * Math.PI) / 180;
  const azimuthRad = (AZIMUTH_DEG * Math.PI) / 180;
  const cameraPosition: [number, number, number] = [
    centre[0] + distance * Math.cos(elevationRad) * Math.cos(azimuthRad),
    centre[1] + distance * Math.sin(elevationRad),
    centre[2] + distance * Math.cos(elevationRad) * Math.sin(azimuthRad),
  ];

  const selectedMembers = selected ? members.filter((m) => m.memberId === selected.id) : [];
  const otherMembers = selected ? members.filter((m) => m.memberId !== selected.id) : members;

  const sectionHeading = (text: string) => (
    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6, margin: "12px 0 4px" }}>{text}</div>
  );

  const barButton = (label: string, onClick: () => void, opts: { disabled?: boolean; title?: string } = {}) => (
    <button
      type="button"
      onClick={onClick}
      disabled={opts.disabled}
      title={opts.title}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "5px 8px",
        marginBottom: 3,
        font: "inherit",
        fontSize: 13,
        cursor: opts.disabled ? "not-allowed" : "pointer",
        opacity: opts.disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch", flexWrap: "nowrap" }}>
      {/* ───────────────────────── the left bar ───────────────────────── */}
      <div style={{ width: BAR_WIDTH_PX, flex: "0 0 auto", maxHeight: "72vh", overflowY: "auto", paddingRight: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{seriesLabel}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {PANEL_TYPE_LABELS[panelType]} · {panel.widthIn.toFixed(2)}″ × {panel.heightIn.toFixed(2)}″ × {panel.depthIn.toFixed(2)}″
        </div>

        {sectionHeading("Name this panel")}
        <input
          type="text"
          value={panelName ?? ""}
          placeholder={seriesLabel}
          aria-label="Panel name"
          onChange={(e) => onSetPanelName(e.target.value.trim() === "" ? undefined : e.target.value)}
          style={{ width: "100%", font: "inherit", fontSize: 13, padding: "4px 6px" }}
        />
        <p style={{ fontSize: 11, opacity: 0.65, margin: "4px 0 0" }}>
          Shown alongside <strong>{seriesLabel}</strong>, not instead of it — a shop finds the panel on the drawing by its series
          name.
        </p>

        {sectionHeading("Change panel type")}
        <select
          value={panelType}
          aria-label="Panel type"
          onChange={(e) => onChangeType(e.target.value as PanelSlotType)}
          style={{ width: "100%", font: "inherit", fontSize: 13, padding: "3px 4px" }}
        >
          {typeChoices.map((choice) => (
            <option key={choice.type} value={choice.type} disabled={!choice.allowed && !choice.current} title={choice.reason}>
              {PANEL_TYPE_LABELS[choice.type]}
              {choice.allowed || choice.current ? "" : " — not here"}
            </option>
          ))}
        </select>

        {sectionHeading("Add a member")}
        {canEditMembers ? (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, fontSize: 12 }}>
              {(["exterior", "interior"] as const).map((face) => (
                <label key={face} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="radio" name="panel-editor-wythe" checked={wythe === face} onChange={() => setWythe(face)} />
                  {face === "exterior" ? "Exterior face" : "Interior face"}
                </label>
              ))}
            </div>
            {barButton("Add diagonal", () => add(newDiagonalSpec), { title: "Corner to corner of the clear area, mitred both ends." })}
            {barButton("Add vertical", () => add(newVerticalSpec), { title: "A stud standing in the widest clear bay." })}
            {barButton("Add horizontal", () => add(newHorizontalSpec), { title: "A tie lying in the widest clear bay." })}
            <p style={{ fontSize: 11, opacity: 0.65, margin: "4px 0 0" }}>
              A new board lands in the widest clear run on the face you picked, so it does not start out inside something else.
              Added members sit <em>inside</em> the panel&apos;s depth, in a groove routed out of the straw.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 12, color: "#8a5a00", margin: 0 }}>{memberEditRefusal}</p>
        )}

        {sectionHeading(`Members (${specs.length})`)}
        {specs.length === 0 ? (
          <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>Nothing added. This is the base panel as it comes off the table.</p>
        ) : (
          specs.map((spec) => (
            <div key={spec.id} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 2 }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(spec.id === selectedId ? null : spec.id);
                  setRotateNotice(null);
                }}
                aria-pressed={spec.id === selectedId}
                style={{
                  flex: 1,
                  textAlign: "left",
                  font: "inherit",
                  fontSize: 12,
                  padding: "4px 6px",
                  cursor: "pointer",
                  background: spec.id === selectedId ? SELECTED_COLOR : "transparent",
                  color: spec.id === selectedId ? "#fff" : "inherit",
                  border: "1px solid rgba(0,0,0,0.2)",
                  borderRadius: 3,
                }}
              >
                {describeSpec(spec)}
              </button>
              <button
                type="button"
                aria-label={`Delete ${describeSpec(spec)}`}
                title="Delete this member"
                onClick={() => {
                  onSetSpecs(specs.filter((s) => s.id !== spec.id));
                  if (selectedId === spec.id) setSelectedId(null);
                }}
                style={{ font: "inherit", fontSize: 12, cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          ))
        )}

        {selected && (
          <>
            {sectionHeading("Selected member")}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 6px", alignItems: "center", fontSize: 12 }}>
              <span>From x</span>
              <LengthInput
                value={selected.fromXIn}
                domain="in"
                ariaLabel="Selected member from x"
                onCommit={(v) => replace({ ...selected, fromXIn: v })}
              />
              <span>From z</span>
              <LengthInput
                value={selected.fromZIn}
                domain="in"
                ariaLabel="Selected member from z"
                onCommit={(v) => replace({ ...selected, fromZIn: v })}
              />
              <span>To x</span>
              <LengthInput
                value={selected.toXIn}
                domain="in"
                ariaLabel="Selected member to x"
                onCommit={(v) => replace({ ...selected, toXIn: v })}
              />
              <span>To z</span>
              <LengthInput
                value={selected.toZIn}
                domain="in"
                ariaLabel="Selected member to z"
                onCommit={(v) => replace({ ...selected, toZIn: v })}
              />
            </div>
            <p style={{ fontSize: 11, opacity: 0.65, margin: "4px 0 6px" }}>
              x runs across the panel from its left edge, z up from its bottom. The clear area is x {area.minXIn.toFixed(2)}″–
              {area.maxXIn.toFixed(2)}″, z {area.minZIn.toFixed(2)}″–{area.maxZIn.toFixed(2)}″ — between the posts and the plate
              faces.
            </p>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, fontSize: 12 }}>
              {(["exterior", "interior"] as const).map((face) => (
                <label key={face} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="radio"
                    name="panel-editor-selected-wythe"
                    checked={selected.wythe === face}
                    onChange={() => replace({ ...selected, wythe: face })}
                  />
                  {face === "exterior" ? "Exterior" : "Interior"}
                </label>
              ))}
            </div>
            {sectionHeading("Move it")}
            <p style={{ fontSize: 11, opacity: 0.65, margin: "0 0 4px" }}>
              Snaps flush to a neighbour&apos;s face if one is within {SNAP_TOLERANCE_IN}″, and to the ⅛″ grid
              otherwise. A move that would put two boards through each other is refused.
            </p>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              {barButton("←", () => nudge(-EDITOR_NUDGE_IN, 0), { title: `Left ${EDITOR_NUDGE_IN}″` })}
              {barButton("→", () => nudge(EDITOR_NUDGE_IN, 0), { title: `Right ${EDITOR_NUDGE_IN}″` })}
              {barButton("↓", () => nudge(0, -EDITOR_NUDGE_IN), { title: `Down ${EDITOR_NUDGE_IN}″` })}
              {barButton("↑", () => nudge(0, EDITOR_NUDGE_IN), { title: `Up ${EDITOR_NUDGE_IN}″` })}
            </div>

            {sectionHeading("This member")}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
              {barButton("Duplicate", () => runOp((r) => duplicateMemberSpec(r, selected.id, newEditorMemberId())), {
                title: "Drop an identical board beside this one",
              })}
              {barButton("Delete", () => runOp((r) => deleteMemberSpec(r, selected.id)), {
                title: "Take this board out of the panel",
              })}
              {barButton(
                selected.kind === "straight" && selected.nominalSize === "2x6" ? "Make it a 2x4" : "Make it a 2x6",
                () =>
                  runOp((r) =>
                    setMemberNominalSize(r, selected.id, selected.kind === "straight" && selected.nominalSize === "2x6" ? "2x4" : "2x6"),
                  ),
                {
                  disabled: selected.kind === "diagonal",
                  title:
                    selected.kind === "diagonal"
                      ? "A brace's mitres and cut length are built on the 2x4 brace geometry — resizing one is a building decision, not a menu item."
                      : "Swap this board between 2x4 and 2x6",
                },
              )}
              {barButton(
                selected.wythe === "exterior" ? "Send to interior face" : "Send to exterior face",
                () => runOp((r) => setMemberWythe(r, selected.id, selected.wythe === "exterior" ? "interior" : "exterior")),
                { title: "Move it through the panel's depth to the other face" },
              )}
            </div>
            {memberNotice && (
              <p style={{ fontSize: 11, color: "#a33", margin: "0 0 6px" }} role="status">
                {memberNotice}
              </p>
            )}

            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              {barButton("Rotate 90°", () => rotate(90))}
              {barButton("Rotate −90°", () => rotate(-90))}
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
              <input
                type="number"
                value={customRotateDeg}
                aria-label="Custom rotation in degrees"
                onChange={(e) => setCustomRotateDeg(Number(e.target.value))}
                style={{ width: 64, font: "inherit", fontSize: 12 }}
              />
              <span>°</span>
              {barButton("Rotate", () => rotate(customRotateDeg))}
            </div>
            {rotateNotice !== null && <p style={{ fontSize: 11, color: "#8a5a00", margin: "2px 0 0" }}>{rotateNotice}</p>}
            <p style={{ fontSize: 11, opacity: 0.65, margin: "6px 0 0" }}>
              A straight board rotated off an axis becomes a diagonal — the two are different cuts, not two labels, so it is
               retyped rather than drawn in the wrong place.
            </p>
          </>
        )}

        {sectionHeading("This panel")}
        {barButton(
          isEdited ? "Revert to the derived pattern" : "Not edited — nothing to revert",
          () => {
            onSetSpecs(undefined);
            setSelectedId(null);
          },
          {
            disabled: !isEdited,
            title: isEdited
              ? "Drop this panel's own member list and go back to whatever its brace pattern derives."
              : "This panel still follows its brace pattern.",
          },
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 6 }}>
          <input type="checkbox" checked={showStraw} onChange={(e) => setShowStraw(e.target.checked)} />
          Show straw fill
        </label>

        {(overlaps.length > 0 || conflicts.length > 0) && (
          <>
            {sectionHeading("Refused by the panel")}
            {conflicts.map((message) => (
              <p key={message} style={{ fontSize: 12, color: "#c0392b", margin: "0 0 6px" }}>
                {message}
              </p>
            ))}
            {overlaps.length > 0 && (
              <p style={{ fontSize: 12, color: "#c0392b", margin: 0 }}>
                {overlaps.length} overlapping member {overlaps.length === 1 ? "pair" : "pairs"}: {overlaps.join(", ")}. Two boards
                cannot be in one place.
              </p>
            )}
          </>
        )}
      </div>

      {/* ──────────────────── the isolated 3D framed view ──────────────── */}
      <div style={{ flex: "1 1 260px", minWidth: 200, minHeight: "min(60vh, 420px)", border: "1px solid #ccc" }}>
        <Canvas camera={{ position: cameraPosition, fov: 45, near: 0.01, far: 1000 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[maxDim, maxDim * 2, maxDim]} intensity={0.8} />
          {showStraw && (
            <mesh position={centre}>
              <boxGeometry args={[widthFt, heightFt, depthFt]} />
              <meshStandardMaterial color="#e0c458" transparent opacity={0.35} />
            </mesh>
          )}
          <PanelMembersGroup members={otherMembers} />
          {/* ⚠ The selected member is its OWN group so it can take
              `colorOverride` — `PanelMembersGroup` colours a whole group, and
              a per-member colour would mean changing a component five other
              views share for the sake of one. Two groups cost nothing. */}
          {selectedMembers.length > 0 && <PanelMembersGroup members={selectedMembers} colorOverride={SELECTED_COLOR} />}
          <OrbitControls target={centre} makeDefault />
        </Canvas>
      </div>
    </div>
  );
}
