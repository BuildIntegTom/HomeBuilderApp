"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface DocumentMeta {
  projectName: string;
  siteLabel: string;
  date: string;
  /** Set by DocumentViewer as it paginates — undefined outside that flow
   * (e.g. a lone Shop Drawing preview rendered inline on the Wall tab). */
  sheetNumber?: number;
  sheetCount?: number;
}

const DEFAULT_META: DocumentMeta = {
  projectName: "Untitled Project",
  siteLabel: "Site not set",
  date: "",
};

const DocumentMetaContext = createContext<DocumentMeta>(DEFAULT_META);

/**
 * Project/site/date/sheet-number metadata for the landscape title block
 * (Tommy: "divide it up however makes sense to show all of the relevant
 * detail page, project, site, date, etc."). Threaded via Context instead of
 * props because SheetTitleBlock is used from ~10+ call sites (every Detail
 * Guide Page + every Shop Drawing page) — a Provider set once in page.tsx
 * reaches all of them without touching each call site. DocumentViewer
 * nests a second Provider around each page it paginates, overriding just
 * `sheetNumber`/`sheetCount` (Context providers nest; the innermost wins).
 */
export function DocumentMetaProvider({ value, children }: { value: DocumentMeta; children: ReactNode }) {
  return <DocumentMetaContext.Provider value={value}>{children}</DocumentMetaContext.Provider>;
}

export function useDocumentMeta(): DocumentMeta {
  return useContext(DocumentMetaContext);
}
