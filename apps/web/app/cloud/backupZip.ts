import { Zip, ZipDeflate } from "fflate";

/**
 * Stage 2D: the zip the company backup is written into, in the browser.
 *
 * `fflate` (pinned in apps/web/package.json): small, dependency-free, MIT, and
 * runs in the browser. Its streaming `Zip` compresses each file as it is added
 * and hands back compressed chunks, so the browser holds the compressed backup
 * rather than every raw document at once. JSON of this shape compresses well.
 *
 * Nothing is downloaded from here: the caller turns `finish()`'s chunks into a
 * Blob only after the whole backup succeeded, so a failed or cancelled backup
 * never produces a file.
 */

export interface BackupFileSink {
  add(path: string, data: Uint8Array, modified?: Date): void;
}

export interface ZipCollector extends BackupFileSink {
  /** Closes the archive and returns its bytes, in order. */
  finish(): Uint8Array[];
  /** Compressed bytes so far. */
  byteLength(): number;
}

/** DOS timestamps in a zip cover 1980–2099; outside that the entry keeps the default. */
function zipTime(modified: Date | undefined): Date | undefined {
  if (!modified || Number.isNaN(modified.getTime())) return undefined;
  const year = modified.getFullYear();
  return year >= 1980 && year <= 2099 ? modified : undefined;
}

export function createZipCollector(): ZipCollector {
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let failure: Error | null = null;
  let finished = false;
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      failure = error;
      return;
    }
    chunks.push(chunk);
    bytes += chunk.length;
    if (final) finished = true;
  });

  return {
    add(path, data, modified) {
      if (failure) throw failure;
      const mtime = zipTime(modified);
      const file = new ZipDeflate(path, { level: 6 });
      // A file attribute (ZipInputFile.mtime), not a deflate option.
      if (mtime) file.mtime = mtime;
      zip.add(file);
      file.push(data, true);
      if (failure) throw failure;
    },
    finish() {
      zip.end();
      if (failure) throw failure;
      if (!finished) throw new Error("The zip did not finish writing.");
      return chunks;
    },
    byteLength: () => bytes,
  };
}
