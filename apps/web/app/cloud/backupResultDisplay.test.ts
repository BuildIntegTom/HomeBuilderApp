import { describe, expect, it } from "vitest";
import { BACKUP_TAB_NOTICE, backupSwitchedAwayMessage, showsBackupResult } from "./backupResultDisplay";
import type { CompanyBackupState } from "./useCompanyBackup";

const OLD = "11111111-0000-0000-0000-000000000001";
const NEW = "22222222-0000-0000-0000-000000000001";

// The real union, not a lookalike: passing `CompanyBackupState` values into
// `showsBackupResult` is what proves the structural gate type still matches the
// hook's state, including the `switchedAway` field name.
const cancelledBySwitch: CompanyBackupState = {
  status: "cancelled",
  companyId: OLD,
  message: backupSwitchedAwayMessage("Rare Forms"),
  switchedAway: true,
};

const cancelledByButton: CompanyBackupState = {
  status: "cancelled",
  companyId: OLD,
  message: "Backup cancelled. No file was saved.",
  switchedAway: false,
};

const failed: CompanyBackupState = {
  status: "failed",
  companyId: OLD,
  message: "The server refused a backup page (500).",
};

const done: CompanyBackupState = {
  status: "done",
  companyId: OLD,
  fileName: "company-backup--rare-forms--2026-09-27T1402Z.zip",
  versionCount: 7,
  projectCount: 4,
  outsideWindowCount: 0,
  zipBytes: 4096,
};

describe("showsBackupResult", () => {
  it("shows a company's own finished run on that company's panel", () => {
    expect(showsBackupResult(done, OLD)).toBe(true);
    expect(showsBackupResult(failed, OLD)).toBe(true);
    expect(showsBackupResult(cancelledByButton, OLD)).toBe(true);
  });

  it("does not show another company's done or failed run", () => {
    expect(showsBackupResult(done, NEW)).toBe(false);
    expect(showsBackupResult(failed, NEW)).toBe(false);
  });

  // THE STAGE 2D DEFECT. The switch that killed the run also moved the panel to
  // the new company, so an equality gate hid the one message written for it.
  it("shows a run the acting-as switch killed, even though the panel has moved on", () => {
    expect(showsBackupResult(cancelledBySwitch, NEW)).toBe(true);
  });

  it("still shows that run on the panel of the company it was for, if you switch back", () => {
    expect(showsBackupResult(cancelledBySwitch, OLD)).toBe(true);
  });

  it("does NOT widen a hand-cancelled run to another company's panel", () => {
    // Pressing Cancel is not switching away: that message says nothing about
    // which company it was, so it must stay where it happened.
    expect(showsBackupResult(cancelledByButton, NEW)).toBe(false);
  });

  it("shows nothing while idle or running", () => {
    expect(showsBackupResult({ status: "idle" }, OLD)).toBe(false);
    expect(showsBackupResult({ status: "running", companyId: OLD }, OLD)).toBe(false);
    // A running backup reports through the progress line, which has its own
    // wording for "another company's backup is running".
    expect(showsBackupResult({ status: "running", companyId: OLD, switchedAway: true }, NEW)).toBe(false);
  });
});

describe("backupSwitchedAwayMessage", () => {
  it("names the company the backup was for, since the screen is now showing another one", () => {
    expect(backupSwitchedAwayMessage("Rare Forms")).toBe(
      "Backup stopped because you switched away from Rare Forms. No file was saved.",
    );
  });

  it("says no file was saved, because none was", () => {
    expect(backupSwitchedAwayMessage("Building Integrity")).toContain("No file was saved.");
  });
});

describe("BACKUP_TAB_NOTICE", () => {
  // The copy half of the same defect: the notice volunteered that closing the
  // panel is safe and said nothing about the switch, which is the gesture that
  // actually stops the run.
  it("names BOTH nearby gestures — the safe one and the one that stops the backup", () => {
    expect(BACKUP_TAB_NOTICE).toContain("Closing this panel does not stop it");
    expect(BACKUP_TAB_NOTICE).toMatch(/switching to another company does/);
  });

  it("keeps the instruction that makes the rest of it make sense", () => {
    expect(BACKUP_TAB_NOTICE).toContain("keep this tab open until it finishes");
  });
});

describe("backupSwitchedAwayMessage's fallback", () => {
  // The guard in useCompanyBackup used `??`, which only catches null — while
  // the one caller (AccountPanel) passes `session.actingAsCompanyName ?? ""`,
  // so the value that can actually arrive is the EMPTY STRING. These pin the
  // distinction rather than the operator, so a later revert to `??` fails here
  // instead of shipping "…switched away from ."
  it("reads as a sentence when the name is an empty string, which is what the caller can pass", () => {
    const name = "" || "that company";
    expect(backupSwitchedAwayMessage(name)).toBe(
      "Backup stopped because you switched away from that company. No file was saved.",
    );
  });

  it("names the company when there is one", () => {
    expect(backupSwitchedAwayMessage("Rare Forms")).toContain("switched away from Rare Forms");
  });

  it("never renders an empty name — the sentence always has a subject", () => {
    for (const raw of ["", "   ".trim(), undefined as unknown as string, null as unknown as string]) {
      const message = backupSwitchedAwayMessage(raw || "that company");
      expect(message).not.toMatch(/switched away from \./);
      expect(message).toMatch(/switched away from \S/);
    }
  });
});
