"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
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
export default function AccountPanel() {
  const { session, signOut, refresh } = useAuth();
  const user = session.user;

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [enrol, setEnrol] = useState<EnrolState | null>(null);
  const [code, setCode] = useState("");
  const [members, setMembers] = useState<CompanyMemberSummary[] | null>(null);
  const [invites, setInvites] = useState<CompanyInviteSummary[] | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLevel, setInviteLevel] = useState<"member" | "admin">("member");
  const [freshInviteUrl, setFreshInviteUrl] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyAdminEmail, setNewCompanyAdminEmail] = useState("");
  const [founded, setFounded] = useState<{ name: string; url: string } | null>(null);

  const isAdminHere = session.actingAsLevel === "admin";
  const companyId = session.actingAsCompanyId;
  // Decision 27: creating a company is open to company admins at any member
  // company. Level is per-membership, so this asks "an admin anywhere", not
  // "an admin here" — a different question from isAdminHere above, and the
  // server asks it again in the companies_insert policy regardless.
  const isAdminSomewhere = session.entitlements.some(
    (entitlement) => entitlement.source === "membership" && entitlement.level === "admin",
  );

  const loadCompany = useCallback(async () => {
    if (!companyId || !isAdminHere) {
      setMembers(null);
      setInvites(null);
      return;
    }
    const [membersResponse, invitesResponse] = await Promise.all([
      fetch(`/api/companies/${companyId}/members`, { cache: "no-store" }),
      fetch(`/api/companies/${companyId}/invites`, { cache: "no-store" }),
    ]);
    if (membersResponse.ok) setMembers((await membersResponse.json()).members);
    if (invitesResponse.ok) setInvites((await invitesResponse.json()).invites);
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

  const withdrawInvite = async (inviteId: string) => {
    try {
      await call(`/api/invites/${inviteId}`, { method: "DELETE" });
      await loadCompany();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't withdraw that invite");
    }
  };

  return (
    <div className={styles.form}>
      <div>
        <strong>{user.displayName || user.email}</strong>
        <div className={styles.rowSub}>{user.email}</div>
        {user.isPlatformAdmin && <div className={styles.rowSub}>Platform admin</div>}
      </div>

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

      {isAdminHere && companyId && (
        <>
          <p className={styles.sectionTitle}>{session.actingAsCompanyName} — people</p>
          <ul className={styles.list}>
            {(members ?? []).map((member) => (
              <li key={member.membershipId} className={styles.row}>
                <span className={styles.rowMain}>
                  <span>{member.displayName || member.email}</span>
                  <span className={styles.rowSub}>
                    {member.email} · {member.level}
                  </span>
                </span>
                <button
                  className={styles.linkButton}
                  type="button"
                  onClick={() => void removeMember(member.membershipId)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.notice}>
            Removing someone revokes their access from their next request onward. Their name stays on
            anything they saved — attribution is history, not access.
          </p>

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
