import { describe, expect, it } from "vitest";
import type { ProjectState } from "./projectFile";
import {
  DOCUMENT_KEYS,
  UNDO_CLASSIFICATION,
  canRedo,
  canUndo,
  emptyUndoHistory,
  pushUndoEntry,
  redoTo,
  sameDocument,
  undoTo,
} from "./undoHistory";

/** Only the keys these tests touch are real; the rest are irrelevant to the
 * history, which compares by reference and never reads a value. */
const stateWith = (over: Partial<ProjectState> = {}) =>
  ({ editorTab: "wall", viewMode: "plan", shapeTool: "edit", footprint: null, baseWallSlots: {}, ...over }) as ProjectState;

describe("what counts as the document", () => {
  it("classifies every ProjectState key — the build enforces it, this says why", () => {
    // `satisfies Record<keyof ProjectState, ...>` fails compilation when a key
    // is added without a verdict, the same guard redaction.ts uses. This test
    // records the count so a silent mass-reclassification is still visible.
    const all = Object.keys(UNDO_CLASSIFICATION);
    // 74 → 75 on 2026-10-16: `stoppedSlotsByStoryAndWallId`, tile-once Stage
    // 4d's record of the panels a run stop has set aside. Classified
    // `document` — undoing a stop has to put those panels back.
    expect(all.length).toBe(75);
    // ...and 69 -> 70 document keys, since the new one is document state.
    expect(DOCUMENT_KEYS.length).toBe(70);
  });

  it("where the user is standing is NOT the document", () => {
    for (const key of ["editorTab", "viewMode", "shapeTool", "role", "unitSystem"] as const) {
      expect(UNDO_CLASSIFICATION[key]).toBe("transient");
    }
  });

  it("switching tab, view, tool, role or units is not an edit", () => {
    // ⚠ Spread ONE base rather than calling the factory twice: a fresh
    // `baseWallSlots: {}` per call is a different object, so two "identical"
    // states would differ on a document key and this would pass for the
    // wrong reason — which is exactly how the first version of it failed.
    const base = stateWith();
    expect(sameDocument(base, { ...base, editorTab: "roof" })).toBe(true);
    expect(sameDocument(base, { ...base, viewMode: "3d" })).toBe(true);
    expect(sameDocument(base, { ...base, shapeTool: "rectangle" })).toBe(true);
    expect(sameDocument(base, { ...base, role: "public" } as ProjectState)).toBe(true);
    expect(sameDocument(base, { ...base, unitSystem: "metric" })).toBe(true);
    // ...but a document key in the same spread IS an edit.
    expect(sameDocument(base, { ...base, projectName: "renamed" })).toBe(false);
  });

  it("a changed wall IS an edit", () => {
    const base = stateWith({ baseWallSlots: {} });
    expect(sameDocument(base, stateWith({ baseWallSlots: {} }))).toBe(false); // different object
    const shared = {};
    expect(sameDocument(stateWith({ baseWallSlots: shared }), stateWith({ baseWallSlots: shared }))).toBe(true);
  });
});

describe("the history", () => {
  it("cannot undo with only the initial entry, because there is nowhere to go", () => {
    const h = pushUndoEntry(emptyUndoHistory, stateWith());
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(undoTo(h)).toBeNull();
    expect(redoTo(h)).toBeNull();
  });

  it("walks back and forward over the same states", () => {
    const a = stateWith({ projectName: "a" });
    const b = stateWith({ projectName: "b" });
    const c = stateWith({ projectName: "c" });
    const h = pushUndoEntry(pushUndoEntry(pushUndoEntry(emptyUndoHistory, a), b), c);

    const back1 = undoTo(h)!;
    expect(back1.state).toBe(b);
    const back2 = undoTo(back1.history)!;
    expect(back2.state).toBe(a);
    expect(canUndo(back2.history)).toBe(false);

    const fwd1 = redoTo(back2.history)!;
    expect(fwd1.state).toBe(b);
    expect(redoTo(fwd1.history)!.state).toBe(c);
  });

  it("⚠ a new edit after an undo discards the branch that was abandoned", () => {
    const a = stateWith({ projectName: "a" });
    const b = stateWith({ projectName: "b" });
    const d = stateWith({ projectName: "d" });
    const h = pushUndoEntry(pushUndoEntry(emptyUndoHistory, a), b);
    const back = undoTo(h)!; // on `a`, with `b` ahead
    const afterNewEdit = pushUndoEntry(back.history, d);
    expect(canRedo(afterNewEdit)).toBe(false);
    expect(afterNewEdit.entries).toEqual([a, d]);
  });

  it("caps depth by dropping the OLDEST, and the present stays the present", () => {
    let h = emptyUndoHistory;
    const made: ProjectState[] = [];
    for (let i = 0; i < 10; i++) {
      const s = stateWith({ projectName: `p${i}` });
      made.push(s);
      h = pushUndoEntry(h, s, 4);
    }
    expect(h.entries.length).toBe(4);
    expect(h.entries).toEqual(made.slice(-4));
    // The newest is still what is on screen — an overflow must not leave the
    // index pointing at someone else's entry.
    expect(h.entries[h.index]).toBe(made[9]);
    expect(canRedo(h)).toBe(false);
  });

  it("⚠ undoing after an overflow still lands on the right state", () => {
    let h = emptyUndoHistory;
    const made: ProjectState[] = [];
    for (let i = 0; i < 6; i++) {
      const s = stateWith({ projectName: `p${i}` });
      made.push(s);
      h = pushUndoEntry(h, s, 3);
    }
    // entries are p3 p4 p5, index 2
    expect(undoTo(h)!.state).toBe(made[4]);
    expect(undoTo(undoTo(h)!.history)!.state).toBe(made[3]);
    expect(canUndo(undoTo(undoTo(h)!.history)!.history)).toBe(false);
  });

  it("entries share structure rather than copying the building", () => {
    // The whole reason a full-state entry is affordable: two entries that
    // differ by one wall hold the SAME array for every other wall.
    const wallA: never[] = [];
    const wallB: never[] = [];
    const first = stateWith({ baseWallSlots: { AB: wallA, BC: wallB } });
    const second = stateWith({ baseWallSlots: { AB: [], BC: wallB } });
    const h = pushUndoEntry(pushUndoEntry(emptyUndoHistory, first), second);
    expect(h.entries[0]!.baseWallSlots.BC).toBe(h.entries[1]!.baseWallSlots.BC);
  });
});
