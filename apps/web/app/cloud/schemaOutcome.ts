/**
 * What happens when a cloud version is opened, by its file format (spec,
 * "Opening a version, and older app versions").
 *
 * `parseProjectFile` deliberately accepts only the current format and the one
 * before it. That window is NOT widened here (Open Item 1, accepted): an older
 * version is refused visibly, with its untouched JSON offered for download so
 * nothing is lost, and a newer one says to reload — a real case, because
 * pushing to main auto-deploys and an open tab can be a release behind.
 */
export type CloudSchemaOutcome =
  | { kind: "opens" }
  | { kind: "opens-via-migration" }
  | { kind: "too-old"; message: string; offerDownload: true }
  | { kind: "too-new"; message: string; offerDownload: false }
  | { kind: "unreadable"; message: string; offerDownload: true };

export function classifyCloudSchemaVersion(
  schemaVersion: unknown,
  versionNumber: number,
  currentVersion: number,
): CloudSchemaOutcome {
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    return {
      kind: "unreadable",
      message: `Version ${versionNumber} doesn't record which file format it was saved in, so this app can't open it.`,
      offerDownload: true,
    };
  }
  if (schemaVersion === currentVersion) return { kind: "opens" };
  if (schemaVersion === currentVersion - 1) return { kind: "opens-via-migration" };
  if (schemaVersion < currentVersion - 1) {
    return {
      kind: "too-old",
      message: `Version ${versionNumber} was saved by an older version of the app (file format ${schemaVersion}) and can't be opened by this one.`,
      offerDownload: true,
    };
  }
  return {
    kind: "too-new",
    message: "This version was saved by a newer version of the app. Reload the page to open it.",
    offerDownload: false,
  };
}

/** The raw-download filename for a version that cannot be opened. */
export function cloudVersionFileName(projectName: string, versionNumber: number): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "untitled"}-v${versionNumber}.json`;
}
