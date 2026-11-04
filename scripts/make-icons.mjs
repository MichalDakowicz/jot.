/**
 * Draws every app icon from the mark in packages/core/src/theme/logo.json:
 * a monospace "j" and its cursor on the slate tile. The mark is shapes, so
 * no font is needed at render time.
 *
 *   node scripts/make-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'packages/core/src/theme/logo.json'), 'utf8'));
const ASSETS = path.join(ROOT, 'apps/mobile/assets');
/** Copied into each web export verbatim, so these keep the paths the HTML names. */
const PUBLIC = [path.join(ROOT, 'apps/mobile/public'), path.join(ROOT, 'apps/web/public')];

const { tile: TILE, letter: LETTER, caret: CARET } = LOGO.colors;

/** The glyphs on the 64 grid, scaled to `scale` of the canvas and centred. */
function mark(size, { letter = LETTER, caret = CARET, scale = 1 } = {}) {
  const k = (size / 64) * scale;
  const offset = (size - 64 * k) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${k})">`
    + `<path d="${LOGO.dot}" fill="${letter}"/><path d="${LOGO.stem}" fill="${letter}"/><path d="${LOGO.caret}" fill="${caret}"/></g>`;
}

function svg(size, { background, radius = 0, content }) {
  const bg = background ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg}${content}</svg>`;
}

async function write(dir, name, markup) {
  await fs.promises.mkdir(dir, { recursive: true });
  const out = path.join(dir, name);
  await sharp(Buffer.from(markup)).png().toFile(out);
  console.log('wrote', path.relative(ROOT, out));
}

const S = 1024;
const tiled = (size, radius = 0) => svg(size, { background: TILE, radius, content: mark(size) });

// Store icon: full bleed, the OS applies its own mask.
await write(ASSETS, 'icon.png', tiled(S));
// Android adaptive layers; the glyphs stay inside the 66% safe circle.
await write(ASSETS, 'android-icon-background.png', svg(S, { background: TILE, content: '' }));
await write(ASSETS, 'android-icon-foreground.png', svg(S, { content: mark(S, { scale: 0.62 }) }));
await write(ASSETS, 'android-icon-monochrome.png', svg(S, { content: mark(S, { letter: '#ffffff', caret: '#ffffff', scale: 0.62 }) }));
await write(ASSETS, 'splash-icon.png', tiled(512, 512 * 0.22));
await write(ASSETS, 'favicon.png', tiled(256, 256 * 0.22));

for (const dir of PUBLIC) {
  for (const size of [32, 192, 512]) await write(dir, `icon-${size}.png`, tiled(size, size * 0.22));
  // Apple masks the square itself.
  await write(dir, 'apple-touch-icon.png', tiled(180));
  await fs.promises.writeFile(path.join(dir, 'favicon.svg'), tiled(64, 14) + '\n');
  await fs.promises.writeFile(
    path.join(dir, 'manifest.json'),
    JSON.stringify({
      name: 'Jot.',
      short_name: 'Jot.',
      start_url: '/',
      display: 'standalone',
      background_color: TILE,
      theme_color: TILE,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }, null, 2) + '\n',
  );
  console.log('wrote', path.relative(ROOT, path.join(dir, 'manifest.json')));
}
