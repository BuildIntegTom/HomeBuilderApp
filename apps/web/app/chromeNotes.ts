/**
 * The note ids that are CHROME rather than sections of the document.
 *
 * **What this is for.** `page.tsx` has two collections of note ids —
 * `allNoteSections` (what the tray lists) and `formalDocumentNoteIds` (what
 * the PDF packet covers) — and `read-me` and `report-bug` are deliberately in
 * **neither**. That exclusion is correct and stays: it is what stops the tray
 * from listing them, stops `Choose sections` from offering them, and stops the
 * packet from picking them up. U0's harness verified the consequence that
 * matters — an open Read Me note cannot leak its Venmo QR into an engineer's
 * packet.
 *
 * **But an id in no collection is exactly the shape an exhaustive count
 * misses.** U4 and U5 both walk those two collections, and the reachability
 * harness the plan asks for counts sheet ids as `relevantDetailPages.length + 3`.
 * These two ids exist, are openable from the left bar, and are addressable by
 * `?openNote=` — while being invisible to every count in the plan. That is the
 * same failure mode U0 closed for the Review Log, arriving from the other
 * direction, so the category gets a name instead of being remembered.
 *
 * **`selected-panel` is a third id of this kind** and predates U0 — the plan's
 * §9 inventory already records it as *"docked, selection-driven, not in the
 * carousel at all"*. It is **not** listed here because it is not chrome in the
 * same sense: it is driven by selection rather than by a chrome control, it
 * keeps its own docked placement, and nothing in U0 changed it. The point of
 * the name is that the category existed and **U0 grew it by two**.
 *
 * Nothing reads this at runtime today; `page.tsx` renders both notes with
 * their literal ids, exactly as it did before, and this pass changed no
 * behaviour. It exists so U4's and U5's walkers — and the reachability
 * harness — can subtract a named set instead of rediscovering two orphans.
 */
export const CHROME_NOTE_IDS = ["read-me", "report-bug"] as const;

export type ChromeNoteId = (typeof CHROME_NOTE_IDS)[number];

/** Whether a note id is chrome, and therefore correctly absent from
 * `allNoteSections`, `formalDocumentNoteIds` and every count derived from
 * them. */
export function isChromeNoteId(id: string): id is ChromeNoteId {
  return (CHROME_NOTE_IDS as readonly string[]).includes(id);
}
