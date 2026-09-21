/**
 * Preflight: ensure node_modules matches bun.lock.
 *
 * Runs `bun install --frozen-lockfile` when node_modules is missing or older
 * than bun.lock (a pull brought new deps). --frozen-lockfile never mutates the
 * lock silently: if package.json and bun.lock drift, we exit non-zero and say
 * to run `bun install` by hand.
 *
 * No-op when in sync. Idempotent: safe on every `bun dev` / `bun browse`.
 * (Pattern: cleancentive/infrastructure/check-deps.ts)
 */
import { existsSync, statSync, utimesSync } from 'node:fs';
import { resolve } from 'node:path';

import { REPO_ROOT, runInherit } from './lib';

const LOCK = resolve(REPO_ROOT, 'bun.lock');
const NODE_MODULES = resolve(REPO_ROOT, 'node_modules');

function needsInstall(): boolean {
  if (!existsSync(NODE_MODULES)) return true;
  try {
    return statSync(LOCK).mtimeMs > statSync(NODE_MODULES).mtimeMs;
  } catch {
    return true;
  }
}

if (needsInstall()) {
  console.log('Installing dependencies (bun install --frozen-lockfile)…');
  const code = runInherit(['bun', 'install', '--frozen-lockfile']);
  if (code !== 0) {
    console.error('');
    console.error('Dependency install failed. If bun.lock is out of sync with');
    console.error('package.json, run `bun install` manually to regenerate it.');
    process.exit(code);
  }
  const now = new Date();
  utimesSync(NODE_MODULES, now, now);
}
