/**
 * The editor look: a calm slate dark and a paper light, monospace throughout.
 *
 * Taken from the Digital Meadow reference (slate ground, cream text, sage and
 * lavender accents) and turned down: one accent carries action and the
 * cursor, lavender only marks links, everything else is a grey step. Both
 * schemes hold the same keys, so a screen never asks which one it is in.
 */
export type Scheme = 'dark' | 'light';

export type Ink = {
  /** The page. */
  bg: string;
  /** Side panes, the gutter, the status bar. */
  pane: string;
  /** Hover rows, inputs, chips. */
  raised: string;
  /** Hairlines between panes and around inputs. */
  line: string;
  text: string;
  /** Secondary text: meta rows, labels. */
  muted: string;
  /** Markdown marks, line numbers, placeholders. */
  faint: string;
  /** Action, cursor, the current line number. */
  accent: string;
  /** Text set on an accent fill. */
  onAccent: string;
  /** Links and @mentions. */
  link: string;
  /** ==highlight== wash. */
  mark: string;
  selection: string;
  /** The current line, a step off the page. */
  activeLine: string;
  danger: string;
};

export const INK: Record<Scheme, Ink> = {
  dark: {
    bg: '#1c2225',
    pane: '#192023',
    raised: '#252d31',
    line: '#2e373b',
    text: '#e9eadc',
    muted: '#9aa8a3',
    faint: '#5c6a66',
    accent: '#c3dba9',
    onAccent: '#1c2225',
    link: '#cdb8ee',
    mark: '#4a4a2e',
    selection: '#33413a',
    activeLine: '#20282b',
    danger: '#e79a8f',
  },
  light: {
    bg: '#f7f6f0',
    pane: '#efeee6',
    raised: '#e8e7dd',
    line: '#dcdad0',
    text: '#22292c',
    muted: '#5f6b67',
    faint: '#a3aba6',
    accent: '#56703f',
    onAccent: '#f7f6f0',
    link: '#6f55a5',
    mark: '#f0e7b4',
    selection: '#d8e4c9',
    activeLine: '#efeee6',
    danger: '#a8463a',
  },
};

export const MONO = {
  family: "'JetBrains Mono', ui-monospace, 'Cascadia Mono', Menlo, monospace",
  /** Heading sizes as multiples of the body size; a heading stays one line tall in the gutter. */
  h: [1.6, 1.3, 1.12, 1] as const,
};

/** `hex` moved `amount` (0–1) of the way to `to`. */
export function mix(hex: string, to: string, amount: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex);
  const b = parse(to);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
}

/**
 * A notebook's colour as a dot on either page. The tint table was mixed for
 * light paper, where every tint already clears; on slate the deep ones sink,
 * so they are lifted toward the text colour.
 */
export function inkTint(hex: string, scheme: Scheme): string {
  return scheme === 'dark' ? mix(hex, INK.dark.text, 0.35) : hex;
}
