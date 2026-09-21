/**
 * Launch (or re-attach to) a shared browser for human + agent testing.
 *
 * Usage: bun browse
 *
 * - Starts the Vite dev server if nothing answers on the dev port yet, and
 *   stops it again when the browser closes.
 * - If a browser already listens on the CDP port, opens the FIPlay tab in
 *   that one instead of launching a second browser, so you and an agent
 *   share one window.
 * - Otherwise launches Chromium through Playwright with remote debugging
 *   enabled and a persistent profile in .browser-profile/ (gitignored), so
 *   logins and permissions survive restarts.
 *
 * Why Playwright rather than spawning Chrome ourselves: current Chrome builds
 * silently ignore --remote-debugging-port when started directly (no port, no
 * DevToolsActivePort, no error). Launching through Playwright opens the port
 * reliably, and it also resolves a matching Chromium without us guessing at
 * install locations.
 *
 * Environment (.env):
 *   FIPLAY_BACKEND_URL    appended as ?backend=… (optional: browser player only)
 *   BROWSER_CDP_PORT      CDP port (default 9222)
 *   BROWSER_PROFILE_DIR   profile directory (default .browser-profile)
 *   BROWSER_URL           first tab (default: dev server + backend param)
 *
 * (Pattern: cleancentive/frontend/scripts/launch-browser.ts)
 */
import { resolve } from 'node:path';

import { APP_PATH, DEV_PORT, ENV, REPO_ROOT, SCRIPT_DIR, abort, env, fetchJson, httpStatus, info, ok, runInherit, waitFor } from './lib';

const CDP_PORT = Number(env(ENV.CDP_PORT) ?? 9222);
const PROFILE_DIR = resolve(REPO_ROOT, env(ENV.PROFILE_DIR) ?? '.browser-profile');
const DEV_URL = `http://localhost:${DEV_PORT}${APP_PATH}`;
const BACKEND_URL = env(ENV.BACKEND_URL);
const TARGET_URL = env(ENV.BROWSER_URL) ?? (BACKEND_URL ? `${DEV_URL}?backend=${BACKEND_URL}` : DEV_URL);
const CDP = `http://127.0.0.1:${CDP_PORT}`;

type Tab = { url: string };

// --- preflights ------------------------------------------------------------
for (const script of ['check-deps.ts', 'check-env.ts', 'check-playwright.ts']) {
  const code = runInherit(['bun', resolve(SCRIPT_DIR, script)]);
  if (code !== 0) process.exit(code);
}

// --- dev server --------------------------------------------------------------
let vite: ReturnType<typeof Bun.spawn> | null = null;

async function devServerUp(): Promise<boolean> {
  const status = await httpStatus(DEV_URL, 2000);
  return status !== null && status < 500;
}

if (await devServerUp()) {
  ok(`dev server already running at ${DEV_URL}`);
} else {
  info('starting dev server (vite --host --strictPort)…');
  vite = Bun.spawn(['bunx', '--bun', 'vite', '--host', '--strictPort'], {
    cwd: REPO_ROOT,
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (!(await waitFor(devServerUp, { timeoutMs: 30_000, intervalMs: 500 }))) {
    vite.kill();
    abort(`dev server did not answer on ${DEV_URL} within 30s (is port ${DEV_PORT} taken?)`);
  }
  ok(`dev server running at ${DEV_URL}`);
}

function stopVite(): void {
  vite?.kill();
}

// --- re-attach to a running browser ------------------------------------------
async function tryAttach(): Promise<boolean> {
  const version = await fetchJson<{ Browser?: string }>(`${CDP}/json/version`, 1500);
  if (!version) return false;
  const tabs = (await fetchJson<Tab[]>(`${CDP}/json/list`, 1500)) ?? [];
  const devPrefix = DEV_URL.replace(/\/$/, '');
  if (tabs.some((t) => t.url.startsWith(devPrefix))) {
    ok(`attached to running browser (${version.Browser ?? 'CDP'}); FIPlay tab already open`);
    return true;
  }
  const res = await fetch(`${CDP}/json/new?${TARGET_URL}`, { method: 'PUT' }).catch(() => null);
  if (res?.ok) ok(`attached to running browser; opened ${TARGET_URL}`);
  else info(`could not open a tab via CDP; open ${TARGET_URL} manually`);
  return true;
}

if (await tryAttach()) {
  info(`CDP endpoint: ${CDP}`);
  if (vite) {
    info('dev server was started by this command; press Ctrl+C to stop it.');
    await vite.exited;
  }
  process.exit(0);
}

// --- launch ------------------------------------------------------------------
const { chromium } = await import('@playwright/test');

info(`browser:  ${chromium.executablePath()}`);
info(`profile:  ${PROFILE_DIR}`);
info(`url:      ${TARGET_URL}`);

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: null,
  args: [
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
    '--autoplay-policy=no-user-gesture-required',
    // Without these, Chrome asks macOS for the login keychain ("Chromium Safe
    // Storage") on first start and blocks on that modal dialog, which means it
    // never opens the debugging port. FIPlay stores no credentials, so an
    // in-memory store is all it needs.
    '--password-store=basic',
    '--use-mock-keychain',
    // Chrome validates the Origin header on the DevTools websocket, so an
    // external client (the Playwright MCP server, a Playwright script using
    // connectOverCDP) cannot attach without this. The port itself is bound to
    // localhost only.
    '--remote-allow-origins=*',
  ],
});

const page = context.pages()[0] ?? (await context.newPage());
try {
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 20_000 });
} catch {
  info(`could not open ${TARGET_URL} automatically; load it in the browser`);
}

if (!(await waitFor(async () => (await fetchJson(`${CDP}/json/version`, 1000)) !== null, { timeoutMs: 20_000, intervalMs: 500 }))) {
  await context.close().catch(() => {});
  stopVite();
  abort(`browser did not expose CDP on ${CDP} within 20s`);
}

ok('browser ready');
info(`CDP endpoint: ${CDP}`);
console.log('');
console.log('Agents can connect with:');
console.log(`  npx @playwright/mcp --cdp-endpoint ${CDP}   (configured in .mcp.json)`);
console.log('');
console.log('Press Ctrl+C to close.');

let closing = false;
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  await context.close().catch(() => {});
  stopVite();
  process.exit(0);
}

context.on('close', () => void shutdown());
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

await new Promise(() => {});
