import React from 'react';

/**
 * The mark: a monospace "j" with the block cursor after it, on a slate tile.
 * Drawn from rectangles so it never waits for a font. The tile keeps its
 * slate in both schemes; the wordmark follows the page.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" style={{ fill: 'var(--logo-tile)' }} />
      <g style={{ fill: 'var(--logo-letter)' }}>
        <rect x="20" y="12" width="9" height="8" rx="1.5" />
        <path d="M20 25h9v20c0 6.6-4.4 10-10.5 10H14v-7.5h4c1.4 0 2-.7 2-2.2Z" />
      </g>
      <rect className="logo-caret" x="35" y="25" width="10" height="22" rx="1.5" style={{ fill: 'var(--logo-caret)' }} />
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
