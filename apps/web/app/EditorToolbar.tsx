"use client";

import EditorTabDial, { type EditorTab } from "./EditorTabDial";
import styles from "./EditorToolbar.module.css";

export interface EditorToolbarProps {
  editorTab: EditorTab;
  onEditorTabChange: (tab: EditorTab) => void;
  enabledTabs: EditorTab[];
}

/**
 * Sits directly above the Wall/Foundation/Floor/Roof editor region (Tommy:
 * "the editor should have a menu bar along the top of it") — just the tab
 * dial now. The 2D/3D view-mode dial moved up to page.tsx's top row
 * alongside the zoom/pan controls (Tommy: "put the layout editor
 * scrollwheel and 2d 3d buttons at the top of the tool bar") — see
 * ViewerDial.tsx. The compass docks separately in the page's own top-left
 * corner (see page.module.css's .compassDock).
 */
export default function EditorToolbar({ editorTab, onEditorTabChange, enabledTabs }: EditorToolbarProps) {
  return (
    <div className={styles.bar}>
      <EditorTabDial value={editorTab} onChange={onEditorTabChange} enabledTabs={enabledTabs} />
    </div>
  );
}
