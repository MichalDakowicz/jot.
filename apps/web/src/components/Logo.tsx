import React from 'react';

import { LOGO_COLORS, LOGO_PATHS } from '@jot/core/theme/logo';

/** The mark: a monospace "j" and its cursor on the slate tile, the same in either scheme. */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx={LOGO_PATHS.tile.radius} fill={LOGO_COLORS.tile} />
      <path d={LOGO_PATHS.dot} fill={LOGO_COLORS.letter} />
      <path d={LOGO_PATHS.stem} fill={LOGO_COLORS.letter} />
      <path d={LOGO_PATHS.caret} fill={LOGO_COLORS.caret} />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      jot<span className="wordmark-dot">.</span>
    </span>
  );
}
