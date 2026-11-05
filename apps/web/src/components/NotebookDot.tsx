import React from 'react';

import { useNotebookInk } from './useNotebookInk';

/** A notebook's colour as a dot. */
export function NotebookDot({ tint, size = 7 }: { tint: number; size?: number }) {
  const ink = useNotebookInk(tint);
  return <span className="dot" style={{ background: ink, width: size, height: size }} />;
}
