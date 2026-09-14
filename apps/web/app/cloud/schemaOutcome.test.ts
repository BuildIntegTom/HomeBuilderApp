import { describe, expect, it } from "vitest";
import { PROJECT_FILE_VERSION } from "../projectFile";
import { classifyCloudSchemaVersion, cloudVersionFileName } from "./schemaOutcome";

const CURRENT = 24;

describe("classifyCloudSchemaVersion", () => {
  it("opens the current format", () => {
    expect(classifyCloudSchemaVersion(24, 7, CURRENT)).toEqual({ kind: "opens" });
  });

  it("opens the one-back format through the existing migration", () => {
    expect(classifyCloudSchemaVersion(23, 7, CURRENT)).toEqual({ kind: "opens-via-migration" });
  });

  it("refuses an older format visibly, in the spec's words, and offers the raw file", () => {
    expect(classifyCloudSchemaVersion(22, 3, CURRENT)).toEqual({
      kind: "too-old",
      message: "Version 3 was saved by an older version of the app (file format 22) and can't be opened by this one.",
      offerDownload: true,
    });
  });

  it("tells a stale tab to reload for a newer format, with no download", () => {
    expect(classifyCloudSchemaVersion(25, 9, CURRENT)).toEqual({
      kind: "too-new",
      message: "This version was saved by a newer version of the app. Reload the page to open it.",
      offerDownload: false,
    });
  });

  it.each([[null], ["24"], [24.5], [undefined]])("treats a schemaVersion of %s as unreadable, still offering the file", (value) => {
    const outcome = classifyCloudSchemaVersion(value, 2, CURRENT);
    expect(outcome.kind).toBe("unreadable");
    expect(outcome).toMatchObject({ offerDownload: true });
  });

  it("does not quietly widen parseProjectFile's two-version window", () => {
    // Guards Open Item 1: if PROJECT_FILE_VERSION moves, only it and the one
    // before it open.
    expect(classifyCloudSchemaVersion(PROJECT_FILE_VERSION, 1, PROJECT_FILE_VERSION).kind).toBe("opens");
    expect(classifyCloudSchemaVersion(PROJECT_FILE_VERSION - 1, 1, PROJECT_FILE_VERSION).kind).toBe("opens-via-migration");
    expect(classifyCloudSchemaVersion(PROJECT_FILE_VERSION - 2, 1, PROJECT_FILE_VERSION).kind).toBe("too-old");
  });
});

describe("cloudVersionFileName", () => {
  it("slugs the project name and appends the version", () => {
    expect(cloudVersionFileName("Smith House #2", 7)).toBe("smith-house-2-v7.json");
  });

  it("names an unnamed project untitled", () => {
    expect(cloudVersionFileName("", 3)).toBe("untitled-v3.json");
  });
});
