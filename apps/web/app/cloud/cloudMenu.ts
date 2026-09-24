import type { EntitlementSource } from "../auth/actingAs";
import { parseSaveTimestamp } from "../titleBlockDate";
import {
  FOLDER_LABEL,
  NO_COMPANY_MESSAGE,
  consortiumMenuMessage,
  displayProjectName,
  type BrowseContext,
  type CloudContext,
  type SharedReach,
} from "./cloudTypes";
import { ownerNameOrGap, reachSummary } from "./sharingDisplay";
import { BROWSE_EXPORT_ABSENT_NOTE, browseBannerLines } from "./browseDisplay";

/**
 * What the Project ▾ menu's cloud group shows (spec, "UI — the Project ▾ menu,
 * and nothing new on the bar"). Pure, so every account state is testable
 * without a browser.
 *
 * Local Save Project / Load Project are NOT described here: they are never
 * sign-in-gated and never change with any of these states (decision 14).
 */
export interface CloudMenuInput {
  /** False with no Supabase project configured, or no AuthProvider mounted. */
  backendConfigured: boolean;
  /** True until the first /api/session answer. */
  loading: boolean;
  signedIn: boolean;
  mfaPending: boolean;
  actingAs: { companyId: string; companyName: string; source: EntitlementSource } | null;
  cloudProjectOpen: boolean;
  /**
   * Stage 4B: a redacted, read-only design from another member company is on
   * screen. Every save item goes while it is — Save to cloud, Save as new cloud
   * project…, and (in TopBar) the local Save Project. Decision 23: "save a copy
   * into my own company and carry on with it" is the exact thing view-only must
   * not become, and it would be a copy of a redacted document besides.
   *
   * THE BUTTONS ARE THE COURTESY, NOT THE GATE. `cloudContext` is null while
   * browsing, so there is no project for a save to attach to even if one of
   * these were missed — the same shape of belt as everywhere else in the cloud
   * stages. And it is friction either way: the document is in the browser, so
   * hiding these removes the easy path, not the possible one (23).
   */
  browsing?: boolean;
}

export type CloudMenu =
  | { kind: "absent" }
  | { kind: "sign-in-prompt"; text: string }
  | {
      kind: "signed-in";
      heading: string;
      /** A plain explanation when something is unavailable, else null. */
      message: string | null;
      saveToCloud: boolean;
      saveAsNew: boolean;
      openFromCloud: boolean;
      /** Stage 2C: only while a cloud project is open. */
      versionHistory: boolean;
      /** Stage 3B: the open project's access list and share form. */
      sharing: boolean;
    };

export const SIGN_IN_PROMPT = "Sign in to save projects to the cloud";

export const MFA_PENDING_MESSAGE = "Enter your two-factor code (Account ▾) to use cloud projects.";

export function buildCloudMenu(input: CloudMenuInput): CloudMenu {
  if (!input.backendConfigured || input.loading) return { kind: "absent" };
  if (!input.signedIn) return { kind: "sign-in-prompt", text: SIGN_IN_PROMPT };

  if (input.mfaPending) {
    return {
      kind: "signed-in",
      heading: "Cloud",
      message: MFA_PENDING_MESSAGE,
      saveToCloud: false,
      saveAsNew: false,
      openFromCloud: false,
      versionHistory: false,
      sharing: false,
    };
  }

  const { actingAs } = input;
  const browsing = input.browsing === true;
  // Creating follows the verified acting-as company. Stage 3D: a consortium
  // entitlement creates too, in the consortium company's own tree, where the
  // creator keeps a standing grant (answer 1, Stage 2 Open Item 2). LISTING
  // that tree is still Stage 4, which is what `message` below still says.
  //
  // It says it in the MENU's own words (`consortiumMenuMessage`), not the
  // folder tabs': this line sits directly above Open from cloud…, and since 3D
  // that note does have something to list — anything shared with you, and
  // anything you created in the consortium's tree, in Shared with us.
  const canCreate = actingAs !== null && !browsing;
  const message = browsing
    ? BROWSE_EXPORT_ABSENT_NOTE
    : actingAs === null
      ? NO_COMPANY_MESSAGE
      : actingAs.source === "consortium"
        ? consortiumMenuMessage(actingAs.companyName)
        : null;

  return {
    kind: "signed-in",
    heading: actingAs ? `Cloud · ${actingAs.companyName}` : "Cloud",
    message,
    // Saving into a project already open is governed by that project's
    // ownership, not by the switcher, so it stays offered whatever you are
    // acting as. With nothing open, it is the create dialog. Stage 4B: not
    // while a browsed design is on screen — `cloudProjectOpen` is already false
    // then (browsing clears `cloudContext`), and `browsing` says it in its own
    // right so the rule does not depend on that coincidence.
    saveToCloud: !browsing && (input.cloudProjectOpen || canCreate),
    saveAsNew: canCreate,
    // Stage 3B: offered to every signed-in account, including one with no
    // membership, which can still hold a personal grant. Its note then shows
    // only the Shared with us tab.
    openFromCloud: true,
    // Governed by the open project, like Save to cloud, not by the switcher.
    // If access to it was lost, the history's own 404 says so.
    versionHistory: input.cloudProjectOpen,
    // Stage 3B, the same rule: the access list's own 404 says if access went.
    sharing: input.cloudProjectOpen,
  };
}

/**
 * The Project ▾ status line, shown only while a cloud project is open:
 * "Smith House · v7 · Building Integrity › Current Projects", plus the
 * acting-as mismatch line when the switcher points somewhere else.
 *
 * Stage 3B: `reach` is how a shared project reached you (from the Shared tab),
 * so the second line reads "Owned by Building Integrity · shared with you by
 * Bob. You're acting as Rare Forms; saves still go to this project." Empty when
 * unknown (opened from a folder tab), which keeps 2B's wording.
 */
export function cloudStatusLines(
  cloudContext: CloudContext | null,
  editorProjectName: string,
  actingAs: { companyId: string; companyName: string } | null,
  reach: readonly SharedReach[] = [],
  /**
   * Stage 4B: a browsed design instead. It takes over the status line entirely,
   * because there is nothing a cloud status line could truthfully say about it
   * — no base to save from, no folder of yours it lives in. The banner's own
   * three sentences ARE the status, so the same words appear in both places
   * rather than two descriptions of one state drifting apart.
   */
  browseContext: BrowseContext | null = null,
): string[] {
  if (browseContext) {
    return [
      `${displayProjectName(browseContext.projectName)} · v${browseContext.versionNumber} · ${ownerNameOrGap(browseContext.ownerCompanyName)} › ${FOLDER_LABEL[browseContext.folder]}`,
      ...browseBannerLines(browseContext.projectName, browseContext.ownerCompanyName).slice(1),
    ];
  }
  if (!cloudContext) return [];
  const owner = ownerNameOrGap(cloudContext.companyName);
  const lines = [`${displayProjectName(editorProjectName)} · v${cloudContext.baseVersionNumber} · ${owner} › ${FOLDER_LABEL[cloudContext.folder]}`];
  const how = reachSummary(reach);
  const ownedBy = how ? `Owned by ${owner} · ${how}.` : `Owned by ${owner}.`;
  if (actingAs && actingAs.companyId !== cloudContext.companyId) {
    lines.push(`${ownedBy} You're acting as ${actingAs.companyName}; saves still go to this project.`);
  } else if (!actingAs && how) {
    lines.push(ownedBy);
  }
  return lines;
}

/**
 * "Sep 12, 2026, 2:14 pm" for a Version history row: every version shows
 * exactly when it was saved, not only how long ago. A date the strict parser
 * rejects says so rather than printing a substitute.
 */
export function absoluteSaveTime(createdAt: string): string {
  const date = parseSaveTimestamp(createdAt);
  if (!date) return "date not recorded";
  const day = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return `${day}, ${time}`;
}

/** "2 hours ago" for a folder row. A date the strict parser rejects says so. */
export function relativeSaveTime(createdAt: string, now: Date): string {
  const date = parseSaveTimestamp(createdAt);
  if (!date) return "date not recorded";
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
