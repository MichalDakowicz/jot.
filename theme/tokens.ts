/**
 * Design tokens lifted from the "Organic" design system that the
 * Class Notes canvas is built on (_ds/.../styles.css).
 */
export const c = {
  bg: '#f5ead8',
  surface: '#ebddc5',
  paper: '#fffdf9',
  text: '#201e1d',
  accent: '#c67139',
  accent2: '#7a8a5e',

  n100: '#f9f4ed',
  n200: '#eee7db',
  n300: '#dcd3c4',
  n400: '#c0b6a5',
  n500: '#a19786',
  n600: '#82796a',
  n700: '#645c50',
  n800: '#474238',
  n900: '#2e2b25',

  a100: '#fff2eb',
  a200: '#ffe1d0',
  a300: '#ffc6a5',
  a400: '#f6a06b',
  a500: '#d67f48',
  a600: '#b2622d',
  a700: '#8c491a',
  a800: '#643312',
  a900: '#402310',

  g100: '#f0fae1',
  g200: '#e1eecc',
  g300: '#ccdbb2',
  g400: '#aebf92',
  g500: '#8fa073',
  g600: '#728157',
  g700: '#56633f',
  g800: '#3d472b',
  g900: '#272e1b',
} as const;

export const f = {
  head: 'JotDisplay',
  b400: 'Figtree_400Regular',
  b500: 'Figtree_500Medium',
  b600: 'Figtree_600SemiBold',
  b700: 'Figtree_700Bold',
  b800: 'Figtree_800ExtraBold',
  mono: 'monospace',
} as const;

export const shadow = {
  sm: {
    shadowColor: c.n900,
    shadowOpacity: 0.14,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: c.n900,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  lg: {
    shadowColor: c.n900,
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

/**
 * Notebook colour ways, indexed by `notebooks.tint`.
 *
 * The index is stored on the row, so the first five keep their places: change
 * their order and every notebook already filed changes colour. New ways go on
 * the end.
 *
 * `tint` is the blob, `soft` the wash a card sits on, `dark` the text on that
 * wash. The first five come from the design's own two families; the rest are
 * mixed to sit on the same paper — each one clears 4.5:1 for its text on its
 * own wash and on the page, and stays visible against the paper as a dot.
 *
 * `notebooks.tint` has a check on its range in supabase/schema.sql: a new way
 * here needs that check widened too, or saving a notebook in it fails.
 */
export const TINTS = [
  { tint: c.a500, soft: c.a100, dark: c.a700, hex: '#d67f48' },
  { tint: c.g500, soft: c.g100, dark: c.g700, hex: '#8fa073' },
  { tint: c.a700, soft: c.n200, dark: c.a800, hex: '#8c491a' },
  { tint: c.g700, soft: c.g100, dark: c.g800, hex: '#56633f' },
  { tint: c.n500, soft: c.n200, dark: c.n800, hex: '#a19786' },

  // Ochre, eucalyptus, slate, plum, clay rose, periwinkle, coffee.
  { tint: '#c2992b', soft: '#faf1d8', dark: '#6f5312', hex: '#c2992b' },
  { tint: '#4f8a80', soft: '#e4f1ee', dark: '#2c574f', hex: '#4f8a80' },
  { tint: '#5f7794', soft: '#e9eff7', dark: '#33475e', hex: '#5f7794' },
  { tint: '#8a5a78', soft: '#f6ebf3', dark: '#57324d', hex: '#8a5a78' },
  { tint: '#c07370', soft: '#fceae8', dark: '#7a3a37', hex: '#c07370' },
  { tint: '#7b76a8', soft: '#eeedf9', dark: '#46426d', hex: '#7b76a8' },
  { tint: '#8a6b4f', soft: '#f4ece1', dark: '#513c29', hex: '#8a6b4f' },
] as const;

export const tintOf = (i: number) => TINTS[((i % TINTS.length) + TINTS.length) % TINTS.length];

/**
 * One highlight for everything a selection holds.
 *
 * A browser paints its own blue over selected text, which is nothing like the
 * wash the held blocks beside it sit on — so both are painted with this, and
 * taking a line and taking five look like the same act.
 */
export const SELECTION = { bg: c.a300, fg: c.n900 } as const;

export const NAV_ON = { bg: c.a200, fg: c.a800 };
export const NAV_OFF = { bg: 'transparent', fg: c.n600 };
