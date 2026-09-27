import { describe, expect, it } from "vitest";
import { spanningHeaderCommitNotice, spanningHeaderRefusalNotice, spanningHeaderRunStopRefusal } from "./spanningHeaderNotice";

const formatLength = (valueIn: number) => `${valueIn}in`;

describe("spanningHeaderRefusalNotice", () => {
  it("quotes the real span and the real range when a span is out of range", () => {
    const notice = spanningHeaderRefusalNotice(
      { outcome: "refuse", reason: "span-out-of-range", spanWidthIn: 145, minIn: 48, maxIn: 144 },
      formatLength,
    );
    expect(notice).toContain("145in");
    expect(notice).toContain("48in");
    expect(notice).toContain("144in");
    // The range is pending BI confirmation and does not get widened to fit a
    // drawing — the refusal says so, since a limit is exactly when that
    // matters to whoever is hitting it.
    expect(notice).toContain("not confirmed");
    expect(notice).toContain("not widened");
  });

  it("explains the single-slot refusal by pointing at what DOES express it", () => {
    const notice = spanningHeaderRefusalNotice({ outcome: "refuse", reason: "single-slot-span" }, formatLength);
    expect(notice).toContain("at least two panels");
  });

  it("names the real obstacle for an overlap", () => {
    expect(spanningHeaderRefusalNotice({ outcome: "refuse", reason: "overlaps-existing" }, formatLength)).toContain(
      "two headers cannot sit on the same panel",
    );
  });

  it("quotes both heights when a header would push through the top plate", () => {
    const notice = spanningHeaderRefusalNotice(
      { outcome: "refuse", reason: "taller-than-story", headerTopIn: 124, storyHeightIn: 120 },
      formatLength,
    );
    expect(notice).toContain("124in");
    expect(notice).toContain("120in");
  });

  it("always says nothing was changed, on every branch", () => {
    const results = [
      { outcome: "refuse", reason: "out-of-range" },
      { outcome: "refuse", reason: "single-slot-span" },
      { outcome: "refuse", reason: "overlaps-existing" },
      { outcome: "refuse", reason: "span-out-of-range", spanWidthIn: 12, minIn: 48, maxIn: 144 },
      { outcome: "refuse", reason: "taller-than-story", headerTopIn: 1, storyHeightIn: 2 },
    ] as const;
    for (const result of results) {
      expect(spanningHeaderRefusalNotice(result, formatLength)).toContain("Nothing was changed.");
    }
  });
});

describe("spanningHeaderCommitNotice", () => {
  it("names the header and states the wall in words, because the name never does", () => {
    const notice = spanningHeaderCommitNotice({
      name: "H1",
      location: "East wall — spans E4, E5",
      spanWidthIn: 77.5,
      formatLength,
    });
    expect(notice).toContain("H1");
    expect(notice).toContain("East wall — spans E4, E5");
    expect(notice).toContain("77.5in");
    expect(notice).toContain("one H series");
  });
});

describe("spanningHeaderRunStopRefusal", () => {
  it("names every affected header rather than adjusting one silently", () => {
    expect(spanningHeaderRunStopRefusal(["H1", "H3"])).toContain("H1, H3");
    expect(spanningHeaderRunStopRefusal(["H1", "H3"])).toContain("headers H1, H3");
    expect(spanningHeaderRunStopRefusal(["H2"])).toContain("header H2");
    expect(spanningHeaderRunStopRefusal(["H2"])).toContain("Nothing was changed.");
  });
});
