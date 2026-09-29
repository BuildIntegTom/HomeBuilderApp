import { roleDisclaimers, type ViewerRole } from "./viewerRole";

/** Matches StickyNote.module.css's own `.note` width — used to keep a menu's
 * spawn point from running off the right edge of the screen (Tommy: "the panel
 * standards tab opens to the right of the drop down, since its on the right
 * side of the tool bar this is often pushed out of the screen, lets turn this
 * to spawn more left"). */
export const NOTE_WIDTH_PX = 420;
export const VIEWPORT_MARGIN_PX = 12;

/**
 * Where a top-bar menu's StickyNote should be anchored horizontally, given the
 * left edge of the button that opened it.
 *
 * Never further right than the button itself, never closer to the right edge
 * than one margin, and never off the left edge on a viewport too narrow to hold
 * a whole note (below ~444px the note is already being narrowed by
 * StickyNote.module.css's own `max-width: calc(100vw - 48px)`, so pinning it to
 * the left margin still leaves it fully on screen).
 *
 * Pure and exported so the narrow-viewport cases are testable without a DOM —
 * they are the ones nobody opens a browser at.
 */
export function clampMenuLeft(anchorLeft: number, viewportWidth: number): number {
  const maxLeft = viewportWidth - NOTE_WIDTH_PX - VIEWPORT_MARGIN_PX;
  return Math.min(anchorLeft, Math.max(VIEWPORT_MARGIN_PX, maxLeft));
}

/** Every viewer role, in `roleDisclaimers` order — the one control that
 * replaced the four buttons has to keep offering all of them. */
export const roleOptions = Object.keys(roleDisclaimers) as ViewerRole[];

/**
 * What the collapsed viewer-role control reads. Never a bare "Engineer":
 * sitting next to a company name, a bare role label reads as a job title or as
 * a permission level, and the two axes must not be confusable. Permission is
 * server-enforced and lives in the identity zone; this is presentation.
 */
export function roleControlLabel(role: ViewerRole): string {
  return `Role: ${roleDisclaimers[role].label}`;
}

/** Whether the Settings menu shows its Admin Options group at all. Public gets
 * no group, no heading and no divider — not an empty section. */
export function settingsMenuHasAdminGroup(role: ViewerRole): boolean {
  return role !== "public";
}

/**
 * The sections of the ⚙ Settings note, in the order they render.
 *
 * **U3 put `site` and `panelizer` here**, out of the Project menu, on Tommy's
 * 2026-09-26 instruction (*"we should move the content of the panelizer into
 * the settings in the top right"*) and his 2026-09-28 one about the scope
 * checkboxes (*"all floor, foundation, and roof options should be a checkbox
 * toggle under settings"*).
 *
 * ⚠ **WHY THIS IS A NAMED LIST AND NOT JUST JSX ORDER.** The Panelizer holds
 * the scope-of-work checkboxes that decide which editors the Design menu
 * offers at all, and Site Properties holds the seismic zone and the foundation
 * type. Both were reachable to **every** role from the Project menu. Settings
 * is also the note that carries the role-gated Admin Options group, so the one
 * mistake this relocation could make invisibly is dropping either section
 * inside that gate — which would hide the app's central control from a
 * signed-out visitor with no error anywhere. `admin` is the ONLY id this
 * function ever withholds.
 *
 * ⚠ **What this list does NOT close on its own.** `settingsMenuSections` is a
 * filter over ids; it cannot see JSX nesting. If a section's content were
 * pasted into the `admin:` entry of `TopBar.tsx`'s
 * `Record<SettingsSectionId, ReactNode>`, this function would still return
 * that id and every test in `topBarMenus.test.ts` would still pass while the
 * section vanished for `public`. **What actually closes that hole is the
 * Record's own shape — one entry per id, rendered as siblings — plus the
 * per-role DOM assertion in `ui-reorg-u1`, which reads
 * `#settings-note [data-settings-section]` out of the live page at all four
 * roles and compares it to this function's output.** The unit tests pin the
 * contract; the harness is what checks the DOM obeys it.
 *
 * ⚠ **THE ORDER IS PANELIZER FIRST, AND THAT IS THE POINT OF THE STAGE.**
 * Tommy's words were *"speaking of which **where is it?** We should move the
 * content of the panelizer into the settings in the top right"* and *"all
 * floor, foundation, and roof options should be a checkbox toggle under
 * settings"*. The Panelizer is the thing he is looking for, so opening
 * Settings and landing on a units switch or a project-name field is the
 * *"where is it?"* problem relocated rather than solved. Site Properties
 * follows it as the other relocated section; `units` — one small control —
 * then the sandbox (a navigation away from the app) and the role-gated Admin
 * Options last. **Reversible in one line if Tommy prefers something else;
 * the reorder was a review finding accepted 2026-09-29, not his instruction.**
 */
export const SETTINGS_SECTION_IDS = ["panelizer", "site", "units", "sandbox", "admin"] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export function settingsMenuSections(role: ViewerRole): SettingsSectionId[] {
  return SETTINGS_SECTION_IDS.filter((id) => (id === "admin" ? settingsMenuHasAdminGroup(role) : true));
}
