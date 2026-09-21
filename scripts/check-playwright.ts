/**
 * Preflight: ensure Playwright's Chromium is installed for `bun browse`.
 *
 * `bun browse` launches the browser through Playwright, because launching
 * Chrome directly with --remote-debugging-port does not reliably open the
 * port on current Chrome builds (see scripts/browse.ts). Playwright knows
 * which Chromium revision matches the installed @playwright/test, so we ask
 * it rather than guessing from the contents of the download cache.
 *
 * We do not auto-install: the download is ~100 MB and on Linux it can need
 * system libraries that require sudo. We print the command instead.
 *
 * Idempotent: silent no-op once Chromium is present.
 * (Pattern: cleancentive/infrastructure/check-playwright.ts)
 */
import { existsSync } from 'node:fs';

let executable: string | null = null;
try {
  const { chromium } = await import('@playwright/test');
  executable = chromium.executablePath();
} catch {
  executable = null;
}

if (executable && existsSync(executable)) process.exit(0);

console.error('');
console.error(
  executable
    ? 'Playwright is installed but its Chromium build is missing.'
    : 'Playwright is not installed (or could not be loaded).',
);
console.error('`bun browse` needs it to launch the shared browser.');
console.error('');
console.error('Install it with:');
console.error('');
console.error('  bun install && bunx playwright install chromium');
console.error('');
console.error('If Playwright reports missing system libraries, run the command it prints.');
process.exit(1);
