"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * HOW A SECTION GETS ONTO A FULL PAGE WITHOUT 27 NEW PROPS.
 *
 * ⚠ **The alternative, and why it lost.** The ~27 sections are `StickyNote`
 * elements spread over 1,700 lines of `page.tsx`, each closing over its own
 * props. Threading a `portalTo` prop to each one is 27 edits to the most
 * lint-saturated file in the repo, 27 chances to miss one, and **no compiler to
 * tell you which one you missed** — a section left unthreaded would simply not
 * appear on the page, silently, and only on buildings that produce it. A
 * context is one provider and zero per-note edits, and a note that the page
 * does not claim behaves exactly as it does today.
 *
 * The provider answers two questions for a given section id, and nothing else:
 * where its DOM should land, and whether a page's being open is itself a reason
 * for it to be open.
 */
export interface SectionSurfaceValue {
  /** The element this section should render into, or `null` to stay put. */
  hostFor: (sectionId: string) => HTMLElement | null;
  /**
   * Whether the open page wants this section open regardless of the tray.
   *
   * ⚠ This never CLOSES anything — it only ever ORs with the note's own
   * `isOpen`. A page that could close a note would fight the tray for control
   * of the same state, and until U5.2 the tray is the safety net and has to
   * keep working.
   */
  opensOnItsPage: (sectionId: string) => boolean;
}

const NOTHING: SectionSurfaceValue = {
  hostFor: () => null,
  opensOnItsPage: () => false,
};

const SectionSurfaceContext = createContext<SectionSurfaceValue>(NOTHING);

/**
 * Read by `StickyNote`. Defaults to "no page claims me", so a `StickyNote`
 * rendered outside any provider — in a test, or in the `/read-me` and
 * `/report-bug` routes, which are real routes and not part of the editor —
 * behaves exactly as it did before U4 rather than throwing.
 */
export function useSectionSurface(): SectionSurfaceValue {
  return useContext(SectionSurfaceContext);
}

export function SectionSurfaceProvider({ value, children }: { value: SectionSurfaceValue; children: ReactNode }) {
  return <SectionSurfaceContext.Provider value={value}>{children}</SectionSurfaceContext.Provider>;
}
