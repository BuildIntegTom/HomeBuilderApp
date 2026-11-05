export interface Point {
  x: number;
  y: number;
}

/**
 * Corner ids, in order going around the footprint. Widened from a fixed
 * 4-corner union to a generic string so N-sided polygons (octagon,
 * bump-outs) can use their own id scheme — rectangle generation keeps
 * "A"/"B"/"C"/"D" for continuity, octagon uses "0".."7".
 */
export type CornerId = string;

export interface Corner {
  id: CornerId;
  point: Point;
}

export type WallId = string;

export interface Wall {
  id: WallId;
  startCorner: CornerId;
  endCorner: CornerId;
  lengthFt: number;
}

export interface Footprint {
  corners: Corner[];
  walls: Wall[];
}

export type PanelSlotType =
  | "corner"
  | "safety-oct-corner"
  | "standard"
  | "safety-gap"
  | "window"
  | "door"
  | "braced"
  | "column"
  | "big-header"
  /**
   * A framed void: a slot that occupies real wall length and holds no panel.
   *
   * ⚠ **Created by the right-click menu's "delete / no panel", 2026-11-03.**
   * Asked what deleting a panel outright should leave behind, Tommy chose an
   * explicit open slot over shortening the wall or quietly merging the width
   * into the neighbours — *a real slot of that width, typed open* — so the
   * wall length still sums and the void appears on drawings and takeoffs as
   * something somebody MEANT, rather than as an absence a reader has to infer.
   *
   * It builds no members, costs nothing and weighs nothing. It is deliberately
   * NOT in `PLACEABLE_PANEL_TYPES`: you make one by emptying a slot, not by
   * inserting one.
   */
  | "open";

/** Declared locally rather than imported from panel-catalog's own
 * `BracePattern` — `packages/geometry` doesn't depend on
 * `packages/panel-catalog` (same reason the safety-gap widths are
 * duplicated rather than imported there). Kept in sync by hand; see
 * `PanelSlot.bracedPattern`. */
export type BracePattern = "chevron" | "hatch";

export interface PanelSlot {
  type: PanelSlotType;
  widthIn: number;
  /**
   * ⚠ **B15 — which half of which PAIR pattern this panel carries.**
   *
   * > *"Applying this patterned bracing should be part of the original
   * > tiling when drawing a shape."* — Tommy, 2026-11-01
   *
   * Set at draw time by `applyDrawTimeBracing`, which walks each wall from
   * the end nearest the least accessible corner and pairs its STANDARD
   * panels — his eligibility answer, since corners and columns are already
   * stiff boxes and nothing can route a diagonal through a header or a
   * plywood spacer.
   *
   * ⚠ **Nothing crosses the seam.** *"The x in the super brace is 4 smaller
   * pieces, each one leg of the x, on two different panels."* A pattern that
   * looks continuous across a pair is each panel carrying its own legs, which
   * is exactly why it can live on the slot.
   *
   * Absent = no pattern, which is what every panel had before this and what
   * an ineligible one still has. The unions are spelled out rather than
   * imported because `@building-integrity/panel-catalog` is a SIBLING of this
   * package, not a dependency — the same arrangement `BracePattern` already
   * has. `BracePairPattern` and `PairHalf` there are the authority.
   */
  bracePairPattern?: "superbrace" | "braced" | "nailer";
  /** Which half of the pair. See `bracePairPattern`. */
  bracePairHalf?: "left" | "right";
  /**
   * Which CARROT this panel got (2026-11-02). Only meaningful under the
   * `superbrace` pattern, which cycles Super, Super, Little, Little along
   * each run {EM} *"The pattern would be super carrot, super carrot, little
   * carrot, little carrot, super etc."* A Super Carrot is this panel's two
   * legs of the pair's X plus two short load-path diagonals; a Little Carrot
   * is the two short diagonals alone. `big-carrot` (the X by itself) has a
   * name but is not produced by the pattern.
   *
   * ⚠ Derived by `applyDrawTimeBracing`, not stored in the project file —
   * same as `bracePairPattern`/`bracePairHalf`, and for the same reason.
   */
  braceFigure?: "super-carrot" | "big-carrot" | "little-carrot";
  /** A slot can carry a second type alongside its primary one (Tommy: "have
   * multiple types of panels be represented in a particular panel") — e.g.
   * a safety-gap panel near a corner that also satisfies the braced-panel
   * placement rule, instead of needing two separate adjacent panels.
   * Undefined = single-type slot, the overwhelmingly common case. */
  secondaryType?: PanelSlotType;
  /** Only meaningful for "window" slots (Tommy: "an option for 5 different
   * standard window heights, and that should determine the height of the
   * windows... i want each window individually adjustable") — this
   * window's own Rough Opening height (sill-top to header-bottom).
   * Undefined = not yet customized, falls back to the project's default
   * (`standardWindowHeightDefaultIn` in panel-catalog's data.ts), same
   * "absent = default" convention as `secondaryType`. Doors don't use
   * this — a door's RO height is always the confirmed
   * `computeDoorRoughOpeningHeightIn` formula, not user-adjustable. */
  heightIn?: number;
  /** Only meaningful for "window" slots — this window's own sill height
   * (floor to Rough Opening bottom), draggable independently of `heightIn`
   * (the RO's own height, i.e. its top edge) via the 3D Sill & Header drag
   * tool. Undefined = not yet customized, falls back to the project's
   * default (`sillDefaultHeightIn` in panel-catalog's data.ts), same
   * "absent = default" convention as `heightIn`. Doors don't use this —
   * a door's RO always starts at the floor (bottomZIn = 0). */
  sillHeightIn?: number;
  /** Only meaningful for "braced" slots — which diagonal-brace pattern and
   * left/right orientation this specific panel uses (Tommy: "I want this
   * editor to be quite flexible... include each panel style for braced
   * panels in the click-through cycle... allows the user to change each
   * panel"). Undefined on a "braced" slot means "not yet decided" — falls
   * back to the project's global default (`bracingStyle` in page.tsx, read by
   * `resolveBracedStyle`), same "absent = default" convention
   * as `heightIn`/`sillHeightIn` above; this should only actually happen
   * for legacy data predating this field. */
  bracedPattern?: BracePattern;
  /** See `bracedPattern` — false/undefined = the pattern's own base
   * orientation (chevron points "<", hatch runs "/"); true = mirrored
   * (chevron points ">", hatch runs "\"). */
  bracedMirrored?: boolean;
  /** Independent vertical zones within this column, bottom-to-top (Tommy:
   * "the panels above and below a beam are their own unique panels" — and,
   * separately, a wall taller than the project's own max panel height
   * auto-splits the same way). Additive/optional — every horizontal/
   * structural consumer of PanelSlot (retile, tiling, corner ownership,
   * braced placement) only ever reads this slot's own top-level fields, so
   * an absent `zones` is invisible to all of them; a real `zones` array
   * always keeps `zones[0]` (the bottom-most zone) mirrored onto this
   * slot's own top-level type/heightIn/sillHeightIn/bracedPattern/
   * bracedMirrored/secondaryType (see panelSlotZones.ts's own
   * zoneFromSlot/applyZonesToSlot), which is what makes that invisibility
   * safe rather than just silently stale. */
  zones?: PanelSlotZone[];
  /** This slot's own explicitly user-dragged width (Tommy: "when you click
   * and drag a panel, it moves, snapping... to other panels' edges" — a
   * standard/braced slot's own widthIn is normally always freshly re-
   * derived by the tiling engine on every retile; this is the one
   * exception, a fixed-width reservation that survives an unrelated retile
   * elsewhere on the wall instead of resetting back to the tiling engine's
   * own computed width. Only ever set on a "standard" or "braced" slot —
   * see reconcileBracedPlacement, which is what re-applies it (forcing
   * `widthIn` back to this value and shedding the difference to the
   * nearest still-unlocked standard-family neighbor) after every retile.
   * Undefined = today's exact behavior, a slot's width is always whatever
   * the tiling engine currently computes. */
  lockedWidthIn?: number;
  /** Only meaningful for "big-header" slots (Tommy: "2 with the option to
   * have a sill under it as an option in the left bar but default not") —
   * a Big Header normally has no sill (it can span double doors, large
   * openings, conditioned garages), but a sill panel can be opted in
   * underneath it. Undefined/false = no sill, the default. */
  includeSillOnBigHeader?: boolean;
  /**
   * REPANELIZE R2 — only meaningful for opening slots (window / door /
   * column / big-header): **where along the wall the user put this opening**,
   * in inches from the wall's start.
   *
   * ⚠ **This is INTENT, not a measurement, and the distinction is the whole
   * point.** An opening's surviving anchor has always been
   * `beforeStandardCount` — a COUNT of the standard slots before it — and a
   * count is not a position: two layouts with the same number of standards
   * before an opening can put it in completely different places, because the
   * standards need not be the same widths. Measured 2026-10-07: changing
   * which corner is least accessible, a setting about which end a sheet of
   * plywood goes, moved a window by **-0.75in on a 240in wall, +5.875in at
   * 300in and +19in on a 360in wall**. Nothing reported it.
   *
   * ⚠ **It must never be recomputed from the current slots during a re-tile.**
   * That was tried on 2026-10-07 and it broke the run-stop round trip: an
   * offset re-derived while a wall was STOPPED describes the stopped layout,
   * so restoring sorted by a meaningless key and a window and a door **swapped
   * places** (baseline `window@265.5 door@407`, restored `door@225.5
   * window@263.5`). It is written when the user creates or moves the opening,
   * and from then on it is carried through every re-tile untouched — out
   * through `getOpeningAnchors` as `OpeningAnchor.offsetIn` and back in
   * through `retileWithOpenings`.
   *
   * Undefined = no intent recorded yet, which is every opening predating this
   * and every one the tiler seeds itself. Placement falls back to the count
   * for those, exactly as before.
   */
  anchorOffsetIn?: number;
  /**
   * B19 — **this panel's own member list, written by the Panel Editor.**
   *
   * > *"This panel editor isolates the panel in question in its own 3d framed
   * > view and the left bar is dedicated to having options such as change
   * > panel type, add diagonal, add vertical, add horizontal. ... All of this
   * > should be pretty easy to track materials wise I would thin[k], seems
   * > like a json thing"* — Tommy, 2026-11-02
   *
   * He was right that it is a json thing, and this is the json. Everything
   * else about a panel's members is DERIVED — a pattern on the slot becomes a
   * list of added members at render time, and the same list is recomputed for
   * the cut list, the weight, the price and every export. This is the first
   * member data the project file actually stores.
   *
   * ⚠ **Present = authoritative. It REPLACES the derived pattern, it does not
   * add to it.** Otherwise you could never delete a carrot leg: the pattern
   * would put it straight back on the next render. The editor seeds this list
   * from whatever the pattern derived, so opening the editor and changing
   * nothing leaves the panel identical — and a panel edited back to the
   * pattern's own shape rejoins its group, because sameness falls out of the
   * members rather than from a hand-edited flag (see `recipeFingerprint`).
   *
   * ⚠ **Only read for a `standard` slot today.** That is the one type whose
   * members come through `buildPanelFromRecipe`, which is what composes a base
   * panel with added members; a braced, window, column or corner panel is
   * still built by its own builder and has nowhere to put these. The editor
   * says so rather than accepting edits it would then drop.
   *
   * Absent = the panel is whatever its pattern derives, which is every panel
   * that predates the editor and every one nobody has opened.
   */
  editedMembers?: StoredPanelMemberSpec[];
  /**
   * What the user called this panel in the editor — *"as well as recategorize
   * it or name it"*. Shown wherever the panel is identified, alongside its
   * generated name rather than instead of it: a shop needs the series name
   * (`W12`) to find the panel on the drawing, and the user's name to know
   * which one somebody meant.
   *
   * Absent = no name given, which is every panel nobody has named.
   */
  panelName?: string;
}

/**
 * One member the Panel Editor added to a panel — the stored form of
 * panel-catalog's own `AddedMemberSpec`.
 *
 * ⚠ **Spelled out here rather than imported, on purpose.**
 * `packages/geometry` is a SIBLING of `packages/panel-catalog`, not a
 * dependency — the same arrangement `BracePattern` and the brace-pair unions
 * above already have, and the same reason the safety-gap widths are duplicated
 * rather than imported. `AddedMemberSpec` there is the authority on what these
 * fields MEAN; this is the authority on what the file holds.
 *
 * The fields are panel elevation coordinates: `x` across the panel's width
 * from its left edge, `z` up its height from its bottom. `wythe` picks which
 * face the board is let into — added members sit INSIDE the panel's depth,
 * flush with a face, in a groove routed out of the straw.
 */
export interface StoredPanelMemberSpec {
  /** `diagonal` is mitred at both ends and carries its real trapezoid cut;
   * `straight` is cut square and lies along one axis. */
  kind: "diagonal" | "straight";
  id: string;
  fromXIn: number;
  fromZIn: number;
  toXIn: number;
  toZIn: number;
  wythe: "exterior" | "interior";
  /**
   * What part a `straight` board is, when "a vertical is a stud" is not true
   * — B21's vertical nailer overlay. Absent keeps the derivation (vertical =
   * `stud`, horizontal = `blocking`), which is every member the editor stored
   * before today.
   *
   * ⚠ Spelled out rather than imported, for the reason above this interface.
   * It must stay in step with panel-catalog's `MemberRole`; a test holds the
   * two lists together.
   */
  role?: "stud" | "plate" | "girt" | "girt_web" | "nailer" | "brace" | "skin" | "blocking" | "jack_stud";
  /**
   * Which stick a `straight` board is cut from — B19 stride 2, 2026-11-05,
   * his *"change lumber size"* menu action. Absent means 2x4, which is what
   * every member stored before today meant, so no migration.
   *
   * ⚠ Diagonals have no size: a brace's mitres and cut length are built on
   * the 2x4 brace geometry, and changing that is a building decision rather
   * than a menu item — see `setMemberNominalSize`.
   */
  nominalSize?: "2x4" | "2x6";
  notes?: string;
}

/** One independently-editable vertical zone of a PanelSlot column — same
 * fields as PanelSlot's own per-zone data, minus widthIn (shared by every
 * zone in the column) and minus `zones` itself (zones don't nest). */
export interface PanelSlotZone {
  type: PanelSlotType;
  secondaryType?: PanelSlotType;
  heightIn?: number;
  sillHeightIn?: number;
  bracedPattern?: BracePattern;
  bracedMirrored?: boolean;
  /**
   * ⚠ **This row's own half of the wall brace pattern — B22, 2026-11-04.**
   *
   * > *"The upper row on a wall tall enough to spawn 3rd gable panels I guess
   * > can have their own diagonal pattern, either synonymous or similar with
   * > its downstairs counterparts."* — Tommy
   *
   * Before this the upper band inherited whatever pattern sat on its COLUMN,
   * so it was braced wherever the ground row happened to be and unbraced
   * above every window and door — the one place a wall is already weakest,
   * unbraced from the slab to the plate. The pattern is now walked along each
   * row in its own right, which is what "their own diagonal pattern" asks
   * for; it starts from the same end as the row below so the two tend to line
   * up, which is the "synonymous" half.
   *
   * Derived by `applyDrawTimeBracing`, never stored in the project file —
   * exactly like `PanelSlot`'s own three fields, and for the same reason.
   * Absent on a zone nothing has reconciled yet, where the reader falls back
   * to the column's pattern (today's behaviour) rather than drawing nothing.
   */
  bracePairPattern?: "superbrace" | "braced" | "nailer";
  /** Which half of the pair. See `bracePairPattern`. */
  bracePairHalf?: "left" | "right";
  /** Which carrot. See `bracePairPattern`, and `PanelSlot.braceFigure`. */
  braceFigure?: "super-carrot" | "big-carrot" | "little-carrot";
}

/**
 * A whole-building horizontal slice (Tommy: "maybe it sees the ground
 * level, and then can shift upward to the next ring of panels at a
 * particular height") — one ring of panels spanning every wall at a shared
 * height range, with its own independently-editable `wallSlots`. Ground
 * floor is always `stories[0]`; additional stories are appended as real,
 * separately-stored data (never the same object reference another story
 * points at) rather than mirroring another story's slots by reference.
 */
export interface Story {
  /** Deliberately a 2-member union, not a generic string — caps this at
   * today's ground+one-additional-story cardinality. Widening to a plain
   * string id is the natural seam for a future N-story pass. */
  id: "ground" | "second";
  label: string;
  wallHeightFt: number;
  wallSlots: Record<WallId, PanelSlot[]>;
}

export type WallEnd = "start" | "end";

/**
 * How much of one wall is deliberately NOT built (Tommy: "an addition tool
 * setting or stop wall tool so that it is possible to make incomplete
 * walls") — inches measured in from each end of the wall, on the 1/8in
 * grid. The footprint polygon stays closed either way: "incomplete" is a
 * property of the panel RUN, never of the shape.
 *
 * **Declared in Stage 0 of Project Smearforn and read by nothing yet.** It
 * ships with the v24->v25 file bump so the format settles once, and Stage 3
 * is what teaches `wallGeometryFor` to subtract it. An absent record means
 * a fully panelized wall, which is every existing project.
 */
export interface WallRunStop {
  startStopIn: number;
  endStopIn: number;
}
