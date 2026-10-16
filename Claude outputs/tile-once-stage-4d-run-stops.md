# Tile-once Stage 4d — run stops, and the memory that has to survive it

**The last of the six handlers.** `retileAllForRunStops` is the only one still
re-tiling for a reason tile-once means to remove.

## Why it is not just another length change

A run stop shortens the part of a wall that is BUILT — a length change by
another name, and `resizeWallRun` already does that work. But the stop path
carries something the other two do not:

> `retileAllForRunStops` … ⚠ **It is also what the run-stop opening memory
> exists to survive, so Stage 6 cannot delete that memory until this one is
> converted.** — the inventory guard's own note

Today, stopping a wall over a window **withholds** that opening into
`RunStopOpeningMemory`, and reducing the stop **brings it back** at its original
anchor. That memory is produced in exactly one place: the re-tile's own
`unbuiltOpeningsByWallId`. **Convert this handler naively and nothing writes it
— so un-stopping a wall would quietly stop restoring the windows inside the
stopped span.** That is user-visible, and it is not a change anyone asked for.

## The design

Remember the **slots**, not the anchors.

- **Stop grows (wall shrinks):** the slots the stop removes are sliced off that
  end and kept, verbatim, per wall and per end.
- **Stop shrinks (wall grows):** those slots come back first, in order, and only
  once the remembered run is exhausted do fresh standard panels enter.

⚠ **This is strictly MORE faithful than what it replaces.** The anchor memory
restores openings only; a remembered slot array restores the panels exactly as
they were — hand-set widths, braced patterns, types and all. Under tile-once
the panel array IS the document, so remembering the document is the natural
move and re-deriving positions from anchors is the thing that stops making
sense.

## What it costs

- **A new `ProjectState` key**, which is compile-time enforced to be classified
  in BOTH `undoHistory.ts` (74 keys, `satisfies Record<keyof ProjectState, …>`)
  and the Stage 4B redaction guard (money / not-money). Neither will let it
  through unclassified.
- **It is `transient`-ish but is NOT transient:** it must be saved, because a
  project saved with a stop and loaded later has to restore its panels when the
  stop is reduced. So it is document state and rides the project file. ⚠ An
  additive optional key with one shared default is **not** a
  `PROJECT_FILE_VERSION` bump, per the standing rule.
- **The candidate probe** at `page.tsx`'s stop-legality check uses the re-tile
  to decide whether a stop is allowed. That becomes "would `resizeWallRun`
  report a shortfall", which is the same question asked of the new path.

## Order of work

1. The pure part: remember/restore on top of `resizeWallRun`, with tests —
   including the round trip (stop out, stop back, original panels returned).
2. Classify the new key in `undoHistory` and the redaction guard; let the
   compiler name them.
3. Convert the apply path, then the candidate probe.
4. ⚠ **Only then** can Stage 6 retire `RunStopOpeningMemory`, which is the
   dependency the inventory names.

## What this does NOT change

The stop itself, its refusal rules, and the elevation's unbuilt-span drawing
are untouched. This is about what happens to the panels inside the span.
