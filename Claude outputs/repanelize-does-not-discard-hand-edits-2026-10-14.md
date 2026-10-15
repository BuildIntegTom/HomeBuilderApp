# Repanelize does not discard hand-set widths — open, with the search narrowed

**Status: diagnosed to a contradiction, NOT fixed.** One speculative fix was
written, measured, found not to work, and reverted rather than left in the tree
with a comment claiming a result it did not deliver.

## The defect

`repanelize.ts`'s confirmation says, verbatim:

> Hand-set panel widths, inserted panels and panel types on those walls **will
> be replaced**. Windows and doors keep their sizes, but may shift position
> along the wall.

It does not replace them. Measured in the browser on a freshly drawn building:

1. On wall CD, drag a panel boundary. Two standards go `40|40` → `56|24`.
2. Click Repanelize (per-wall or building-wide).
3. The prognosis says **"Nothing would change — wall CD already matches the
   current settings."**
4. Confirming changes nothing. The hand edit survives.

That is the exact failure `repanelize.ts`'s own doc comment exists to prevent:
*"The confirmation must not lie."*

**Tommy ruled on it, 2026-10-14:** *"Yes, Repanelize should discard hand-set
widths. i think this is a good idea because there are a variety of settings
that could be changed that might not carry over if not actually retiled."* So
the BEHAVIOUR moves, not the wording.

## What is established

- **The geometry is innocent.** `retilePreservingOpenings` and
  `retilePreservingOpeningsWithRunStopMemory` both revert a hand-set width
  correctly when driven directly from a test. Verified on a rectangle, with and
  without an opening on the wall, and with `slotIndexPinnedWallIds` both unset
  and set.
- **The app's call reproduces the edit.** A probe inside
  `handleRepanelizeRequest` logged the input and the output for the failing
  wall: both read
  `…|standard:56|standard:24|…`. So the tiler returned what it was given.
- **Ruled out, measured not assumed**, for the failing wall:
  - `wallRunStopsByWallId[wallId]` — **null**
  - `unbuiltOpeningsByStoryAndWallId.ground[wallId]` — **null**
  - `slotIndexPinnedWallIds.has(wallId)` — **false**
  - stripping every slot's `anchorOffsetIn` before the re-tile —
    **INCONCLUSIVE, and my first write-up of this overstated it.** The UI
    prognosis still read "nothing would change", but the re-tile's OUTPUT was
    never logged in that run: the `PROBE same true` line I was reading came
    from the EARLIER diagnostic, before the strip existed. So this is ruled
    out of the symptom, not out of the mechanism. (It was still reverted —
    an unverified fix with a confident comment is worse than none.)

- **A wall with TWO openings reverts too.** The leading theory below — that an
  edit bracketed by two anchored openings is what gets reproduced — was then
  tested directly and is **WRONG**: a wall shaped
  `window | … | standard 56 | … | door` re-tiles the 56 back to 40. The
  geometry is exonerated on every shape tried, which moves the search entirely
  into `page.tsx`.

## What distinguishes the failing case from the passing probe

The app's wall interleaves **two openings and braced panels**:

```
corner | braced | safety-gap | standard 29.125 | standard 29.125 | standard 40 |
standard 40 | window 40 | braced 40 | standard 40 | standard 56 | standard 24 |
door 40 | braced 40 | standard 40 | braced 40 | corner
```

and the hand-edited pair sits **between the window and the door**. The
synthetic probes edited a pair that was not bracketed by two openings. That is
the remaining difference and the place to look next.

## The next concrete step

Reproduce in a unit test at geometry level: a wall with TWO openings and braced
panels, hand-edit the standard pair BETWEEN them, and run
`retilePreservingOpeningsWithRunStopMemory`. If that reverts, the cause is
higher up in `page.tsx`; if it does not, it is in how `getOpeningAnchors` /
`retileWithOpenings` distribute the run between two anchored openings — most
likely `beforeStandardCount` pinning the door's ordinal so the span between the
two openings is reproduced at whatever widths it currently has.

⚠ Whatever the cause, the fix must keep the other half of the promise:
**openings keep their SIZE and may shift position.** That is the 2026-10-10
decision and is separately tested.
