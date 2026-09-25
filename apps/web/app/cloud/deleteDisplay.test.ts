import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { DeletePreviewResponse, DeleteProjectResponse } from "./cloudTypes";
import {
  DELETED_WAS_OPEN_HERE_LINE,
  DELETE_ARCHIVE_LINE,
  DELETE_CONFIRM_REQUIRED_MESSAGE,
  DELETE_IRREVERSIBLE_LINE,
  DELETE_NOT_ADMIN_MESSAGE,
  DELETE_PREVIEW_REFUSED_MESSAGE,
  DELETE_REFUSED_MESSAGE,
  countPhrase,
  deleteConfirmPrompt,
  deleteFootprintLines,
  deleteHeading,
  deleteNameMismatchMessage,
  deletedMessage,
} from "./deleteDisplay";

const PREVIEW: DeletePreviewResponse = {
  projectId: "5768ff5e-b9ff-4b18-bdcb-f9ccd9043b25",
  projectName: "Smith Residence",
  ownerCompanyName: "Building Integrity",
  folder: "current",
  headVersionNumber: 7,
  versionCount: 7,
  grantCount: 2,
  accessRequestCount: 1,
  confirmationPhrase: "Smith Residence",
};

const RESULT: DeleteProjectResponse = {
  projectId: PREVIEW.projectId,
  projectName: "Smith Residence",
  ownerCompanyName: "Building Integrity",
  deletedVersions: 7,
  deletedGrants: 2,
  deletedAccessRequests: 1,
};

describe("every refusal says what was not changed", () => {
  it("names the project as still there, in each of the four refusals", () => {
    for (const message of [
      DELETE_NOT_ADMIN_MESSAGE,
      DELETE_REFUSED_MESSAGE,
      DELETE_PREVIEW_REFUSED_MESSAGE,
      DELETE_CONFIRM_REQUIRED_MESSAGE,
      deleteNameMismatchMessage("Smith House"),
    ]) {
      expect(message).toMatch(/nothing was deleted/i);
    }
  });

  it("says who may delete, without saying whether the project exists", () => {
    expect(DELETE_NOT_ADMIN_MESSAGE).toMatch(/platform admin/);
    expect(DELETE_NOT_ADMIN_MESSAGE).not.toMatch(/project doesn't exist|not found/i);
  });

  it("gives the same answer for a project that isn't there and one that isn't yours", () => {
    expect(DELETE_REFUSED_MESSAGE).toMatch(/doesn't exist, or you can't delete it/);
  });

  /** The renamed-while-open case has to be readable as a rename, not only as
   * a typo, because that is the one where carrying on would be wrong. */
  it("names the project's current name when the typed name does not match", () => {
    const message = deleteNameMismatchMessage("Smith House");
    expect(message).toContain('"Smith House"');
    expect(message).toMatch(/renamed/);
  });
});

describe("countPhrase — a gap, never a wrong zero", () => {
  it("counts in singular and plural", () => {
    expect(countPhrase(1, "saved version", "saved versions")).toBe("1 saved version");
    expect(countPhrase(7, "saved version", "saved versions")).toBe("7 saved versions");
    expect(countPhrase(0, "saved version", "saved versions")).toBe("0 saved versions");
  });

  it("says the count is unknown rather than printing 0 for a failed read", () => {
    const phrase = countPhrase(null, "saved version", "saved versions");
    expect(phrase).toMatch(/unknown/);
    expect(phrase).toMatch(/couldn't be counted/);
    expect(phrase).not.toMatch(/\b0\b/);
  });
});

describe("the warning names what will be destroyed, and how much", () => {
  it("heads with the project, its owner and the word permanently", () => {
    const heading = deleteHeading("Smith Residence", "Building Integrity");
    expect(heading).toContain('"Smith Residence"');
    expect(heading).toContain("Building Integrity");
    expect(heading).toMatch(/^Permanently delete/);
  });

  it("shows an unnamed project as the tree's own gap marker", () => {
    expect(deleteHeading("", "Building Integrity")).toContain('"(untitled)"');
  });

  it("shows a gap for an owner company name that could not be read", () => {
    expect(deleteHeading("Smith Residence", "")).toMatch(/name couldn't be read/);
  });

  it("lists the project, its versions, its shares and its access requests — the three cascades and the row", () => {
    const lines = deleteFootprintLines(PREVIEW);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Current Projects");
    expect(lines[0]).toContain("7 saved versions");
    expect(lines[0]).toContain("v7");
    expect(lines[1]).toContain("2 shares");
    expect(lines[2]).toContain("1 access request");
  });

  it("carries the unknown counts through to the bullets", () => {
    const lines = deleteFootprintLines({ ...PREVIEW, versionCount: null, grantCount: null, accessRequestCount: null });
    for (const line of lines) expect(line).toMatch(/unknown/);
  });

  it("says it cannot be undone, and offers the archive instead", () => {
    expect(DELETE_IRREVERSIBLE_LINE).toMatch(/cannot be undone/);
    expect(DELETE_IRREVERSIBLE_LINE).toMatch(/no restore/);
    expect(DELETE_ARCHIVE_LINE).toMatch(/Past Projects/);
    expect(DELETE_ARCHIVE_LINE).toMatch(/keeps every version/);
  });

  it("asks for the name to be typed, and shows exactly the phrase", () => {
    expect(deleteConfirmPrompt("Smith Residence")).toBe("To confirm, type the project's name exactly: Smith Residence");
    expect(deleteConfirmPrompt("(untitled)")).toContain("(untitled)");
  });
});

describe("the success message", () => {
  it("says what went with the project, and that nothing else did", () => {
    const message = deletedMessage(RESULT);
    expect(message).toContain('"Smith Residence"');
    expect(message).toContain("Building Integrity");
    expect(message).toContain("7 saved versions");
    expect(message).toContain("2 shares");
    expect(message).toContain("1 access request");
    expect(message).toMatch(/Nothing else was touched/);
  });

  it("does not claim a count it never had", () => {
    const message = deletedMessage({ ...RESULT, deletedVersions: null, deletedGrants: null, deletedAccessRequests: null });
    expect(message).toMatch(/unknown number of saved versions/);
    expect(message).not.toMatch(/\b0 /);
  });

  it("shows an unnamed project as the gap marker, and a missing owner as a gap", () => {
    const message = deletedMessage({ ...RESULT, projectName: "", ownerCompanyName: "" });
    expect(message).toContain('"(untitled)"');
    expect(message).toContain("its company");
  });

  /**
   * Deleting the project open in this editor does NOT take the drawing away,
   * and does not move the title-block date. The line has to say so, because
   * "deleted" and "the design vanished" are easy to hear as the same thing.
   */
  it("tells the editor's owner their design on screen is untouched", () => {
    expect(DELETED_WAS_OPEN_HERE_LINE).toMatch(/design on screen was not changed/);
    expect(DELETED_WAS_OPEN_HERE_LINE).toMatch(/no longer attached/);
  });
});

describe("the words decide nothing", () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it("holds no permission logic: no session, no client, no policy test", () => {
    const source = readFileSync(join(here, "deleteDisplay.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(source).not.toMatch(/supabase|SupabaseClient|auth\.uid|createClient/i);
    expect(source).not.toMatch(/fetch\(/);
  });

  it("does not reword roleDisclaimers or any disclaimer string", () => {
    const source = readFileSync(join(here, "deleteDisplay.ts"), "utf8");
    expect(source).not.toMatch(/roleDisclaimer|disclaimer/i);
  });
});
