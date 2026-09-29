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
 * function ever withholds, and its test says so.
 */
export const SETTINGS_SECTION_IDS = ["units", "site", "panelizer", "sandbox", "admin"] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTION_IDS)[number];

export function settingsMenuSections(role: ViewerRole): SettingsSectionId[] {
  return SETTINGS_SECTION_IDS.filter((id) => (id === "admin" ? settingsMenuHasAdminGroup(role) : true));
}
