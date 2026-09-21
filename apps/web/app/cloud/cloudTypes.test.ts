import { describe, expect, it } from "vitest";
import {
  CLOUD_DOCUMENT_CEILING_BYTES,
  FOLDER_LABEL,
  actingAsChangedMessage,
  consortiumLaterStageMessage,
  consortiumMenuMessage,
  displayProjectName,
  isCertainlyTooLargeForCloud,
  isCloudFolder,
  seedTreeCostWarning,
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

describe("the consortium's own tree (3D)", () => {
  it("the folder message is now only about listing: it no longer claims you cannot create", () => {
    expect(consortiumLaterStageMessage("The Seed Collaborative")).toBe(
      "You're acting as The Seed Collaborative through the consortium. Its folders open in a later stage, so there's nothing to list here.",
    );
  });

  it("3E: the MENU's version of the same situation does not claim there is nothing to list", () => {
    const menu = consortiumMenuMessage("The Seed Collaborative");
    expect(menu).toBe(
      "You're acting as The Seed Collaborative through the consortium. Its own folders open in a later stage; projects shared with you, and ones you create here, are in Shared with us.",
    );
    // The line sits directly above "Open from cloud…", which since 3D does have
    // something to list: a project you created in Seed's tree is in Shared with us.
    expect(menu).not.toMatch(/nothing to list/);
    expect(menu).toMatch(/Shared with us/);
    // The FOLDER TAB wording is deliberately untouched (hand-test step 13 reads it).
    expect(consortiumLaterStageMessage("The Seed Collaborative")).toMatch(/nothing to list here/);
  });

  it("carries Open Item 5's warning as ONE line, naming the owner and the costs", () => {
    const line = seedTreeCostWarning("The Seed Collaborative");
    expect(line).toBe("Owned by The Seed Collaborative: its members will see this design's costs.");
    // One line, as Tommy accepted it: no second sentence crept in.
    expect(line.split("\n")).toHaveLength(1);
    expect(line.match(/\./g)).toHaveLength(1);
  });
});
