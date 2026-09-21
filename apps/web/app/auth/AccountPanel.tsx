"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import CompanyBackupSection from "../cloud/CompanyBackupSection";
import type { CompanyBackupController } from "../cloud/useCompanyBackup";
import { useAuth } from "./AuthProvider";
import {
  ACTION_KIND_NOTE,
  MEMBER_SINCE_NOTE,
  PROMOTE_GRANTS,
  actionLine,
  actionsToggleLabel,
  adminCountOf,
  canRemoveMember,
  isAdminHereFor,
  LEVEL_CHANGED_RELOAD_FAILED,
  levelControl,
  levelErrorMessage,
  memberSinceLabel,
  scopeNote,
  versionCountLabel,
} from "./peopleActivity";
import type { CompanyInviteSummary, CompanyMemberSummary } from "./types";
import styles from "./AccountControl.module.css";

interface EnrolState {
  factorId: string;
  secret: string;
  uri: string;
}

/**
 * The signed-in account panel: who you are, two-factor, and — when you are an
 * admin of the company you are acting as — that company's people and invites.
 *
 * "An admin of the company you are acting as" is doing real work in that
 * sentence. Level is per-membership, so one person can be an admin at Building
 * Integrity and a plain member at Rare Forms; which powers apply follows the
 * switcher. The UI hides what does not apply, and every call below is refused
 * by an RLS policy as well if the UI is wrong or bypassed.
 */
export default function AccountPanel({ backup }: { backup: CompanyBackupController }) {
  const { session, signOut, refresh } = useAuth();
  const user = session.user;

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [enrol, setEnrol] = useState<EnrolState | null>(null);
  const [code, setCode] = useState("");
  const [members, setMembers] = useState<CompanyMemberSummary[] | null>(null);
  const [invites, setInvites] = useState<CompanyInviteSummary[] | null>(null);
  // Which row is mid-confirmation for Make admin, and which row has its action
  // list open. Membership ids, or null.
  const [confirmPromote, setConfirmPromote] = useState<string | null>(null);
  const [openActions, setOpenActions] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLevel, setInviteLevel] = useState<"member" | "admin">("member");
  const [freshInviteUrl, setFreshInviteUrl] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyAdminEmail, setNewCompanyAdminEmail] = useState("");
  const [founded, setFounded] = useState<{ name: string; url: string } | null>(null);
  // Your own display name. Empty means "no name": saved versions then show
  // your email instead (0006 snapshots the name at save time, so a change
  // applies to versions saved afterwards, not to earlier ones).
  const savedDisplayName = user?.displayName ?? "";
  const [nameDraft, setNameDraft] = useState(savedDisplayName);
  useEffect(() => {
    setNameDraft(savedDisplayName);
  }, [savedDisplayName]);

  // A platform admin administers the people of whichever company they are acting
  // as: the memberships and invites policies are `is_company_admin(company_id)
  // or is_platform_admin()`, and the routes defer to them. Gating on
  // actingAsLevel alone hid the people list and invite form from a platform
  // admin at any company where they hold no admin membership — so a company
  // with no admin yet (Rare Forms, 2026-09-14) could not be given its first
  // member from the app.
  const isAdminHere = isAdminHereFor({
    actingAsLevel: session.actingAsLevel,
    actingAsCompanyId: session.actingAsCompanyId,
    isPlatformAdmin: Boolean(user?.isPlatformAdmin),
  });
  const companyId = session.actingAsCompanyId;
  // Decision 27: creating a company is open to company admins at any member
  // company. Level is per-membership, so this asks "an admin anywhere", not
  // "an admin here" — a different question from isAdminHere above, and the
  // server asks it again in the companies_insert policy regardless.
  const isAdminSomewhere = session.entitlements.some(
    (entitlement) => entitlement.source === "membership" && entitlement.level === "admin",
  );

  // EVERYONE with a company loads the people list, admin or not: the policies
  // hand an ordinary member exactly one row — their own — which is what "each
  // account can see these stats on their account page" needs, with no second
  // component and no second route. Invites stay behind the admin gate because
  // that route is an admin's; asking for them as a member would only produce a
  // refusal to display.
  const loadCompany = useCallback(async () => {
    if (!companyId) {
      setMembers(null);
      setInvites(null);
      return;
    }
    const [membersResponse, invitesResponse] = await Promise.all([
      fetch(`/api/companies/${companyId}/members`, { cache: "no-store" }),
      isAdminHere ? fetch(`/api/companies/${companyId}/invites`, { cache: "no-store" }) : Promise.resolve(null),
    ]);
    setMembers(membersResponse.ok ? (await membersResponse.json()).members : null);
    setInvites(invitesResponse?.ok ? (await invitesResponse.json()).invites : null);
  }, [companyId, isAdminHere]);

  useEffect(() => {
    void loadCompany();
  }, [loadCompany]);

  const call = useCallback(async (url: string, init: RequestInit) => {
    setError(null);
    const response = await fetch(url, init);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error ?? "Something went wrong");
    return payload;
  }, []);

  if (!user) return null;

  const startEnrol = async () => {
    try {
      const data = await call("/api/auth/mfa/enroll", { method: "POST" });
      setEnrol({ factorId: data.factorId, secret: data.secret, uri: data.uri });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start enrolment");
    }
  };

  const finishEnrol = async (event: FormEvent) => {
    event.preventDefault();
    if (!enrol) return;
    try {
      await call("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ factorId: enrol.factorId, code }),
      });
      setEnrol(null);
      setCode("");
      setNotice("Two-factor is on for this account.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work");
    }
  };

  const sendInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    try {
      const data = await call(`/api/companies/${companyId}/invites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, level: inviteLevel }),
      });
      setFreshInviteUrl(data.url);
      setInviteEmail("");
      await loadCompany();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that invite");
    }
  };

  // Naming the company and inviting its first admin are one request, because
  // they are one operation: nobody administers a brand-new company, so the
  // invite cannot be written by any later call the creator is allowed to make.
  const createCompany = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const data = await call("/api/companies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newCompanyName, firstAdminEmail: newCompanyAdminEmail }),
      });
      setFounded({ name: data.companyName, url: data.url });
      setNewCompanyName("");
      setNewCompanyAdminEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that company");
    }
  };

  const removeMember = async (membershipId: string) => {
    try {
      await call(`/api/memberships/${membershipId}`, { method: "DELETE" });
      await loadCompany();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that person");
    }
  };

  /**
   * Make admin / Remove admin. One call to the route that already accepted it:
   * `PATCH /api/memberships/[id]` with `{ level }`. No new route, no new policy
   * — the database has permitted this since Stage 1 and the app simply had no
   * button (README Stage 1 step 7, undoable from the UI until now).
   *
   * Every refusal here is the database's: `guard_membership_self_update` for
   * someone who is not a company admin, `guard_last_company_admin` for the
   * demotion that would leave a company with nobody to administer it. They are
   * shown in words rather than swallowed.
   */
  const changeLevel = async (membershipId: string, level: "member" | "admin") => {
    setConfirmPromote(null);
    // call() clears the error; clear any earlier notice too, so an old one
    // ("Level changed…", "Two-factor is on…") can't linger beside this result.
    setNotice(null);
    try {
      await call(`/api/memberships/${membershipId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level }),
      });
    } catch (err) {
      setError(levelErrorMessage(err instanceof Error ? err.message : null));
      return;
    }
    // The change has landed. Anything that fails from here on is only the
    // reload, so it must not claim the change failed (found in review).
    try {
      await loadCompany();
      // Your own level may have just changed, and it decides what the rest of
      // this panel offers.
      await refresh();
    } catch {
      setNotice(LEVEL_CHANGED_RELOAD_FAILED);
    }
  };

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await call("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: nameDraft }),
      });
      setNotice(
        nameDraft.trim()
          ? "Name saved. It will appear on versions you save from now on."
          : "Name cleared. Versions you save from now on will show your email.",
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your name");
    }
  };

  const withdrawInvite = async (inviteId: string) => {
    try {
      await call(`/api/invites/${inviteId}`, { method: "DELETE" });
      await loadCompany();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't withdraw that invite");
    }
  };

  // Derived from the list as loaded, which is what the buttons have to agree
  // with: an ordinary member's list is their own row alone, and they get no
  // buttons at all.
  const memberList = members ?? [];
  const adminCount = adminCountOf(memberList);

  return (
    <div className={styles.form}>
      <div>
        <strong>{user.displayName || user.email}</strong>
        <div className={styles.rowSub}>{user.email}</div>
        {user.isPlatformAdmin && <div className={styles.rowSub}>Platform admin</div>}
      </div>

      <form className={styles.form} onSubmit={saveName}>
        <label className={styles.field}>
          Your name
          <input
            className={styles.input}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder={user.email}
            maxLength={100}
            autoComplete="name"
          />
        </label>
        <p className={styles.notice}>
          Shown on the versions you save to the cloud. Leave it blank to show your email instead.
        </p>
        <button
          className={styles.button}
          type="submit"
          disabled={nameDraft.trim() === savedDisplayName.trim()}
        >
          Save name
        </button>
      </form>

      {session.mfaPending && (
        <p className={styles.error}>
          Waiting on your two-factor code — sign in again and enter it to finish.
        </p>
      )}

      <p className={styles.sectionTitle}>Two-factor</p>
      {user.hasTwoFactor ? (
        <p className={styles.ok}>
          On. It is optional for every account here, platform admin included — this is a choice you
          made, not a requirement.
        </p>
      ) : enrol ? (
        <form className={styles.form} onSubmit={finishEnrol}>
          <p className={styles.notice}>
            Add this secret to your authenticator app, then enter the code it shows.
          </p>
          <div className={styles.inviteLink}>{enrol.secret}</div>
          <label className={styles.field}>
            Code
            <input
              className={styles.input}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <button className={styles.primaryButton} type="submit">
            Turn on two-factor
          </button>
        </form>
      ) : (
        <>
          <p className={styles.notice}>
            Off. Two-factor is optional and encouraged — it is not required for any account, and
            leaving it off is a supported choice rather than an outstanding task.
          </p>
          <button className={styles.button} type="button" onClick={startEnrol}>
            Set up two-factor
          </button>
        </>
      )}

      {/* People & activity (spec, 2026-09-20). Gated on having a list rather
          than on being an admin: a plain member's list is one row — their own —
          and that is their account page. Acting as a company you hold no
          membership at (the consortium) returns nothing, so nothing renders. */}
      {companyId && memberList.length > 0 && (
        <>
          <p className={styles.sectionTitle}>{session.actingAsCompanyName} — people</p>
          <ul className={styles.list}>
            {memberList.map((member) => {
              const control = levelControl(member, { isAdminHere, adminCount });
              const actionsOpen = openActions === member.membershipId;
              return (
                <li key={member.membershipId} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span>{member.displayName || member.email}</span>
                    <span className={styles.rowSub}>
                      {member.email} · {member.level}
                    </span>
                    <span className={styles.rowSub}>{memberSinceLabel(member.memberSince)}</span>
                    <span className={styles.rowSub}>
                      {versionCountLabel(
                        member.versionCount,
                        member.versionCountExact,
                        session.actingAsCompanyName,
                      )}
                    </span>
                    {member.recentActions.length > 0 ? (
                      <button
                        className={styles.linkButton}
                        type="button"
                        aria-expanded={actionsOpen}
                        onClick={() => setOpenActions(actionsOpen ? null : member.membershipId)}
                      >
                        {actionsToggleLabel(member.recentActions.length)}
                      </button>
                    ) : (
                      <span className={styles.rowSub}>{actionsToggleLabel(0)}</span>
                    )}
                    {actionsOpen && (
                      <ul className={styles.list}>
                        {member.recentActions.map((action) => (
                          <li key={action.versionId} className={styles.rowSub}>
                            {actionLine(action, member.displayName)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {control.kind === "demote" && control.refusal && (
                      <span className={styles.rowSub}>{control.refusal}</span>
                    )}
                    {control.kind === "promote" && confirmPromote === member.membershipId && (
                      <span className={styles.rowSub}>{PROMOTE_GRANTS}</span>
                    )}
                  </span>
                  <span className={styles.rowMain}>
                    {control.kind === "promote" &&
                      (confirmPromote === member.membershipId ? (
                        <>
                          <button
                            className={styles.linkButton}
                            type="button"
                            onClick={() => void changeLevel(member.membershipId, "admin")}
                          >
                            Yes, make admin
                          </button>
                          <button
                            className={styles.linkButton}
                            type="button"
                            onClick={() => setConfirmPromote(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className={styles.linkButton}
                          type="button"
                          onClick={() => {
                            setError(null);
                            setConfirmPromote(member.membershipId);
                          }}
                        >
                          {control.label}
                        </button>
                      ))}
                    {control.kind === "demote" && (
                      <button
                        className={styles.linkButton}
                        type="button"
                        onClick={() => void changeLevel(member.membershipId, "member")}
                      >
                        {control.label}
                      </button>
                    )}
                    {canRemoveMember({ isAdminHere }) && (
                      <button
                        className={styles.linkButton}
                        type="button"
                        onClick={() => void removeMember(member.membershipId)}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.notice}>{scopeNote(session.actingAsCompanyName ?? "")}</p>
          <p className={styles.notice}>{MEMBER_SINCE_NOTE}</p>
          <p className={styles.notice}>{ACTION_KIND_NOTE}</p>
          {isAdminHere && (
            <p className={styles.notice}>
              Removing someone revokes their access from their next request onward. Their name stays
              on anything they saved — attribution is history, not access.
            </p>
          )}
        </>
      )}

      {isAdminHere && companyId && (
        <>
          <p className={styles.sectionTitle}>Invite someone</p>
          <form className={styles.form} onSubmit={sendInvite}>
            <label className={styles.field}>
              Email
              <input
                className={styles.input}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Level
              <select
                className={styles.input}
                value={inviteLevel}
                onChange={(e) => setInviteLevel(e.target.value as "member" | "admin")}
              >
                <option value="member">Member</option>
                <option value="admin">Company admin</option>
              </select>
            </label>
            <button className={styles.primaryButton} type="submit">
              Create invite link
            </button>
          </form>
          {freshInviteUrl && (
            <>
              <p className={styles.ok}>
                Send them this link yourself. It is shown once — only its hash is stored, so it
                cannot be looked up again, only reissued.
              </p>
              <div className={styles.inviteLink}>{freshInviteUrl}</div>
            </>
          )}
          {(invites ?? []).length > 0 && (
            <>
              <p className={styles.sectionTitle}>Invites</p>
              <ul className={styles.list}>
                {(invites ?? []).map((invite) => (
                  <li key={invite.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <span>{invite.email}</span>
                      <span className={styles.rowSub}>
                        {invite.acceptedAt
                          ? `accepted ${new Date(invite.acceptedAt).toLocaleDateString()}`
                          : `expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                      </span>
                    </span>
                    {!invite.acceptedAt && (
                      <button
                        className={styles.linkButton}
                        type="button"
                        onClick={() => void withdrawInvite(invite.id)}
                      >
                        Withdraw
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Stage 2D. The same gate as the people list (isAdminHere): a company
              admin here, or a platform admin acting as this company, which is
              exactly who GET /api/companies/[id]/backup accepts. A convenience
              gate, not a security one (Open Item 4). */}
          <CompanyBackupSection
            backup={backup}
            companyId={companyId}
            companyName={session.actingAsCompanyName ?? ""}
          />
        </>
      )}

      {isAdminSomewhere && (
        <>
          <p className={styles.sectionTitle}>Start a new company</p>
          {founded ? (
            <>
              <p className={styles.ok}>
                {founded.name} exists, and its first admin has been invited. You are{" "}
                <strong>not</strong> a member of it and never will be by having created it — you
                cannot see it, and this link is the only thing you hold. Send it to them yourself;
                it is shown once, and only its hash is stored.
              </p>
              <div className={styles.inviteLink}>{founded.url}</div>
              <button
                className={styles.button}
                type="button"
                onClick={() => setFounded(null)}
              >
                Start another
              </button>
            </>
          ) : (
            <>
              <form className={styles.form} onSubmit={createCompany}>
                <label className={styles.field}>
                  Company name
                  <input
                    className={styles.input}
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  First admin&apos;s email
                  <input
                    className={styles.input}
                    type="email"
                    value={newCompanyAdminEmail}
                    onChange={(e) => setNewCompanyAdminEmail(e.target.value)}
                  />
                </label>
                <button className={styles.primaryButton} type="submit">
                  Create company and invite its admin
                </button>
              </form>
              <p className={styles.notice}>
                Creating is not joining: you get no access to the company you create, from the
                moment it exists. Check the address before you send — you will not be able to
                withdraw or reissue this invite.
              </p>
              <p className={styles.notice}>
                A new company is not part of the co-operative until Tommy says so. Whether other
                member companies can see its work is a decision, not a side effect of creating it.
              </p>
            </>
          )}
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
      {notice && <p className={styles.ok}>{notice}</p>}

      <button className={styles.button} type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      <p className={styles.notice}>
        Signing out leaves the editor exactly as it is, unsaved work included.
      </p>
    </div>
  );
}
