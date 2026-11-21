import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * LINE ENDINGS — a guard, because this trap is invisible in review.
 *
 * This repo is LF, in the repository AND in the working tree, declared by
 * `* text=auto eol=lf` in `.gitattributes`. `eol` overrides `core.autocrlf`
 * (which is `true` on this machine), so the rule holds whatever a
 * contributor has configured globally.
 *
 * ⚠ **THE HAZARD IS A MIXED FILE, NOT A CRLF ONE.** Every tool here writes
 * LF unconditionally — bash heredocs, the patch scripts, the OBJ exporter.
 * Appending LF to a CRLF file leaves it HALF AND HALF, and nothing warns.
 * Three ways that bit, all observed in this repo rather than imagined:
 *
 *   1. **Patch scripts matched NOTHING.** They sniff a file's convention
 *      (`"\r\n" if "\r\n" in s else "\n"`); a mixed file answers CRLF while
 *      the lines being targeted are LF. Two scripts in one hour.
 *   2. **Files drifted.** A script that picked CRLF rewrote the LF lines
 *      too, flipping a file a few lines at a time.
 *   3. **An unreviewable commit.** `page.tsx` once staged as 21,789
 *      insertions / 21,205 deletions for a 172-line change — 21,315
 *      carriage returns its parent did not have. A diff like that destroys
 *      review and `git blame`.
 *
 * ⚠ **AND A DOUBLED CR IS ITS OWN FAULT, which is why it is checked
 * separately.** `WallElevationDiagram.tsx` carried `\r\r\n` on line 18 —
 * a CRLF-aware script writing `\r\n` onto a line that already ended in
 * `\r`. In TypeScript a `\r` is whitespace, so it compiled, linted and
 * tested clean, and was invisible in an editor. It was found only by
 * counting bytes while writing this guard. Nothing else in 929 tracked
 * files had one.
 *
 * ⚠ **`git add --renormalize` DOES NOT FIX THIS, and that is documented
 * git behaviour rather than a misconfiguration.** `text=auto` deliberately
 * leaves alone any file that was *committed* with CRLF, to avoid churn — so
 * the one such file here (`WallElevationDiagram.tsx`, 3,013 CRLF lines in
 * its blob) had to be converted by hand and committed as its own change.
 * If this test ever fails on a file whose BLOB is CRLF, renormalize will not
 * help: rewrite the bytes and commit that.
 *
 * To fix a failure: rewrite the named files with LF endings and commit.
 */

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** Extensions git stores verbatim; counting bytes in them means nothing. */
const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".svgz",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".pdf", ".docx", ".xlsx", ".zip", ".mp4",
]);

/**
 * Globs `.gitattributes` declares as CRLF on purpose. Keep in step with it.
 * None are tracked today — the rules exist so the first one added is right.
 */
const CRLF_BY_DESIGN = [".bat", ".cmd"];

type Counted = {
  path: string;
  crlf: number;
  loneLf: number;
  doubledCr: number;
  strayCr: number;
};

function trackedTextFiles(): Counted[] {
  const listed = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
  })
    .toString("utf8")
    .split("\0")
    .filter((p) => p.length > 0);

  const counted: Counted[] = [];
  for (const path of listed) {
    const ext = extname(path).toLowerCase();
    if (BINARY_EXT.has(ext) || CRLF_BY_DESIGN.includes(ext)) continue;

    let bytes: Buffer;
    try {
      bytes = readFileSync(join(REPO_ROOT, path));
    } catch {
      // A tracked path missing from the working tree is not this test's
      // business (sparse checkout, a case-only rename mid-operation).
      continue;
    }
    if (bytes.includes(0)) continue; // git's own binary heuristic

    const text = bytes.toString("latin1"); // byte-preserving
    const crlf = (text.match(/\r\n/g) ?? []).length;
    const allLf = (text.match(/\n/g) ?? []).length;
    const doubledCr = (text.match(/\r\r+\n/g) ?? []).length;
    const strayCr = (text.match(/\r(?!\n)/g) ?? []).length;
    counted.push({ path, crlf, loneLf: allLf - crlf, doubledCr, strayCr });
  }
  return counted;
}

describe("line endings in tracked files", () => {
  const files = trackedTextFiles();

  it("scans a plausible number of files, so a broken scan cannot pass vacuously", () => {
    // 819 text files of 929 tracked on 2026-11-20. A scan that silently
    // listed nothing would otherwise satisfy every assertion below.
    expect(files.length).toBeGreaterThan(500);
  });

  it("has no file with BOTH CRLF and LF endings", () => {
    const mixed = files
      .filter((f) => f.crlf > 0 && f.loneLf > 0)
      .map((f) => `${f.path} (crlf=${f.crlf}, lf=${f.loneLf})`);
    expect(mixed).toEqual([]);
  });

  it("has no doubled or stray carriage return", () => {
    const stray = files
      .filter((f) => f.doubledCr > 0 || f.strayCr > 0)
      .map((f) => `${f.path} (doubled=${f.doubledCr}, stray=${f.strayCr})`);
    expect(stray).toEqual([]);
  });

  it("is LF throughout, which is what `eol=lf` checks out", () => {
    const withCrlf = files
      .filter((f) => f.crlf > 0)
      .map((f) => `${f.path} (crlf=${f.crlf})`);
    expect(withCrlf).toEqual([]);
  });
});

describe(".gitattributes", () => {
  const attributes = readFileSync(join(REPO_ROOT, ".gitattributes"), "utf8");

  it("declares the repo LF in the working tree, not merely in the object store", () => {
    // `* text=auto` alone would still check out CRLF under core.autocrlf,
    // which is the condition that produced every fault in the block comment
    // above. The `eol=lf` half is the one that prevents them.
    expect(attributes).toMatch(/^\* text=auto eol=lf$/m);
  });

  it("keeps the OBJ golden fixture's `-text` rule BELOW the blanket rule", () => {
    // For one attribute the LAST matching line wins. The fixture is a
    // byte-for-byte record of exporter output and git must not touch it.
    const blanket = attributes.indexOf("* text=auto eol=lf");
    const fixture = attributes.indexOf("objGolden.fixture.obj -text");
    expect(blanket).toBeGreaterThanOrEqual(0);
    expect(fixture).toBeGreaterThan(blanket);
  });

  it("is itself LF, which it was NOT on the first attempt", () => {
    // Writing the new rules above the existing ones preserved the old
    // block's CRLF and left this very file half and half — the bug biting
    // during its own fix.
    const raw = readFileSync(join(REPO_ROOT, ".gitattributes"), "latin1");
    expect(raw).not.toMatch(/\r/);
  });
});
