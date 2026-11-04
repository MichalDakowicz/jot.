import { INK, mix, type Scheme } from './ink';
import { c, NAV_OFF, NAV_ON, SELECTION, shadow, TINTS } from './tokens';

type Palette = Record<keyof typeof c, string>;

/** Nine steps from `from` to `to`, the 100–900 ramp of the old palette. */
function ramp(from: string, mid: string, to: string): string[] {
  return [0.12, 0.3, 0.55, 0.8, 1, 0.22, 0.42, 0.62, 0.82].map((t, i) => (i < 5 ? mix(from, mid, t) : mix(mid, to, t)));
}

/**
 * The old palette's roles filled from the editor inks.
 *
 * Every phone screen was styled with `c.*`, read once when its stylesheet is
 * made. Rather than rebuild each one around a hook, the roles keep their
 * names and take new values: the page, panes, text, a neutral ramp from page
 * to text, an accent ramp from page through sage to text. A 100 is always the
 * wash nearest the page and a 900 the ink nearest the text, in either scheme,
 * so "dark text on its soft wash" holds in the dark too.
 */
export function paletteFor(scheme: Scheme): Palette {
  const ink = INK[scheme];
  const n = ramp(ink.bg, mix(ink.bg, ink.text, 0.5), ink.text);
  const a = ramp(ink.bg, ink.accent, ink.text);
  const g = ramp(ink.bg, mix(ink.accent, ink.muted, 0.5), ink.text);
  const step = (prefix: string, values: string[]) =>
    Object.fromEntries(values.map((v, i) => [`${prefix}${(i + 1) * 100}`, v]));
  return {
    bg: ink.bg,
    surface: ink.pane,
    paper: ink.raised,
    text: ink.text,
    accent: ink.accent,
    accent2: ink.link,
    ...step('n', n),
    ...step('a', a),
    ...step('g', g),
  } as Palette;
}

/**
 * Puts a scheme into the shared token objects in place. Call once, before
 * any screen module is loaded; stylesheets made afterwards read the new values.
 */
export function applyScheme(scheme: Scheme) {
  const ink = INK[scheme];
  Object.assign(c, paletteFor(scheme));
  for (const t of TINTS as unknown as { tint: string; soft: string; dark: string }[]) {
    const base = t.tint;
    t.soft = mix(ink.bg, base, scheme === 'dark' ? 0.16 : 0.12);
    t.dark = scheme === 'dark' ? mix(base, ink.text, 0.55) : mix(base, ink.text, 0.45);
    t.tint = scheme === 'dark' ? mix(base, ink.text, 0.35) : base;
  }
  // The editor look is flat: panes are told apart by their ground, not by lift.
  for (const s of Object.values(shadow) as { shadowOpacity: number; elevation: number }[]) {
    s.shadowOpacity = 0;
    s.elevation = 0;
  }
  Object.assign(SELECTION, { bg: ink.selection, fg: ink.text });
  Object.assign(NAV_ON, { bg: ink.raised, fg: ink.accent });
  Object.assign(NAV_OFF, { bg: 'transparent', fg: ink.muted });
}
