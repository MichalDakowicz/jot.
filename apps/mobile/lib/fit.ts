/**
 * Shrink-to-fit for titles.
 *
 * Neither `adjustsFontSizeToFit` (iOS only) nor `onTextLayout` (missing on
 * react-native-web) covers every target this app ships to, so the width of a
 * title is worked out from the font instead. JetBrains Mono gives every glyph
 * the same 600/1000 em advance, Polish letters included.
 */
import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

const ADVANCE = 0.6;

/** Width of `text` set in the heading face at `fontSize`, in points. */
export function displayWidth(text: string, fontSize: number): number {
  return [...text].length * ADVANCE * fontSize;
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
