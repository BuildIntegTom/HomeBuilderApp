import { displayProjectName, type ShareNoticeRow } from "./cloudTypes";
import { grantDate, ownerNameOrGap } from "./sharingDisplay";

/**
 * Stage 3C's words: the in-app "shared with you" notice (answer 7).
 *
 * Spec: "Stage 3 plan — Collaboration" → "The in-app notice (7)":
 *
 *   Shared with you: Bob (Building Integrity) shared Smith House with you ·
 *   Sep 14. [Open Shared with us] [Got it]
 *
 * Pure, so every label is testable without a browser, and it decides NOTHING
 * about who is notified: `pending_share_notices()` (0008) already excludes
 * creator grants, grants you made yourself, and company grants made before you
 * joined. This only phrases what the database returned.
 *
 * Names and the owner company are SNAPSHOTS taken when the grant was made, the
 * same "as shared" rule the access list uses, so the date and the name here can
 * differ from today's — which is honest, not stale.
 */

/** The StickyNote's own label. */
export const SHARE_NOTICE_LABEL = "Shared with you";

export const SHARE_NOTICE_GOT_IT = "Got it";
export const SHARE_NOTICE_OPEN_SHARED = "Open Shared with us";

/**
 * Said under the list, because it is the one thing that stops "Got it" from
 * being a decision the person has to think about: dismissing loses no access
 * and no project. It is also the honest half of the accepted race below.
 */
export const SHARE_NOTICE_DURABLE_NOTE =
  "Projects shared with you stay in Open from cloud → Shared with us, whether or not you dismiss this.";

/**
 * A failed "Got it" LEAVES THE NOTICE SHOWING. Nothing is cleared locally on a
 * failure: the server's `seen_through` is the only record of what has been
 * seen, so pretending locally that it moved would hide notices this person has
 * never actually dismissed.
 */
export const SHARE_NOTICE_DISMISS_FAILED_MESSAGE =
  "Couldn't clear this just now, so it's still here. Nothing else changed — try Got it again.";

/**
 * What a failed "Got it" actually says.
 *
 * The route's OWN words are used when it refused for a reason we wrote (403,
 * from shareNoticeLogic's mapping — "couldn't clear those notices, so they're
 * still here"). Anything else gets the message above.
 *
 * WRITTEN BECAUSE THE FIRST VERSION SHOWED "Something went wrong." A route that
 * throws an unmapped error answers with errorResponse's deliberately generic
 * envelope, and passing that straight through put four words on the notice that
 * explain nothing, promise nothing and do not say the notice is still there.
 * Caught by this stage's own Chrome harness, not by review.
 */
export function dismissFailureMessage(status: number, routeMessage: string): string {
  return status === 403 && routeMessage.trim().length > 0 ? routeMessage : SHARE_NOTICE_DISMISS_FAILED_MESSAGE;
}

/** "Shared with you" / "Shared with you: 3 projects". */
export function shareNoticeHeading(projectCount: number): string {
  return projectCount > 1 ? `${SHARE_NOTICE_LABEL}: ${projectCount} projects` : SHARE_NOTICE_LABEL;
}

/**
 * One line per grant:
 *   "Bob (Building Integrity) shared Smith House with you · Sep 14, 2026"
 *   "Bob (Building Integrity) shared Smith House with Rare Forms · Sep 14, 2026"
 *
 * A missing sharer name reads "someone", the same gap wording the Shared tab
 * uses, rather than an empty pair of brackets.
 */
export function shareNoticeLine(row: ShareNoticeRow): string {
  const by = row.grantedByName ?? "someone";
  const owner = ownerNameOrGap(row.ownerCompanyName);
  const who = row.granteeKind === "person" ? "you" : row.granteeName;
  return `${by} (${owner}) shared ${displayProjectName(row.projectName)} with ${who} · ${grantDate(row.createdAt)}`;
}

/** One project, however many grants brought it here. */
export interface ShareNoticeGroup {
  projectId: string;
  /** Already display-safe: "(untitled)" rather than an empty string. */
  projectName: string;
  ownerCompanyName: string;
  /** One line per grant, oldest first, identical wordings collapsed. */
  lines: string[];
  /** Every grant in this group, for nothing more than a stable React key. */
  grantIds: string[];
  /** The oldest grant in the group, which is what the group is ordered by. */
  firstCreatedAt: string;
}

/**
 * SEVERAL AT ONCE. Grants arrive oldest first (0008 orders by `created_at`,
 * then `id`), and several can land between two sign-ins. They are grouped by
 * PROJECT, because being reached twice over is one piece of news, not two:
 * confirmed on local PostgreSQL 17.4, where sharing one project with a person
 * AND with their company really does return two rows with one `project_id`.
 *
 * Group order follows first appearance, so the oldest news stays at the top and
 * the list does not reshuffle as more arrives.
 */
export function groupShareNotices(rows: readonly ShareNoticeRow[]): ShareNoticeGroup[] {
  const groups: ShareNoticeGroup[] = [];
  const byProject = new Map<string, ShareNoticeGroup>();
  for (const row of rows) {
    const line = shareNoticeLine(row);
    const existing = byProject.get(row.projectId);
    if (existing) {
      if (!existing.lines.includes(line)) existing.lines.push(line);
      existing.grantIds.push(row.grantId);
      continue;
    }
    const group: ShareNoticeGroup = {
      projectId: row.projectId,
      projectName: displayProjectName(row.projectName),
      ownerCompanyName: row.ownerCompanyName,
      lines: [line],
      grantIds: [row.grantId],
      firstCreatedAt: row.createdAt,
    };
    byProject.set(row.projectId, group);
    groups.push(group);
  }
  return groups;
}
