"use client";

import { useCallback, useReducer, useState } from "react";
import {
  INITIAL_DOCUMENT_SESSION,
  createDocumentSessionMirror,
  documentSessionReducer,
  type DocumentSession,
  type DocumentSessionAction,
} from "./documentSession";

/**
 * The editor's DocumentSession, with one dispatch that advances BOTH React's
 * state (for rendering) and a synchronous mirror (for checks that must see the
 * latest dispatch). Every dispatch has to go through this one, or the two drift
 * apart; the same pure reducer drives both, so they cannot otherwise differ.
 */
export function useDocumentSession(): {
  documentSession: DocumentSession;
  dispatchDocumentSession: (action: DocumentSessionAction) => void;
  readDocumentSession: () => DocumentSession;
} {
  const [documentSession, dispatchToReact] = useReducer(documentSessionReducer, INITIAL_DOCUMENT_SESSION);
  const [mirror] = useState(() => createDocumentSessionMirror());

  const dispatchDocumentSession = useCallback(
    (action: DocumentSessionAction) => {
      mirror.apply(action);
      dispatchToReact(action);
    },
    [mirror],
  );
  const readDocumentSession = useCallback(() => mirror.read(), [mirror]);

  return { documentSession, dispatchDocumentSession, readDocumentSession };
}
