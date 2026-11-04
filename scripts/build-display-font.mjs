/**
 * Caprasimo has no Polish letters — its upstream file stops at Latin-1, so
 * ą ć ę ł ń ś ź ż and their capitals are missing. This script composes them
 * from parts that are already inside the font (the acute from á/Á, the tittle
 * from i, the cedilla from ç mirrored into an ogonek) plus a drawn bar for Ł,
 * and writes the result as "Jot Display".
 *
 * Caprasimo is OFL with no Reserved Font Name, so the derivative is allowed;
 * assets/fonts/OFL.txt travels with it.
 *
 *   node scripts/build-display-font.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'apps/mobile/assets/fonts/Caprasimo-Regular.ttf');
const OUT = path.join(ROOT, 'apps/mobile/assets/fonts/JotDisplay-Regular.ttf');

const font = opentype.parse(fs.readFileSync(SRC).buffer.slice(0));

/* ─────────────────────────────────────────────── contour plumbing */

const clone = (commands) => commands.map((c) => ({ ...c }));

/** Split a path's commands into one array per contour. */
function contours(commands) {
  const out = [];
  let cur = null;
  for (const cmd of commands) {
    if (cmd.type === 'M') {
      if (cur) out.push(cur);
      cur = [{ ...cmd }];
    } else if (cur) {
      cur.push({ ...cmd });
    }
  }
  if (cur) out.push(cur);
  return out;
}

const POINT_KEYS = [
  ['x', 'y'],
  ['x1', 'y1'],
  ['x2', 'y2'],
];

function bbox(commands) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const cmd of commands) {
    for (const [kx, ky] of POINT_KEYS) {
      if (typeof cmd[kx] !== 'number') continue;
      x1 = Math.min(x1, cmd[kx]);
      x2 = Math.max(x2, cmd[kx]);
      y1 = Math.min(y1, cmd[ky]);
      y2 = Math.max(y2, cmd[ky]);
    }
  }
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2 };
}

function mapPoints(commands, fn) {
  return commands.map((cmd) => {
    const next = { ...cmd };
    for (const [kx, ky] of POINT_KEYS) {
      if (typeof next[kx] !== 'number') continue;
      const [x, y] = fn(next[kx], next[ky]);
      next[kx] = x;
      next[ky] = y;
    }
    return next;
  });
}

const translate = (commands, dx, dy) => mapPoints(commands, (x, y) => [x + dx, y + dy]);
const scale = (commands, sx, sy, ox = 0, oy = 0) =>
  mapPoints(commands, (x, y) => [ox + (x - ox) * sx, oy + (y - oy) * sy]);

/**
 * Mirroring flips a contour's winding, which TrueType reads as a hole, so the
 * command order is reversed to put it back.
 */
function reverse(commands) {
  const pts = [];
  let cursor = null;
  for (const cmd of commands) {
    if (cmd.type === 'M') {
      cursor = { x: cmd.x, y: cmd.y };
      pts.push({ type: 'M', x: cmd.x, y: cmd.y });
    } else if (cmd.type === 'L') {
      pts.push({ type: 'L', from: cursor, x: cmd.x, y: cmd.y });
      cursor = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === 'Q') {
      pts.push({ type: 'Q', from: cursor, x1: cmd.x1, y1: cmd.y1, x: cmd.x, y: cmd.y });
      cursor = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === 'C') {
      pts.push({
        type: 'C',
        from: cursor,
        x1: cmd.x1, y1: cmd.y1, x2: cmd.x2, y2: cmd.y2, x: cmd.x, y: cmd.y,
      });
      cursor = { x: cmd.x, y: cmd.y };
    }
  }
  const segs = pts.filter((p) => p.type !== 'M');
  const start = segs.length ? segs[segs.length - 1] : null;
  if (!start) return commands;

  const out = [{ type: 'M', x: start.x, y: start.y }];
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const to = s.from ?? { x: pts[0].x, y: pts[0].y };
    if (s.type === 'L') out.push({ type: 'L', x: to.x, y: to.y });
    else if (s.type === 'Q') out.push({ type: 'Q', x1: s.x1, y1: s.y1, x: to.x, y: to.y });
    else out.push({ type: 'C', x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1, x: to.x, y: to.y });
  }
  out.push({ type: 'Z' });
  return out;
}

const mirrorX = (commands, axis) => reverse(mapPoints(commands, (x, y) => [2 * axis - x, y]));

/* ───────────────────────────────────────────────── donor parts */

const glyphOf = (ch) => font.charToGlyph(ch);
const cmdsOf = (ch) => clone(glyphOf(ch).path.commands);

/** The contours of `accented` that `plain` does not have: the diacritic. */
function diacritic(accented, plain) {
  const plainCount = contours(cmdsOf(plain)).length;
  const all = contours(cmdsOf(accented));
  return all.slice(plainCount).flat();
}

const ACUTE_LOW = diacritic('á', 'a');
const ACUTE_CAP = diacritic('Á', 'A');
const CEDILLA = diacritic('ç', 'c');
const TITTLE = contours(cmdsOf('i')).find((c) => bbox(c).y1 > 1000);

/** Ogonek: the cedilla mirrored, so the hook opens to the right. */
const OGONEK_MIRRORED = mirrorX(CEDILLA, bbox(CEDILLA).cx);

const X_HEIGHT = bbox(cmdsOf('x')).y2;
const CAP_HEIGHT = bbox(cmdsOf('H')).y2;

/** Flatten a contour's curves into a polygon, so it can be measured. */
function polygon(commands, steps = 16) {
  const pts = [];
  let cur = { x: 0, y: 0 };
  let start = null;
  for (const cmd of commands) {
    if (cmd.type === 'M') {
      cur = { x: cmd.x, y: cmd.y };
      start = cur;
      pts.push(cur);
    } else if (cmd.type === 'L') {
      cur = { x: cmd.x, y: cmd.y };
      pts.push(cur);
    } else if (cmd.type === 'Q') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        pts.push({
          x: u * u * cur.x + 2 * u * t * cmd.x1 + t * t * cmd.x,
          y: u * u * cur.y + 2 * u * t * cmd.y1 + t * t * cmd.y,
        });
      }
      cur = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === 'C') {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        pts.push({
          x: u * u * u * cur.x + 3 * u * u * t * cmd.x1 + 3 * u * t * t * cmd.x2 + t * t * t * cmd.x,
          y: u * u * u * cur.y + 3 * u * u * t * cmd.y1 + 3 * u * t * t * cmd.y2 + t * t * t * cmd.y,
        });
      }
      cur = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === 'Z' && start) {
      pts.push(start);
    }
  }
  return pts;
}

/**
 * Where the outline crosses a horizontal line: the stem edges at that height.
 * Measuring points inside a band is not enough — a fat display face puts its
 * on-curve points only at the extremes, so a band can be empty.
 */
function spanAtY(ch, y) {
  const pts = polygon(cmdsOf(ch));
  const xs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
      if (a.y === b.y) continue;
      xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  if (xs.length < 2) return null;
  const x1 = Math.min(...xs);
  const x2 = Math.max(...xs);
  return { x1, x2, w: x2 - x1 };
}

/** Signed area of a flattened contour; its sign is the winding direction. */
function signedArea(commands) {
  const pts = polygon(commands);
  let a = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    a += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
  }
  return a / 2;
}

/**
 * TrueType fills by non-zero winding, so a contour drawn the wrong way round
 * punches a hole instead of adding ink. Every contour this script draws is
 * matched to the direction the font's own outer contours run.
 */
const OUTER_SIGN = Math.sign(signedArea(contours(cmdsOf('H'))[0]));

function orient(commands) {
  return Math.sign(signedArea(commands)) === OUTER_SIGN ? commands : reverse(commands);
}

/* ─────────────────────────────────────────── glyph composition */

function centeredOver(part, baseBox, lift = 0) {
  const pb = bbox(part);
  return translate(part, baseBox.cx - pb.cx, lift);
}

function withOgonek(baseChar, rightInset, scaleTo = 1) {
  const base = cmdsOf(baseChar);
  const bb = bbox(base);
  let hook = orient(OGONEK_MIRRORED);
  if (scaleTo !== 1) hook = scale(hook, scaleTo, scaleTo, bbox(hook).cx, 0);
  const hb = bbox(hook);
  // Ogonek hangs from the right foot of the letter.
  return [...base, ...translate(hook, bb.x2 - rightInset - hb.cx, 0)];
}

/**
 * The bar of Ł/ł, as two wings that abut the stem instead of crossing it.
 * A bar drawn straight through would overlap the stem, and an overlap is only
 * safe under non-zero winding — even-odd rasterisers punch it out as a hole.
 * Two wings render the same everywhere.
 */
function strokedL(baseChar, barY, thicknessRatio, overhangRatio, slantRatio) {
  const base = cmdsOf(baseChar);
  const stem = spanAtY(baseChar, barY);
  if (!stem) throw new Error(`no stem found for ${baseChar} at y=${barY}`);

  const t = stem.w * thicknessRatio;
  const overhang = stem.w * overhangRatio;
  const x1 = stem.x1 - overhang;
  const x2 = stem.x2 + overhang;
  const rise = t * slantRatio;
  const slope = rise / (x2 - x1);
  const bite = 8; // a hair inside the stem, so no hairline seam shows

  const edge = (x) => barY + (x - x1) * slope;
  const wing = (from, to) =>
    orient([
      { type: 'M', x: from, y: edge(from) - t / 2 },
      { type: 'L', x: to, y: edge(to) - t / 2 },
      { type: 'L', x: to, y: edge(to) + t / 2 },
      { type: 'L', x: from, y: edge(from) + t / 2 },
      { type: 'Z' },
    ]);

  return [...base, ...wing(x1, stem.x1 + bite), ...wing(stem.x2 - bite, x2)];
}

const composed = [];

function add(name, unicode, commands, advanceFrom) {
  const p = new opentype.Path();
  p.commands = commands;
  composed.push(
    new opentype.Glyph({
      name,
      unicode,
      advanceWidth: glyphOf(advanceFrom).advanceWidth,
      path: p,
    }),
  );
}

// Acute: ć ń ś ź and capitals.
for (const [ch, base, up] of [
  ['ć', 'c', false], ['ń', 'n', false], ['ś', 's', false], ['ź', 'z', false],
  ['Ć', 'C', true], ['Ń', 'N', true], ['Ś', 'S', true], ['Ź', 'Z', true],
]) {
  const baseCmds = cmdsOf(base);
  const accent = up ? ACUTE_CAP : ACUTE_LOW;
  const lift = up ? 0 : 0;
  add(
    { 'ć': 'cacute', 'ń': 'nacute', 'ś': 'sacute', 'ź': 'zacute',
      'Ć': 'Cacute', 'Ń': 'Nacute', 'Ś': 'Sacute', 'Ź': 'Zacute' }[ch],
    ch.codePointAt(0),
    [...baseCmds, ...centeredOver(accent, bbox(baseCmds), lift)],
    base,
  );
}

// Dot above: ż Ż.
{
  const zb = cmdsOf('z');
  const dotLow = translate(TITTLE, 0, bbox(ACUTE_LOW).y1 - bbox(TITTLE).y1 + 40);
  add('zdotaccent', 'ż'.codePointAt(0), [...zb, ...centeredOver(dotLow, bbox(zb))], 'z');

  const Zb = cmdsOf('Z');
  const dotCap = translate(TITTLE, 0, bbox(ACUTE_CAP).y1 - bbox(TITTLE).y1 + 40);
  add('Zdotaccent', 'Ż'.codePointAt(0), [...Zb, ...centeredOver(dotCap, bbox(Zb))], 'Z');
}

// Ogonek: ą ę Ą Ę.
add('aogonek', 'ą'.codePointAt(0), withOgonek('a', 300, 1), 'a');
add('eogonek', 'ę'.codePointAt(0), withOgonek('e', 300, 1), 'e');
add('Aogonek', 'Ą'.codePointAt(0), withOgonek('A', 360, 1.1), 'A');
add('Eogonek', 'Ę'.codePointAt(0), withOgonek('E', 380, 1.1), 'E');

// Caprasimo has no middle dot either, and the app separates metadata with it.
{
  const dot = contours(cmdsOf('.'))[0];
  const db = bbox(dot);
  add('periodcentered', '·'.codePointAt(0), translate(dot, 0, X_HEIGHT / 2 - db.h / 2 - db.y1), '.');
}

// Stroked L.
add('lslash', 'ł'.codePointAt(0), strokedL('l', 1010, 0.36, 0.5, 1.7), 'l');
add('Lslash', 'Ł'.codePointAt(0), strokedL('L', 660, 0.36, 0.5, 1.7), 'L');

/* ─────────────────────────────────────────────────── assemble */

const glyphs = [];
for (let i = 0; i < font.glyphs.length; i++) glyphs.push(font.glyphs.get(i));
glyphs.push(...composed);

const out = new opentype.Font({
  familyName: 'Jot Display',
  styleName: 'Regular',
  unitsPerEm: font.unitsPerEm,
  ascender: font.ascender,
  descender: font.descender,
  glyphs,
});
const macNames = out.names.macintosh ?? out.names;
const source = font.names.macintosh ?? font.names;
macNames.copyright = source.copyright;
macNames.license = source.license;
macNames.licenseURL = source.licenseURL;
macNames.description = {
  en: 'Caprasimo with composed Polish letters. Derivative of Caprasimo (OFL 1.1).',
};

fs.writeFileSync(OUT, Buffer.from(out.toArrayBuffer()));

console.log(
  `x-height ${X_HEIGHT}, cap-height ${CAP_HEIGHT}, added ${composed.length} glyphs -> ${path.relative(ROOT, OUT)}`,
);
