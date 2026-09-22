/**
 * Render the app icons from one SVG source.
 *
 * Usage: bun run icons
 *
 * Writes public/icons/{icon.svg, icon-192.png, icon-512.png,
 * icon-512-maskable.png, apple-touch-icon.png}. The PNGs are committed: a home
 * screen icon must not depend on anyone's toolchain, and the manifest needs
 * real PNGs (iOS ignores an SVG icon, and Android would not pad a square one).
 *
 * The renderer is Playwright's Chromium, already required by `bun browse`, so
 * this adds no dependency. The obvious alternative, sharp, is a 30 MB native
 * binary for four files.
 *
 * Variants differ only in how much of the canvas the glyph takes and whether
 * the corners are rounded:
 *   - icon.svg / icon-512   rounded square, for browsers that show it as is
 *   - maskable              full bleed, glyph inside the central 80% the OS keeps
 *   - apple-touch-icon      full bleed, opaque; iOS applies its own mask
 */
import { resolve } from 'node:path';

import { REPO_ROOT, abort, info, ok, phase } from './lib';

const OUT_DIR = resolve(REPO_ROOT, 'public', 'icons');

/** The pink FIPlay uses everywhere; --accent in src/styles/main.css. */
const ACCENT = '#e6007e';
const ACCENT_DEEP = '#b3005f';

/** mdiRadio, the same glyph the app shows as its brand mark. */
const GLYPH =
  'M20,6A2,2 0 0,1 22,8V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V8C2,7.15 2.53,6.42 3.28,6.13L15.71,1L16.47,2.83L8.83,6H20M20,8H4V12H16V10H18V12H20V8M7,14A3,3 0 0,0 4,17A3,3 0 0,0 7,20A3,3 0 0,0 10,17A3,3 0 0,0 7,14Z';

type Variant = { radius: number; glyph: number };

/** `radius` and `glyph` are fractions of the canvas. */
function svg (size: number, { radius, glyph }: Variant): string {
  const box = size * glyph;
  const offset = (size - box) / 2;
  const scale = box / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#g)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="${GLYPH}" fill="#ffffff"/>
  </g>
</svg>`;
}

const ROUNDED: Variant = { radius: 0.22, glyph: 0.56 };
const FULL_BLEED: Variant = { radius: 0, glyph: 0.46 };
const APPLE: Variant = { radius: 0, glyph: 0.54 };

const targets = [
  { file: 'icon-192.png', size: 192, variant: ROUNDED },
  { file: 'icon-512.png', size: 512, variant: ROUNDED },
  { file: 'icon-512-maskable.png', size: 512, variant: FULL_BLEED },
  { file: 'apple-touch-icon.png', size: 180, variant: APPLE },
];

phase('Rendering icons');

// The source of truth, also linked from index.html as the SVG favicon.
await Bun.write(resolve(OUT_DIR, 'icon.svg'), `${svg(512, ROUNDED)}\n`);
ok('icon.svg');

let chromium;
try {
  ({ chromium } = await import('@playwright/test'));
} catch {
  abort('Playwright is not installed. Run: bun install && bunx playwright install chromium');
}

const browser = await chromium.launch();
const page = await browser.newPage();

for (const { file, size, variant } of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0">${svg(size, variant)}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.screenshot({ path: resolve(OUT_DIR, file), omitBackground: false });
  info(`${file} (${size}x${size})`);
}

await browser.close();
ok(`wrote ${targets.length} PNGs to public/icons`);
