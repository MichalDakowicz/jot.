import React from 'react';

import { inkTint } from '@jot/core/theme/ink';
import { tintOf } from '@jot/core/theme/tokens';

import { useScheme } from '../theme';

/** A notebook's colour, lifted on the dark page so the deep tints still read. */
export function NotebookDot({ tint, size = 7 }: { tint: number; size?: number }) {
  const { scheme } = useScheme();
  return <span className="dot" style={{ background: inkTint(tintOf(tint).hex, scheme), width: size, height: size }} />;
}
