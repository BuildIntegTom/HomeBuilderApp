import { describe, expect, it } from "vitest";
import type { InterveningVersion } from "./cloudTypes";
import { divergenceNotice, movedOnSaveNotice, replacedWhileSavingNotice, staleOpenNotice } from "./divergenceNotice";

describe("movedOnSaveNotice", () => {
  it("does not claim the design was replaced when only the base moved on", () => {
    const text = movedOnSaveNotice(4, 5);
    expect(text).toBe("Saved as version 4, but a newer save from this editor had already moved on; your editor stays on version 5.");
    expect(text).not.toMatch(/replaced/);
  });
});

describe("replacedWhileSavingNotice", () => {
  it("says the save happened without implying it is the design on screen", () => {
    const text = replacedWhileSavingNotice(1, "Smith House", "Building Integrity › Current Projects");
    expect(text).toBe(
      "Saved as version 1 of Smith House in Building Integrity › Current Projects. The design on screen was replaced while that save was in progress, so this editor is not attached to that project; the design you see now was not changed.",
    );
    expect(replacedWhileSavingNotice(4, "", null)).toMatch(/^Saved as version 4 of \(untitled\)\. The design on screen was replaced/);
  });
});

describe("staleOpenNotice", () => {
  it("is silent when the opened version is the head", () => {
    expect(staleOpenNotice(7, 7)).toBeNull();
  });

  it("names both versions when the list was stale, without naming who saved (it may have been you in another tab)", () => {
    expect(staleOpenNotice(7, 9)).toBe("A newer version (v9) was saved after this list loaded. You opened v7.");
    expect(staleOpenNotice(7, 9)).not.toMatch(/Someone/);
  });
});

const formatTime = (createdAt: string) => ({ "t7": "2:14 pm", "t8": "2:20 pm", "t9": "2:31 pm" })[createdAt] ?? createdAt;

const v = (versionNumber: number, authorName: string, createdAt: string, extra: Partial<InterveningVersion> = {}): InterveningVersion => ({
  versionNumber,
  authorName,
  createdAt,
  kind: "save",
  projectName: "Smith House",
  ...extra,
});

describe("divergenceNotice", () => {
  it("your own consecutive saves: a plain headline and no notice", () => {
    expect(
      divergenceNotice({ versionNumber: 5, diverged: false, headBefore: 4, baseVersionNumber: 4, intervening: [], savedProjectName: "Smith House", formatTime }),
    ).toEqual({ headline: "Saved as version 5.", detail: null });
  });

  it("matches the spec's one-other-version wording exactly", () => {
    const notice = divergenceNotice({
      versionNumber: 8,
      diverged: true,
      headBefore: 7,
      baseVersionNumber: 6,
      intervening: [v(7, "Virgil", "t7")],
      savedProjectName: "Smith House",
      formatTime,
    });
    expect(notice.headline).toBe("Saved as version 8.");
    expect(notice.detail).toBe(
      "While you had this project open, 1 other version was saved: version 7 by Virgil, 2:14 pm. You started from version 6. Both are kept; nothing was overwritten.",
    );
  });

  it("names the latest author and time when several versions landed", () => {
    const notice = divergenceNotice({
      versionNumber: 10,
      diverged: true,
      headBefore: 9,
      baseVersionNumber: 6,
      intervening: [v(7, "Tommy", "t7"), v(8, "Tommy", "t8"), v(9, "Virgil", "t9")],
      savedProjectName: "Smith House",
      formatTime,
    });
    expect(notice.detail).toBe(
      "While you had this project open, 3 other versions were saved, the latest by Virgil at 2:31 pm. You started from version 6. Every version is kept; nothing was overwritten.",
    );
  });

  it("says when an intervening rename was set back by this save", () => {
    const notice = divergenceNotice({
      versionNumber: 10,
      diverged: true,
      headBefore: 9,
      baseVersionNumber: 7,
      intervening: [v(8, "Virgil", "t8", { kind: "rename", projectName: "Smith Residence" }), v(9, "Virgil", "t9", { projectName: "Smith Residence" })],
      savedProjectName: "Smith House",
      formatTime,
    });
    expect(notice.detail).toBe(
      "While you had this project open, 2 other versions were saved, the latest by Virgil at 2:31 pm, including a rename to 'Smith Residence'. Your save set the name back to 'Smith House'. You started from version 7. Every version is kept; nothing was overwritten.",
    );
  });

  it("does not mention a rename this save kept", () => {
    const notice = divergenceNotice({
      versionNumber: 8,
      diverged: true,
      headBefore: 7,
      baseVersionNumber: 6,
      intervening: [v(7, "Virgil", "t7", { kind: "rename", projectName: "Smith Residence" })],
      savedProjectName: "Smith Residence",
      formatTime,
    });
    expect(notice.detail).not.toMatch(/rename/);
  });

  it("still reports the count from the numbers if the intervening rows could not be read back", () => {
    const notice = divergenceNotice({ versionNumber: 9, diverged: true, headBefore: 8, baseVersionNumber: 6, intervening: [], savedProjectName: "", formatTime });
    expect(notice.detail).toBe(
      "While you had this project open, 2 other versions were saved. You started from version 6. Every version is kept; nothing was overwritten.",
    );
  });

  it("shows an empty name as (untitled) rather than a blank pair of quotes", () => {
    const notice = divergenceNotice({
      versionNumber: 3,
      diverged: true,
      headBefore: 2,
      baseVersionNumber: 1,
      intervening: [v(2, "Virgil", "t7", { kind: "rename", projectName: "Barn" })],
      savedProjectName: "",
      formatTime,
    });
    expect(notice.detail).toContain("Your save set the name back to '(untitled)'.");
  });
});
