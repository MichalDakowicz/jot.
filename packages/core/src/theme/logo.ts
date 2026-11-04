import logo from './logo.json';

/**
 * The mark: a monospace "j" with a block cursor after it, on a slate tile.
 * Paths on a 64 grid, drawn from shapes so nothing waits for a font. The
 * geometry is JSON so the icon script reads exactly what the apps draw.
 */
export const LOGO_PATHS = { tile: logo.tile, dot: logo.dot, stem: logo.stem, caret: logo.caret };

/** The tile keeps the dark page's slate in both schemes; it is the app's face, not the page's. */
export const LOGO_COLORS = logo.colors;
