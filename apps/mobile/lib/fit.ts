/**
 * Shrink-to-fit for the display face.
 *
 * Neither `adjustsFontSizeToFit` (iOS only) nor `onTextLayout` (missing on
 * react-native-web) covers every target this app ships to, so the width of a
 * title is worked out from the font itself instead. The table below is the
 * advance width of every glyph in JotDisplay-Regular, in ems, read straight
 * off the file:
 *
 *   node -e "…opentype.parse(…).charToGlyph(ch).advanceWidth / unitsPerEm"
 *
 * Rebuild it if scripts/build-display-font.mjs ever changes the metrics.
 */
import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

/** Mean advance, used for anything outside the table. */
const FALLBACK = 0.603;

const EM: Record<string, number> = {
  ' ': 0.25, '!': 0.308, '"': 0.432, '#': 0.6, $: 0.6, '%': 0.811, '&': 0.869, "'": 0.228,
  '(': 0.499, ')': 0.499, '*': 0.6, '+': 0.6, ',': 0.3, '-': 0.284, '.': 0.3, '/': 0.472,
  '0': 0.6, '1': 0.6, '2': 0.6, '3': 0.6, '4': 0.6, '5': 0.6, '6': 0.6, '7': 0.6, '8': 0.6,
  '9': 0.6, ':': 0.3, ';': 0.3, '<': 0.5, '=': 0.6, '>': 0.5, '?': 0.482, '@': 0.799,
  A: 0.827, B: 0.717, C: 0.72, D: 0.802, E: 0.691, F: 0.661, G: 0.794, H: 0.802, I: 0.414,
  J: 0.627, K: 0.827, L: 0.633, M: 0.884, N: 0.83, O: 0.778, P: 0.684, Q: 0.781, R: 0.776,
  S: 0.645, T: 0.701, U: 0.82, V: 0.803, W: 1.04, X: 0.795, Y: 0.78, Z: 0.686,
  '[': 0.499, '\\': 0.472, ']': 0.499, '^': 0.5, _: 0.5, '`': 0.5,
  a: 0.567, b: 0.632, c: 0.526, d: 0.65, e: 0.53, f: 0.424, g: 0.578, h: 0.679, i: 0.356,
  j: 0.369, k: 0.734, l: 0.365, m: 0.964, n: 0.671, o: 0.602, p: 0.666, q: 0.648, r: 0.535,
  s: 0.477, t: 0.463, u: 0.678, v: 0.627, w: 0.989, x: 0.602, y: 0.619, z: 0.514,
  '{': 0.499, '|': 0.5, '}': 0.499, '~': 0.667,
  // The Polish letters the build script composes keep the width of their base.
  ą: 0.567, ć: 0.526, ę: 0.53, ł: 0.365, ń: 0.671, ó: 0.602, ś: 0.477, ź: 0.514, ż: 0.514,
  Ą: 0.827, Ć: 0.72, Ę: 0.691, Ł: 0.633, Ń: 0.83, Ó: 0.778, Ś: 0.645, Ź: 0.686, Ż: 0.686,
};

/** Width of `text` set in the display face at `fontSize`, in points. */
export function displayWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) em += EM[ch] ?? FALLBACK;
  return em * fontSize;
}

/**
 * The largest size at or below `base` that keeps `text` on one line inside
 * `width`. Falls back to `base` before the first layout pass, and never goes
 * under `min` — past that the text is allowed to wrap instead.
 */
export function fitFontSize(text: string, width: number, base: number, min: number): number {
  if (!width || !text.trim()) return base;
  const em = displayWidth(text, 1);
  if (!em) return base;
  const wanted = width / em;
  if (wanted >= base) return base;
  return Math.max(min, Math.floor(wanted * 2) / 2);
}

/** Screen gutter either side of a title, so the window gives a usable width. */
const GUTTER = 20;

/**
 * Wire the returned `onLayout` to the element that holds the title; the size
 * comes back scaled down as soon as the title stops fitting on one line.
 *
 * Until a real measurement arrives the window is used instead of waiting: a
 * `TextInput` whose own font size is what changes cannot be trusted to report
 * its layout before the next keystroke, and a width of zero would leave the
 * title stuck at `base` for as long as that took.
 */
export function useFittedDisplaySize(text: string, base: number, min: number) {
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setMeasured((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, []);

  const width = measured || Math.max(0, windowWidth - GUTTER * 2);

  return { fontSize: fitFontSize(text, width, base, min), onLayout };
}
