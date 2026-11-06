"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import type { PanelSlotType, PanelTypeChoice, StoredPanelMemberSpec } from "@building-integrity/geometry";
import {
  type EditorOpResult,
  type PanelMember,
  type PanelRecipe,
  EDITOR_GRID_IN,
  SNAP_TOLERANCE_IN,
  deleteMemberSpec,
  dragMemberSpec,
  duplicateMemberSpec,
  editorClearArea,
  newEditorMemberId,
  setMemberNominalSize,
  setMemberOnEdge,
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
import { MemberContextMenu, type MemberContextMenuTarget, type MemberMenuAction } from "./MemberContextMenu";
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
  /* ⚠ The SIZE and the SEATING are both on the label, because B30 made them
     two independent things: a board can be a 2x6 and still only 1.5in into the
     panel. A label that named one and not the other would make the other look
     like it had no setting. */
  const size = spec.kind === "straight" ? ` · ${spec.nominalSize ?? "2x4"}${spec.onEdge === true ? " on edge" : " flat"}` : "";
  return `${spec.kind === "diagonal" ? "Diagonal" : "Straight"} · ${run} · ${lengthIn.toFixed(2)}″ · ${spec.wythe}${size}`;
}

/**
 * **A POINTER DRAG IN PROGRESS — B30's half of the 3D member hit test.**
 *
 * The grab point and the plane it is dragged on, both in the scene's own feet,
 * plus the delta so far in inches. The board is NOT moved while the pointer is
 * down: `dragMemberSpec` is run once, on release, which is what makes his
 * *"refuse the drop and snap back"* answer the literal behaviour rather than a
 * description of it. What follows the cursor meanwhile is the selected
 * member's real geometry in a translated group — the same renderer, so the
 * preview cannot show a shape the panel would not build.
 */
interface MemberDragState {
  specId: string;
  grabXFt: number;
  grabYFt: number;
  /** The depth the grab landed at. The drag runs in the panel's own
   * width/height plane THROUGH that point, so a board stays on its own wythe
   * however the camera is orbited. */
  planeZFt: number;
  dxIn: number;
  dzIn: number;
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
  const [drag, setDrag] = useState<MemberDragState | null>(null);
  const [menu, setMenu] = useState<MemberContextMenuTarget | null>(null);

  /**
   * ⚠ **The drag always ends, even when the pointer comes up somewhere the
   * scene cannot see.** The drag plane's own `onPointerUp` is what COMMITS;
   * this is the release that happens off the canvas entirely — out of the
   * window, over the left bar — and it cancels rather than committing, because
   * a drop whose landing point was never measured is not a drop.
   *
   * Registered once rather than while dragging: `setDrag` is stable, so there
   * is nothing to re-subscribe for, and a listener added on every pointer-move
   * is a listener added sixty times a second. Canvas handlers run before this
   * one — the event reaches the canvas first and bubbles to the window — so a
   * release over the panel still commits before this clears it.
   */
  useEffect(() => {
    const onUp = () => setDrag(null);
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, []);

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

  /**
   * ⚠ **One list of member actions, two doors onto it** — the left bar and the
   * right-click menu both render this. The claim that the menu is *"a second
   * door, not a second set of rules"* is only true if there is literally one
   * list, so there is.
   */
  const memberActions = (spec: StoredPanelMemberSpec): MemberMenuAction[] => {
    const isStraight = spec.kind === "straight";
    const onEdge = spec.onEdge === true;
    const is2x6 = isStraight && spec.nominalSize === "2x6";
    return [
      {
        key: "duplicate",
        label: "Duplicate",
        enabled: true,
        title: "Drop an identical board beside this one",
        onPick: () => runOp((r) => duplicateMemberSpec(r, spec.id, newEditorMemberId())),
      },
      {
        key: "delete",
        label: "Delete",
        enabled: true,
        title: "Take this board out of the panel",
        onPick: () => runOp((r) => deleteMemberSpec(r, spec.id)),
      },
      {
        key: "size",
        label: is2x6 ? "Make it a 2x4" : "Make it a 2x6",
        enabled: isStraight,
        title: isStraight
          ? "Swap this board between 2x4 and 2x6. Laid flat it reaches 1.5″ into the panel either way, so the size is free of the depth."
          : "A brace's mitres and cut length are built on the 2x4 brace geometry — resizing one is a building decision, not a menu item.",
        onPick: () => runOp((r) => setMemberNominalSize(r, spec.id, is2x6 ? "2x4" : "2x6")),
      },
      {
        key: "seating",
        label: onEdge ? "Lay it flat" : "Stand it on edge",
        enabled: isStraight,
        title: isStraight
          ? onEdge
            ? "Turn it back flat against the face — 1.5″ into the panel, wide face out."
            : `Turn it 90° in plan so its wide face runs through the depth. Refused if it would run into the girt — a 2x6 on edge reaches 5.5″ in, and the girt web lies across the middle of a ${panel.depthIn.toFixed(2)}″ panel.`
          : "A brace is let into the straw on one flat inset, and its mitres are cut for that seating.",
        onPick: () => runOp((r) => setMemberOnEdge(r, spec.id, !onEdge)),
      },
      {
        key: "wythe",
        label: spec.wythe === "exterior" ? "Send to interior face" : "Send to exterior face",
        enabled: true,
        title: "Move it through the panel's depth to the other face",
        onPick: () => runOp((r) => setMemberWythe(r, spec.id, spec.wythe === "exterior" ? "interior" : "exterior")),
      },
      {
        key: "rot90",
        label: "Rotate 90° in the wall",
        enabled: true,
        title: "Swing it about its own midpoint within the panel's face — a vertical becomes a horizontal. Not the same as standing it on edge.",
        onPick: () => rotate(90),
      },
    ];
  };

  /** Which of the panel's boards this editor can act on: the ones it added. A
   * base member — a plate, a girt, a corner post — is pickable in 3D and says
   * so rather than silently doing nothing, because "the click did not land" and
   * "that board is not yours to move" are different problems. */
  const specFor = (memberId: string): StoredPanelMemberSpec | undefined => specs.find((s) => s.id === memberId);

  /**
   * **ONE handler for both gestures — B30.**
   *
   * Left button grabs the board; the secondary button raises its menu. They
   * share a path on purpose: see `PanelMembersGroup`'s own note for why
   * `onContextMenu` is not used, and note what the sharing buys here — the
   * menu and the drag cannot disagree about which board the pointer was on,
   * because there is only one answer to read.
   */
  const onMemberPointerDown = (memberId: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setMenu(null);
    setRotateNotice(null);
    const spec = specFor(memberId);
    const secondary = e.button === 2;
    if (!spec) {
      setSelectedId(null);
      setMemberNotice(
        secondary
          ? `${memberId} is part of the base panel — there is nothing on the menu that applies to it.`
          : `${memberId} is part of the base panel — the editor moves the members it added. Add one, or edit the panel's type.`,
      );
      return;
    }
    setSelectedId(spec.id);
    setMemberNotice(null);
    if (secondary) {
      setMenu({
        clientX: e.nativeEvent.clientX,
        clientY: e.nativeEvent.clientY,
        heading: describeSpec(spec),
        actions: memberActions(spec),
      });
      return;
    }
    /* Middle button and anything else: select, but do not pick the board up.
       A drag the user cannot finish with the button they started it with is a
       board stuck to the cursor. */
    if (e.button !== 0) return;
    setDrag({ specId: spec.id, grabXFt: e.point.x, grabYFt: e.point.y, planeZFt: e.point.z, dxIn: 0, dzIn: 0 });
  };

  /**
   * ⚠ **A drag shorter than one grid step is a CLICK, and is thrown away.**
   * Without this every selection click also ran `dragMemberSpec` with a delta
   * of a few thousandths, which snapping would then round into a real move —
   * so picking a board up to look at it would nudge it.
   */
  const commitDrag = () => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    if (Math.abs(d.dxIn) < EDITOR_GRID_IN && Math.abs(d.dzIn) < EDITOR_GRID_IN) return;
    runOp((recipe) => dragMemberSpec(recipe, d.specId, d.dxIn, d.dzIn));
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

  const barButton = (label: string, onClick: () => void, opts: { disabled?: boolean; title?: string; key?: string } = {}) => (
    <button
      key={opts.key}
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
              Drag the board in the 3D view, or nudge it with the buttons. Either way it snaps flush to a neighbour&apos;s
              face if one is within {SNAP_TOLERANCE_IN}″, and to the ⅛″ grid otherwise, and a move that would put two
              boards through each other is refused on release.
            </p>
            {drag !== null && (
              <p style={{ fontSize: 11, margin: "0 0 4px", color: "#1f7ae0" }} role="status">
                {drag.dxIn >= 0 ? "+" : "−"}
                {Math.abs(drag.dxIn).toFixed(2)}″ across, {drag.dzIn >= 0 ? "+" : "−"}
                {Math.abs(drag.dzIn).toFixed(2)}″ up — release to drop.
              </p>
            )}
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              {barButton("←", () => nudge(-EDITOR_NUDGE_IN, 0), { title: `Left ${EDITOR_NUDGE_IN}″` })}
              {barButton("→", () => nudge(EDITOR_NUDGE_IN, 0), { title: `Right ${EDITOR_NUDGE_IN}″` })}
              {barButton("↓", () => nudge(0, -EDITOR_NUDGE_IN), { title: `Down ${EDITOR_NUDGE_IN}″` })}
              {barButton("↑", () => nudge(0, EDITOR_NUDGE_IN), { title: `Up ${EDITOR_NUDGE_IN}″` })}
            </div>

            {sectionHeading("This member")}
            <p style={{ fontSize: 11, opacity: 0.65, margin: "0 0 4px" }}>
              Right-click the board in the 3D view for the same list.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
              {memberActions(selected).map((action) =>
                barButton(action.label, action.onPick, { disabled: !action.enabled, title: action.title, key: action.key }),
              )}
            </div>
            {memberNotice && (
              <p style={{ fontSize: 11, color: "#a33", margin: "0 0 6px" }} role="status">
                {memberNotice}
              </p>
            )}

            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              {barButton("Rotate −90° in the wall", () => rotate(-90))}
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
               retyped rather than drawn in the wrong place. Rotating <em>in the wall</em> swings the board across the
               panel&apos;s face; <em>standing it on edge</em> turns it through the panel&apos;s depth. They are different
               moves and the second one can be refused by the girt.
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

      <MemberContextMenu target={menu} onClose={() => setMenu(null)} />

      {/* ──────────────────── the isolated 3D framed view ──────────────── */}
      {/* ⚠ The browser's own context menu is suppressed HERE, on the DOM
          element around the canvas, not in the scene — a right-click on a
          board has to reach r3f as a `pointerdown` before the browser puts its
          own menu over the top of ours. */}
      <div
        style={{ flex: "1 1 260px", minWidth: 200, minHeight: "min(60vh, 420px)", border: "1px solid #ccc" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Canvas
          camera={{ position: cameraPosition, fov: 45, near: 0.01, far: 1000 }}
          /* Clicking the empty space around the panel puts the board down —
             the same gesture as clicking off a selection anywhere else. */
          onPointerMissed={() => {
            setSelectedId(null);
            setMenu(null);
          }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[maxDim, maxDim * 2, maxDim]} intensity={0.8} />
          {showStraw && (
            <mesh position={centre}>
              <boxGeometry args={[widthFt, heightFt, depthFt]} />
              <meshStandardMaterial color="#e0c458" transparent opacity={0.35} />
            </mesh>
          )}
          <PanelMembersGroup members={otherMembers} onMemberPointerDown={onMemberPointerDown} />
          {/* ⚠ The selected member is its OWN group so it can take
              `colorOverride` — `PanelMembersGroup` colours a whole group, and
              a per-member colour would mean changing a component five other
              views share for the sake of one. Two groups cost nothing.

              ⚠ It is also the DRAG PREVIEW: while the pointer is down the
              group is translated by the delta so far, which moves the member's
              real geometry rather than a stand-in box. A brace previewed as an
              upright box around its own trapezoid would show a shape the panel
              does not contain. */}
          {selectedMembers.length > 0 && (
            <group position={drag ? [drag.dxIn / IN_PER_FT, drag.dzIn / IN_PER_FT, 0] : [0, 0, 0]}>
              <PanelMembersGroup
                members={selectedMembers}
                colorOverride={SELECTED_COLOR}
                onMemberPointerDown={onMemberPointerDown}
              />
            </group>
          )}
          {/* ⚠ **THE DRAG PLANE.** Mounted only while a board is being
              dragged, and only then, because it is invisible and raycastable:
              left in the scene it would swallow every click meant for a
              member. It lies in the panel's own width/height plane through the
              grab point, so the pointer's distance across the screen becomes a
              distance across the PANEL at the board's own depth — not a
              distance in the camera's frame, which would move a board further
              the further away it was.

              Generous on purpose (20x the panel's largest dimension): the
              pointer has to stay over it for the drag to keep measuring, and
              the camera can be orbited. Orbit it until the plane is edge-on
              and the drag stops reporting — that release is caught by the
              window listener above and cancels, which is why the cancel
              exists. */}
          {drag && (
            <mesh
              position={[centre[0], centre[1], drag.planeZFt]}
              onPointerMove={(e) => {
                e.stopPropagation();
                setDrag((d) =>
                  d === null
                    ? null
                    : { ...d, dxIn: (e.point.x - d.grabXFt) * IN_PER_FT, dzIn: (e.point.y - d.grabYFt) * IN_PER_FT },
                );
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                commitDrag();
              }}
            >
              <planeGeometry args={[maxDim * 20, maxDim * 20]} />
              {/* ⚠ **DoubleSide, and the drag does not work without it.**
                  three.js raycasts a mesh through `material.side`, and a
                  `planeGeometry` faces +Z. This camera orbits to azimuth
                  -62deg, which puts it at NEGATIVE Z — behind the plane — so
                  at `FrontSide` every ray passed straight through and the
                  move reported +0.00in however far the pointer travelled.
                  Measured in the browser: the grab registered, the delta
                  never moved. */}
              <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
          )}
          {/* ⚠ Orbiting is OFF while a board is in hand. Both gestures are a
              pointer dragged across the canvas, so leaving the camera live
              meant every board move also swung the view, and the board
              appeared to move the wrong way. */}
          <OrbitControls target={centre} makeDefault enabled={drag === null} />
        </Canvas>
      </div>
    </div>
  );
}
