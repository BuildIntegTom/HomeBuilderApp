/**
 * ⚠ **U7 — a per-tool first-use tutorial.** The teardown's §3:
 *
 * > *"Not a manual — three illustrated cards the first time you open a tool,
 * > with DONE and a link to general help. We have a Read Me and a `?`; we have
 * > nothing that teaches a tool at the moment you first touch it. Our tools
 * > genuinely need it more than theirs do: the right-click panel menu, the
 * > panel editor and the Panelizer settings are all discoverable only if
 * > somebody tells you."*
 *
 * And his own question, 2026-11-05: *"I think this is a great idea, especially
 * if it's remembered in their cache or something and that's easy. How would
 * the remembering part work?"*
 *
 * ⚠ **The honest answer to that question, which this file implements:**
 * `localStorage`, one key, **a tool id against the VERSION of its tutorial
 * that was seen** rather than a boolean. The version is the whole point — when
 * a tool genuinely changes, bumping its number shows the card once more to
 * somebody who has been using the app for months, which is exactly what should
 * happen when the panel menu or the editor gains something.
 *
 * ⚠ **And the honest limit, which the last card says out loud rather than
 * leaving the user to discover:** this survives a reload and closing the
 * browser. It does **not** survive clearing site data, a private window, or a
 * different browser or machine — the same person on their phone sees the cards
 * again. Carrying it across devices means storing the same object against the
 * signed-in user, which is a backend stride (a `jsonb` column, a policy, and a
 * merge that takes the higher version per tool on sign-in), not this one.
 *
 * ⚠ **This is the FIRST `localStorage` in the whole app**, and that asymmetry
 * is worth knowing: the app remembers which tutorials you have seen, and still
 * does not remember your DESIGN — leaving the editor without saving still
 * loses it. See the Settings menu's own note, which says so.
 */

/** The tools that are only discoverable if somebody tells you. */
export type TutorialToolId = "panel-menu" | "panel-editor" | "panelizer";

/** Which schematic `TutorialArt` draws for a card. */
export type TutorialArtId =
  | "right-click"
  | "type-list"
  | "open-slot"
  | "member-pick"
  | "member-snap"
  | "member-refused"
  | "scope"
  | "girt-style"
  | "pending-flag";

export interface TutorialCard {
  title: string;
  /** Two or three sentences. Shorter than it wants to be. */
  body: string;
  art: TutorialArtId;
}

export interface Tutorial {
  id: TutorialToolId;
  /** The tool's name as the app itself says it. */
  tool: string;
  /**
   * ⚠ **Bump this when the tool changes**, and the cards come back once for
   * everybody who has already dismissed them. That is the reason the stored
   * value is a number and not `true`.
   */
  version: number;
  cards: TutorialCard[];
}

/**
 * ⚠ **The writing IS the work here** — the teardown says so, and it is right.
 * Every claim below is a thing this app actually does; a tutorial that
 * describes a tool that has moved on is worse than none, because the reader
 * believes it. The `version` above is how that gets corrected.
 */
export const TUTORIALS: Record<TutorialToolId, Tutorial> = {
  "panel-menu": {
    id: "panel-menu",
    tool: "The panel menu",
    version: 1,
    cards: [
      {
        title: "Right-click any panel",
        body: "Every panel in the plan, in a wall elevation and in the 3D view opens the same menu on a right-click. A left-click only selects — it never changes anything, so you can click around a building freely.",
        art: "right-click",
      },
      {
        title: "Change what a panel is",
        body: "The menu lists every panel type this app can build, not just the ones that fit. A type that cannot go here is greyed out WITH ITS REASON, so you learn why rather than wondering where it went.",
        art: "type-list",
      },
      {
        title: "Delete leaves a hole on purpose",
        body: "“Delete / no panel” leaves a real opening of that width rather than shortening the wall or quietly merging its neighbours. The wall still measures what it measured, and the void appears on the drawings and the takeoff as something somebody meant.",
        art: "open-slot",
      },
    ],
  },
  "panel-editor": {
    id: "panel-editor",
    tool: "The panel editor",
    version: 1,
    cards: [
      {
        title: "Every board is a part you can touch",
        body: "The editor opens one panel on its own. Click a member — a stud, a girt, a brace — to pick it, in 2D or in the 3D view, and its own menu offers delete, duplicate, a different lumber size, or a move to the other wythe.",
        art: "member-pick",
      },
      {
        title: "Drag snaps to something real",
        body: "A dragged board snaps to its neighbours' faces first and to the ⅛ inch after that, so what you drop is a dimension the shop can cut to. Drag a diagonal brace plumb and it becomes a vertical nailer and tells you — a board that no longer resists racking must stop being counted as bracing.",
        art: "member-snap",
      },
      {
        title: "An overlap is refused, not accepted",
        body: "Drop a member where it would occupy the same space as another and the editor puts it back. Your edits REPLACE this panel's pattern from then on, so what you see here is what the shop sheet draws and what the cut list counts.",
        art: "member-refused",
      },
    ],
  },
  panelizer: {
    id: "panelizer",
    tool: "The Panelizer",
    version: 1,
    cards: [
      {
        title: "The keyhole for the whole job",
        body: "Floors, Walls, Roof and Foundation are the scope of work. Unchecking a branch does not grey its tab out — it takes that branch out of the building altogether, along with its editors, its drawings and its share of the price.",
        art: "scope",
      },
      {
        title: "How a wall is built, before it is built",
        body: "Panel width, height, girt style and the wall type live here, and they describe panels that do not exist yet. Walls already drawn keep what they have: changing a setting marks it pending and Repanelize is what applies it.",
        art: "girt-style",
      },
      {
        title: "A flagged number is not a confirmed one",
        body: "Settings carrying a caution marker are values this app has not had confirmed by Building Integrity — researched placeholders, not quotes. They are flagged everywhere they are used, including on the price, so nothing here can quietly become a number somebody builds to.",
        art: "pending-flag",
      },
    ],
  },
};

export const TUTORIAL_TOOL_IDS: TutorialToolId[] = ["panel-menu", "panel-editor", "panelizer"];

/** Tool id → the version of its tutorial that this browser has seen. */
export type TutorialsSeen = Record<string, number>;

/** ⚠ Namespaced, because this is the app's first and so far only key. */
export const TUTORIALS_SEEN_STORAGE_KEY = "bi.tutorialsSeen";

/**
 * ⚠ **Reading never throws and never trusts what it finds.**
 *
 * `localStorage` is shared with anything else on the origin, survives across
 * deploys, and can be edited by hand in two clicks of a devtools pane. A
 * malformed value, an array, a string, a version that is not a number — all of
 * them mean "seen nothing", because the cost of being wrong is showing a
 * tutorial once more, and the cost of trusting it is a crash on load.
 */
export function parseTutorialsSeen(raw: string | null): TutorialsSeen {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const out: TutorialsSeen = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) out[key] = Math.floor(value);
  }
  return out;
}

export function serialiseTutorialsSeen(seen: TutorialsSeen): string {
  return JSON.stringify(seen);
}

/**
 * Should this tool's cards come up on their own?
 *
 * ⚠ Compares the stored version against the tutorial's CURRENT one, so a
 * bumped tutorial shows again and an unknown tool shows for the first time.
 */
export function shouldShowTutorial(seen: TutorialsSeen, id: TutorialToolId): boolean {
  return (seen[id] ?? 0) < TUTORIALS[id].version;
}

/** Records this tool's tutorial as seen AT ITS CURRENT VERSION. */
export function markTutorialSeen(seen: TutorialsSeen, id: TutorialToolId): TutorialsSeen {
  return { ...seen, [id]: TUTORIALS[id].version };
}

/**
 * ⚠ **The higher version per tool wins** — the merge the signed-in stride will
 * need, written now because it is the part that is easy to get wrong later.
 *
 * Anything a signed-out user dismissed must stay dismissed when they sign in,
 * and anything they dismissed on another machine must not come back here. Both
 * fall out of "take the larger number", and neither falls out of "whichever
 * loaded last".
 */
export function mergeTutorialsSeen(a: TutorialsSeen, b: TutorialsSeen): TutorialsSeen {
  const out: TutorialsSeen = { ...a };
  for (const [key, value] of Object.entries(b)) out[key] = Math.max(out[key] ?? 0, value);
  return out;
}

/**
 * ⚠ **Every storage call is wrapped, because every one of them can throw.**
 * Safari's private mode throws on `setItem` once the quota is zero, an
 * embedded context can throw on `localStorage` itself, and a server render has
 * no `window` at all. None of those is a reason for the app not to start — the
 * worst case is a tutorial that shows every time, which is the behaviour the
 * app had yesterday.
 */
export function readTutorialsSeen(): TutorialsSeen {
  if (typeof window === "undefined") return {};
  try {
    return parseTutorialsSeen(window.localStorage.getItem(TUTORIALS_SEEN_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function writeTutorialsSeen(seen: TutorialsSeen): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TUTORIALS_SEEN_STORAGE_KEY, serialiseTutorialsSeen(seen));
  } catch {
    /* Nothing to do and nothing to say: the cards will come up again, which is
       the behaviour that existed before this feature. */
  }
}

/**
 * Printed on the last card of every tutorial, so the limit of "remembered in
 * their cache" is stated where the promise is made rather than discovered on a
 * second device.
 */
export const TUTORIAL_MEMORY_NOTE =
  "This browser will remember you have seen this. It will not carry to another browser, another machine, or a private window — and clearing site data forgets it. You can always reopen these cards from the ? at the bottom of the left bar.";
