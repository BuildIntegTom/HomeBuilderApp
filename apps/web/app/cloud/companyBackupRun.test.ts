import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { PROJECT_FILE_VERSION } from "../projectFile";
import type { ZipCollector } from "./backupZip";
import type { BackupPageResponse } from "./cloudTypes";
import { BACKUP_CANCELLED_MESSAGE, type BackupPageResult } from "./companyBackup";
import { runCompanyBackup, type RunCompanyBackupOptions } from "./companyBackupRun";

const BI = { id: "11111111-0000-0000-0000-000000000001", name: "Building Integrity" };

/** The last (and only) page: a company with no projects, so the zip is just the manifest. */
const lastPage = (): BackupPageResult => ({
  ok: true,
  data: {
    company: BI,
    exportedBy: { id: "u1", email: "alice@bi.test", displayName: "Alice" },
    serverTime: "2026-09-14T12:00:00.000Z",
    projectCount: 0,
    grantedProjectCount: 0,
    versions: [],
    nextAfter: null,
    done: true,
  } satisfies BackupPageResponse,
});

function setup(overrides: Partial<RunCompanyBackupOptions> = {}) {
  const controller = new AbortController();
  const download = vi.fn();
  const fetchPage = vi.fn(async () => lastPage());
  const options: RunCompanyBackupOptions = {
    companyId: BI.id,
    appProjectFileVersion: PROJECT_FILE_VERSION,
    fetchPage,
    signal: controller.signal,
    loadZip: () => import("./backupZip"),
    download,
    sleep: async () => {},
    ...overrides,
  };
  return { controller, download, fetchPage, options };
}

describe("runCompanyBackup", () => {
  it("a backup that completes downloads one zip and reports done", async () => {
    const { options, download } = setup();
    const outcome = await runCompanyBackup(options);
    expect(outcome).toMatchObject({ status: "done", fileName: "company-backup--building-integrity--2026-09-14T1200Z.zip", versionCount: 0, projectCount: 0 });
    expect(download).toHaveBeenCalledTimes(1);
    const [name, blob] = download.mock.calls[0] as [string, Blob];
    expect(name).toBe("company-backup--building-integrity--2026-09-14T1200Z.zip");
    expect(blob.type).toBe("application/zip");
    expect(blob.size).toBeGreaterThan(0);
  });

  describe("Cancel wins at any point, with no file", () => {
    it("pressed after the final page has arrived (the race that used to still save a zip)", async () => {
      const { options, controller, download } = setup();
      // onProgress runs after the last page's versions are in, just before the
      // backup would close the zip: the user's Cancel lands here.
      const outcome = await runCompanyBackup({ ...options, onProgress: () => controller.abort() });
      expect(outcome).toEqual({ status: "cancelled", message: BACKUP_CANCELLED_MESSAGE });
      expect(download).not.toHaveBeenCalled();
    });

    it("pressed while the zip is being closed", async () => {
      const { controller, download, options } = setup();
      const real = (await import("./backupZip")).createZipCollector;
      const loadZip = async () => ({
        createZipCollector: (): ZipCollector => {
          const zip = real();
          return {
            ...zip,
            finish: () => {
              const chunks = zip.finish();
              controller.abort();
              return chunks;
            },
          };
        },
      });
      const outcome = await runCompanyBackup({ ...options, loadZip });
      expect(outcome).toEqual({ status: "cancelled", message: BACKUP_CANCELLED_MESSAGE });
      expect(download).not.toHaveBeenCalled();
    });

    it("pressed while the zip writer is still loading: no page is fetched", async () => {
      const { controller, download, fetchPage, options } = setup();
      const outcome = await runCompanyBackup({
        ...options,
        loadZip: async () => {
          controller.abort();
          return import("./backupZip");
        },
      });
      expect(outcome).toEqual({ status: "cancelled", message: BACKUP_CANCELLED_MESSAGE });
      expect(fetchPage).not.toHaveBeenCalled();
      expect(download).not.toHaveBeenCalled();
    });

    it("pressed mid-way through the pages", async () => {
      const { controller, download, options } = setup();
      const outcome = await runCompanyBackup({
        ...options,
        fetchPage: async () => {
          controller.abort();
          throw new DOMException("aborted", "AbortError");
        },
      });
      expect(outcome).toEqual({ status: "cancelled", message: BACKUP_CANCELLED_MESSAGE });
      expect(download).not.toHaveBeenCalled();
    });
  });

  it("a zip writer that fails to load (offline) is a clear failure with no file and no page fetched", async () => {
    const { download, fetchPage, options } = setup({
      loadZip: () => Promise.reject(new TypeError("Failed to fetch dynamically imported module")),
    });
    const outcome = await runCompanyBackup(options);
    expect(outcome).toEqual({
      status: "failed",
      message: "The backup stopped: the zip writer couldn't be loaded (are you offline?). No file was saved; try again.",
    });
    expect(fetchPage).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it("a page failure is reported as the backup's own failure, with no file", async () => {
    const { download, options } = setup({ fetchPage: async () => ({ ok: false, status: 403, message: "Only a company admin of Building Integrity can download its backup." }) });
    const outcome = await runCompanyBackup(options);
    expect(outcome).toMatchObject({ status: "failed", message: expect.stringContaining("Only a company admin") });
    expect(download).not.toHaveBeenCalled();
  });
});

describe("fflate stays out of the initial bundle", () => {
  // Only a dynamic import() may reach backupZip (and so fflate) from app code;
  // types may still be imported with `import type`.
  it("no non-test app module statically imports backupZip or fflate, except backupZip itself", () => {
    const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          walk(path);
        } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== "backupZip.ts") {
          const source = readFileSync(path, "utf8");
          if (/^import\s+(?!type\b)[^;]*from\s+["'](?:\.{1,2}\/)*(?:cloud\/)?backupZip["']/m.test(source) || /^import\s+(?!type\b)[^;]*from\s+["']fflate["']/m.test(source)) {
            offenders.push(relative(appDir, path));
          }
        }
      }
    };
    walk(appDir);
    expect(offenders).toEqual([]);
    const hook = readFileSync(join(appDir, "cloud", "useCompanyBackup.ts"), "utf8");
    expect(hook).toContain('import("./backupZip")');
  });
});
