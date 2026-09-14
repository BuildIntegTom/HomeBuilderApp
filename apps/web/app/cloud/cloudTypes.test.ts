import { describe, expect, it } from "vitest";
import {
  CLOUD_DOCUMENT_CEILING_BYTES,
  FOLDER_LABEL,
  actingAsChangedMessage,
  displayProjectName,
  isCertainlyTooLargeForCloud,
  isCloudFolder,
} from "./cloudTypes";

describe("folders", () => {
  it("accepts exactly the three folders the database allows", () => {
    expect(["current", "past", "proposals"].every(isCloudFolder)).toBe(true);
    expect([undefined, null, "archive", "Current", ""].some(isCloudFolder)).toBe(false);
  });

  it("labels them as the spec names them", () => {
    expect(FOLDER_LABEL).toEqual({ current: "Current Projects", past: "Past Projects", proposals: "Proposals" });
  });
});

describe("displayProjectName", () => {
  it("shows an empty or blank name as a visible gap, not a substitute", () => {
    expect(displayProjectName("")).toBe("(untitled)");
    expect(displayProjectName("   ")).toBe("(untitled)");
    expect(displayProjectName(null)).toBe("(untitled)");
    expect(displayProjectName("Smith House")).toBe("Smith House");
  });
});

describe("isCertainlyTooLargeForCloud", () => {
  it("uses the 4 MB ceiling 0006 enforces", () => {
    expect(CLOUD_DOCUMENT_CEILING_BYTES).toBe(4 * 1024 * 1024);
  });

  it("does not refuse a document at the ceiling, and refuses one a byte over", () => {
    expect(isCertainlyTooLargeForCloud("x".repeat(CLOUD_DOCUMENT_CEILING_BYTES))).toBe(false);
    expect(isCertainlyTooLargeForCloud("x".repeat(CLOUD_DOCUMENT_CEILING_BYTES + 1))).toBe(true);
  });

  it("counts bytes, not characters", () => {
    // "é" is two bytes in UTF-8.
    expect(isCertainlyTooLargeForCloud("é".repeat(CLOUD_DOCUMENT_CEILING_BYTES / 2 + 1))).toBe(true);
  });
});

describe("actingAsChangedMessage", () => {
  it("is the spec's 409 wording", () => {
    expect(actingAsChangedMessage("Rare Forms")).toBe("You're now acting as Rare Forms (changed in another tab). Nothing was saved.");
  });
});
