"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Is the design on screen another member company's, browsed read-only with its
 * costs removed? (Stage 4B, decision 23's export restrictions.)
 *
 * Threaded via Context for the same reason `DocumentMetaContext` is: the two
 * controls it gates — Export as OBJ on the whole building, and Download OBJ on
 * a single panel — are rendered from several call sites, `page.tsx` and
 * `ShopDrawingPage.tsx` among them, and a Provider set once in `page.tsx`
 * reaches all of them without a prop passing through every intermediate
 * component that does not care.
 *
 * WHAT THIS IS, SAID EXACTLY, BECAUSE THE DIFFERENCE MATTERS (decision 23).
 * Hiding these buttons is DELIBERATE FRICTION, not an access control. The
 * document has to reach the browser to draw the drawings at all, so anyone with
 * a developer console can lift it out; removing the buttons removes the easy
 * path, not the possible one. The guarantee in this stage is a different thing
 * living in a different place: the price modifier is stripped in the database
 * before the document is sent, and that one may be stated as a guarantee. This
 * one may not, and no string in the app says otherwise.
 *
 * DEFAULT FALSE. A component rendered outside the Provider — the sandbox page,
 * a test — behaves exactly as it did before this existed.
 */
const BrowseModeContext = createContext<boolean>(false);

export function BrowseModeProvider({ browsing, children }: { browsing: boolean; children: ReactNode }) {
  return <BrowseModeContext.Provider value={browsing}>{children}</BrowseModeContext.Provider>;
}

/** True while a browsed, cost-redacted design is on screen. */
export function useBrowsing(): boolean {
  return useContext(BrowseModeContext);
}
