"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import StickyNote from "../StickyNote";
import { cloudFetch } from "./cloudFetch";
import {
  displayProjectName,
  type AccessGrantRow,
  type ProjectAccessResponse,
  type RemoveGrantResponse,
  type ShareResponse,
  type ShareableCompaniesResponse,
  type ShareableCompany,
} from "./cloudTypes";
import {
  NAMES_AS_SHARED_NOTE,
  SHARE_ACCESS_LINE,
  accessRowText,
  cascadeOffer,
  companyShareLine,
  ownerAccessLine,
  removedMessage,
  showRemove,
} from "./sharingDisplay";
import styles from "./CloudProjects.module.css";

/**
 * Stage 3B: a project's access list and share form, as one StickyNote.
 * Reached by Access… on any Open from cloud row (all four tabs) and by
 * Project ▾ → Sharing… while a cloud project is open. Nothing on the top bar.
 *
 * It holds no permissions. Remove is shown where the route says the database
 * would allow it; the database (collaborators_delete) decides, and a refusal
 * is shown in the route's words. Every share answer — `no-account`,
 * `already-member` and the rest — is the route's message, shown as-is.
 */

export interface UseProjectAccessOptions {
  /** Re-read the session after a 401/403, as every other cloud action does. */
  onAuthProblem: () => void;
  /** A share was added or removed: lists that show sharing should reload. */
  onChanged: (projectId: string) => void;
}

type Outcome = { tone: "info" | "error"; text: string };

export function useProjectAccess({ onAuthProblem, onChanged }: UseProjectAccessOptions): {
  openAccess: (projectId: string, projectName: string) => void;
  reset: () => void;
  note: ReactNode;
} {
  const [isOpen, setIsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [target, setTarget] = useState<{ projectId: string; projectName: string } | null>(null);
  const [access, setAccess] = useState<ProjectAccessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<ShareableCompany[] | null>(null);
  const [companiesError, setCompaniesError] = useState<string | null>(null);

  const [shareKind, setShareKind] = useState<"person" | "company">("person");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirming, setConfirming] = useState<{ grantId: string; alsoRemove: boolean } | null>(null);

  /** Counts access-list requests: an older answer (another project, or before
   * an account change) is never shown. */
  const request = useRef(0);

  const load = useCallback(
    async (projectId: string) => {
      const id = ++request.current;
      setLoading(true);
      setLoadError(null);
      const result = await cloudFetch<ProjectAccessResponse>(`/api/projects/${encodeURIComponent(projectId)}/access`);
      if (id !== request.current) return;
      setLoading(false);
      if (!result.ok) {
        if (result.status === 401 || result.status === 403) onAuthProblem();
        setAccess(null);
        setLoadError(result.message);
        return;
      }
      setAccess(result.data);
    },
    [onAuthProblem],
  );

  const loadCompanies = useCallback(async () => {
    setCompaniesError(null);
    const result = await cloudFetch<ShareableCompaniesResponse>("/api/companies/shareable");
    if (!result.ok) {
      setCompanies(null);
      setCompaniesError(result.message);
      return;
    }
    setCompanies(result.data.companies);
  }, []);

  const openAccess = (projectId: string, projectName: string) => {
    setTarget({ projectId, projectName });
    setAccess((was) => (was && was.projectId === projectId ? was : null));
    setOutcome(null);
    setConfirming(null);
    setEmail("");
    setCompanyId("");
    setIsOpen(true);
    void load(projectId);
    if (companies === null) void loadCompanies();
  };

  const reset = useCallback(() => {
    request.current += 1;
    setIsOpen(false);
    setTarget(null);
    setAccess(null);
    setLoading(false);
    setLoadError(null);
    setCompanies(null);
    setOutcome(null);
    setConfirming(null);
  }, []);

  const share = async () => {
    if (!target || busy) return;
    const body = shareKind === "person" ? { kind: "person", email } : { kind: "company", companyId };
    setBusy(true);
    setOutcome(null);
    const result = await cloudFetch<ShareResponse>(`/api/projects/${encodeURIComponent(target.projectId)}/access`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) onAuthProblem();
      setOutcome({ tone: "error", text: result.message });
      return;
    }
    // Every status is an answer; only `shared` changed anything.
    setOutcome({ tone: "info", text: result.data.message });
    if (result.data.status === "shared") {
      setEmail("");
      setCompanyId("");
      onChanged(target.projectId);
    }
    void load(target.projectId);
  };

  const remove = async (row: AccessGrantRow, alsoRemove: string[]) => {
    if (!target || busy) return;
    setBusy(true);
    setOutcome(null);
    const result = await cloudFetch<RemoveGrantResponse>(
      `/api/projects/${encodeURIComponent(target.projectId)}/access/${encodeURIComponent(row.grantId)}`,
      { method: "DELETE", body: JSON.stringify({ alsoRemove }) },
    );
    setBusy(false);
    setConfirming(null);
    if (!result.ok) {
      if (result.status === 401 || result.status === 403) onAuthProblem();
      setOutcome({ tone: "error", text: result.message });
    } else {
      setOutcome({ tone: "info", text: removedMessage(row.granteeName, result.data.alsoRemoved, result.data.alsoNotRemoved) });
      onChanged(target.projectId);
    }
    void load(target.projectId);
  };

  const shown = access && target && access.projectId === target.projectId ? access : null;
  const ownerName = shown?.owner.name ?? "";
  const pickable = (companies ?? []).filter((c) => !shown || c.id !== shown.owner.id);
  const picked = pickable.find((c) => c.id === companyId) ?? null;
  const canSubmit = shareKind === "person" ? email.trim().length > 0 : picked !== null;

  const note = (
    <StickyNote
      id="cloud-access-note"
      label={`Access · ${displayProjectName(shown?.projectName ?? target?.projectName)}`}
      isOpen={isOpen}
      isFullscreen={fullscreen}
      cascadeIndex={0}
      onClose={() => {
        setIsOpen(false);
        setFullscreen(false);
      }}
      onToggleFullscreen={() => setFullscreen((was) => !was)}
    >
      <div className={styles.stack}>
        {loading && !shown ? (
          <p className={styles.muted}>Loading…</p>
        ) : loadError ? (
          <p className={styles.error}>{loadError}</p>
        ) : shown ? (
          <>
            <p className={styles.message} data-access-owner="">
              {ownerAccessLine(ownerName)}
            </p>
            {shown.grants.length === 0 ? (
              <p className={styles.muted}>Nobody outside {ownerName || "the owner company"} has been given access.</p>
            ) : (
              <>
                <ul className={styles.rows}>
                  {shown.grants.map((row) => {
                    const text = accessRowText(row);
                    const offer = cascadeOffer(row, shown.grants);
                    const confirmingThis = confirming?.grantId === row.grantId ? confirming : null;
                    return (
                      <li key={row.grantId} className={styles.row} data-grant-id={row.grantId}>
                        <span className={styles.rowHeading}>
                          <span className={styles.rowTitle}>{text.name}</span>
                          {text.kindNote && <span className={styles.rowMeta}>{text.kindNote}</span>}
                          {row.isYou && <span className={styles.marker}>you</span>}
                        </span>
                        <span className={styles.rowMeta}>{text.detail}</span>
                        {showRemove(row) && !confirmingThis && (
                          <span className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.button}
                              disabled={busy}
                              onClick={() => setConfirming({ grantId: row.grantId, alsoRemove: offer?.defaultChecked ?? false })}
                            >
                              Remove
                            </button>
                          </span>
                        )}
                        {confirmingThis && (
                          <div className={styles.stack} data-remove-confirm="">
                            <p className={styles.lead}>
                              Remove {text.name}&apos;s access? Earlier downloads and copies aren&apos;t recalled.
                            </p>
                            {offer && (
                              <label className={styles.checkRow}>
                                <input
                                  type="checkbox"
                                  checked={confirmingThis.alsoRemove}
                                  onChange={(e) => setConfirming({ ...confirmingThis, alsoRemove: e.target.checked })}
                                />
                                <span>
                                  {offer.label} ({offer.recipients.join(", ")})
                                </span>
                              </label>
                            )}
                            <div className={styles.actions}>
                              <button
                                type="button"
                                className={styles.primary}
                                disabled={busy}
                                onClick={() => void remove(row, offer && confirmingThis.alsoRemove ? offer.grantIds : [])}
                              >
                                {busy ? "Removing…" : "Remove"}
                              </button>
                              <button type="button" className={styles.button} disabled={busy} onClick={() => setConfirming(null)}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className={styles.muted}>{NAMES_AS_SHARED_NOTE}</p>
              </>
            )}

            <form
              className={styles.stack}
              data-share-form=""
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) void share();
              }}
            >
              <p className={styles.lead}>
                <strong>Share this project</strong>
              </p>
              <div className={styles.tabs} role="group" aria-label="Share with">
                {(["person", "company"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={shareKind === k ? styles.tabActive : styles.tab}
                    aria-pressed={shareKind === k}
                    onClick={() => {
                      setShareKind(k);
                      setOutcome(null);
                    }}
                  >
                    {k === "person" ? "Person" : "Company"}
                  </button>
                ))}
              </div>
              {shareKind === "person" ? (
                <label className={styles.field}>
                  Their email
                  <input className={styles.input} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
              ) : companiesError ? (
                <p className={styles.error}>{companiesError}</p>
              ) : (
                <label className={styles.field}>
                  Company
                  <select className={styles.select} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                    <option value="">{companies === null ? "Loading…" : "Choose a company…"}</option>
                    {pickable.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className={styles.muted}>
                {SHARE_ACCESS_LINE}
                {shareKind === "company" && picked ? ` ${companyShareLine(picked.name, picked.isConsortium)}` : ""}
              </p>
              {outcome && <p className={outcome.tone === "error" ? styles.error : styles.message}>{outcome.text}</p>}
              <div className={styles.actions}>
                <button type="submit" className={styles.primary} disabled={busy || !canSubmit}>
                  {busy ? "Working…" : "Share"}
                </button>
              </div>
            </form>
          </>
        ) : null}
        <div className={styles.actions}>
          {target && (
            <button type="button" className={styles.button} disabled={loading} onClick={() => void load(target.projectId)}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          )}
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setIsOpen(false);
              setFullscreen(false);
            }}
          >
            Close
          </button>
        </div>
      </div>
    </StickyNote>
  );

  return { openAccess, reset, note };
}
