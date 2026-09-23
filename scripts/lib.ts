/**
 * Shared helpers for the FIPlay tooling (`bun browse`, `bun run deploy`, …).
 *
 * Everything that identifies the user's infrastructure (NAS host, user, paths,
 * URLs) comes from the gitignored `.env`, documented in `.env.example`. This
 * repo is public: no real host, user or IP may be written into any committed
 * file, and no password is ever read from env or disk.
 *
 * Output style follows cleancentive's ops scripts: no colour, uppercase status
 * keywords (OK / SKIP / GAP / ABORT / SUMMARY) and `=== Phase n ===` separators.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SCRIPT_DIR = import.meta.dir;
export const REPO_ROOT = resolve(SCRIPT_DIR, '..');
export const ENV_FILE = resolve(REPO_ROOT, '.env');
export const ENV_EXAMPLE = resolve(REPO_ROOT, '.env.example');

/** Not infrastructure-specific: fixed by vite.config.mjs (`base`, `outDir`, `server.port`). */
export const DEV_PORT = 3000;
export const APP_PATH = '/FIPlay/';
export const DIST_DIR = resolve(REPO_ROOT, 'dist', 'FIPlay');

export const DEFAULT_METADATA_URL = 'https://fip-metadata.fly.dev';

/** The GitHub Pages build, which always uses the public metadata service. */
export const PAGES_URL = 'https://culmat.github.io/FIPlay/';

/** The metadata service this checkout builds against. */
export function metadataURL(): string {
  return envOr('VITE_METADATA_URL', DEFAULT_METADATA_URL).replace(/\/+$/, '');
}

export const ENV = {
  NAS_HOST: 'FIPLAY_NAS_HOST',
  NAS_USER: 'FIPLAY_NAS_USER',
  NAS_WEB_DIR: 'FIPLAY_NAS_WEB_DIR',
  NAS_WEB_URL: 'FIPLAY_NAS_WEB_URL',
  BACKEND_URL: 'FIPLAY_BACKEND_URL',
  BACKEND_PORT: 'FIPLAY_BACKEND_PORT',
  BACKEND_IMAGE: 'FIPLAY_BACKEND_IMAGE',
  BACKEND_CONTAINER: 'FIPLAY_BACKEND_CONTAINER',
  NAS_DOCKER: 'FIPLAY_NAS_DOCKER',
  BACKEND_PATH: 'FIPLAY_BACKEND_PATH',
  NAS_HTTPS_HOST: 'FIPLAY_NAS_HTTPS_HOST',
  NAS_HTTPS_PORT: 'FIPLAY_NAS_HTTPS_PORT',
  NAS_CERT: 'FIPLAY_NAS_CERT',
  NAS_CERT_CHAIN: 'FIPLAY_NAS_CERT_CHAIN',
  CDP_PORT: 'BROWSER_CDP_PORT',
  PROFILE_DIR: 'BROWSER_PROFILE_DIR',
  BROWSER_URL: 'BROWSER_URL',
  METADATA_URL: 'VITE_METADATA_URL',
} as const;

// Bun loads .env from the cwd. Fall back to parsing the repo's .env so the
// scripts also work when invoked from another directory.
loadDotEnvFallback();

function loadDotEnvFallback(): void {
  if (!existsSync(ENV_FILE)) return;
  for (const raw of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v ? v : undefined;
}

export function envOr(key: string, fallback: string): string {
  return env(key) ?? fallback;
}

/** Abort with a list of missing keys, pointing at .env.example. */
export function requireEnv(...keys: string[]): Record<string, string> {
  const missing = keys.filter((k) => !env(k));
  if (missing.length > 0) {
    console.error(`ABORT missing in .env: ${missing.join(', ')}`);
    console.error(`  copy .env.example to .env and fill in the values (see comments there)`);
    process.exit(1);
  }
  return Object.fromEntries(keys.map((k) => [k, env(k)!]));
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
let gapCount = 0;

export function ok(msg: string): void {
  console.log(`OK ${msg}`);
}
export function skip(msg: string): void {
  console.log(`SKIP ${msg}`);
}
export function info(msg: string): void {
  console.log(`  ${msg}`);
}
export function gap(status: string, msg: string): void {
  gapCount += 1;
  console.log(`${status} ${msg}`);
}
export function gaps(): number {
  return gapCount;
}
export function abort(msg: string): never {
  console.error(`ABORT ${msg}`);
  process.exit(1);
}
export function phase(title: string): void {
  console.log('');
  console.log(`=== ${title} ===`);
}
export function summary(msg: string): void {
  console.log('');
  console.log(`SUMMARY ${msg}`);
}

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------
export type RunResult = { code: number; stdout: string; stderr: string };

/** Run a command, capture output. */
export async function run(cmd: string[], opts: { cwd?: string } = {}): Promise<RunResult> {
  const proc = Bun.spawn(cmd, { cwd: opts.cwd ?? REPO_ROOT, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  const code = await proc.exited;
  return { code, stdout: stdout.trim(), stderr: stderr.trim() };
}

/** Run a command with the terminal attached (prompts, progress, colours pass through). */
export function runInherit(cmd: string[], opts: { cwd?: string } = {}): number {
  const res = Bun.spawnSync(cmd, { cwd: opts.cwd ?? REPO_ROOT, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
  return res.exitCode ?? 1;
}

/** Single-quote a string for POSIX sh. */
export function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(
  check: () => Promise<boolean>,
  opts: { timeoutMs: number; intervalMs?: number },
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < opts.timeoutMs) {
    if (await check()) return true;
    await sleep(opts.intervalMs ?? 1000);
  }
  return false;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
export async function httpStatus(url: string, timeoutMs = 5000): Promise<number | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
    return res.status;
  } catch {
    return null;
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 5000): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function joinUrl(base: string, path: string): string {
  return base.endsWith('/') ? base + path : `${base}/${path}`;
}

// ---------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------
export type GitInfo = { commit: string; short: string; branch: string; dirty: boolean };

export async function gitInfo(): Promise<GitInfo> {
  const commit = (await run(['git', 'rev-parse', 'HEAD'])).stdout;
  const branch = (await run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout;
  const status = (await run(['git', 'status', '--porcelain'])).stdout;
  return { commit, short: commit.slice(0, 7), branch, dirty: status.length > 0 };
}

// ---------------------------------------------------------------------------
// NAS over ssh
// ---------------------------------------------------------------------------
export type SshTarget = { host: string; user: string; target: string };

export function sshTarget(): SshTarget {
  const e = requireEnv(ENV.NAS_HOST, ENV.NAS_USER);
  const host = e[ENV.NAS_HOST];
  const user = e[ENV.NAS_USER];
  return { host, user, target: `${user}@${host}` };
}

/** Non-interactive: never prompts; fails fast when key auth is not set up. */
export const SSH_BATCH_ARGS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];

/**
 * Run a POSIX sh snippet on the NAS. The remote login shell is plain /bin/sh
 * (no bash-isms) and the non-interactive PATH is minimal.
 */
export async function ssh(remoteSh: string, opts: { inherit?: boolean; tty?: boolean } = {}): Promise<RunResult> {
  const { target } = sshTarget();
  const cmd = ['ssh', ...SSH_BATCH_ARGS, ...(opts.tty ? ['-t'] : []), target, remoteSh];
  if (opts.inherit) return { code: runInherit(cmd), stdout: '', stderr: '' };
  return run(cmd);
}

export async function sshOk(): Promise<boolean> {
  return (await ssh('true')).code === 0;
}

export async function requireSsh(): Promise<SshTarget> {
  const t = sshTarget();
  if (!(await sshOk())) {
    abort(`cannot ssh to ${t.target} without a password. Run: bun run nas:setup-ssh`);
  }
  return t;
}

/**
 * Prefix for remote docker commands: resolves the docker binary into $D.
 * Container Station on QNAP keeps docker off the non-interactive PATH, so we
 * fall back to its install location; FIPLAY_NAS_DOCKER pins it explicitly.
 */
export function remoteDocker(sh: string): string {
  const pinned = env(ENV.NAS_DOCKER) ?? '';
  return [
    `D=${shq(pinned)}`,
    `[ -n "$D" ] || D="$(command -v docker 2>/dev/null || ls /share/*/.qpkg/container-station/bin/docker 2>/dev/null | head -n1)"`,
    `[ -n "$D" ] || { echo "docker binary not found on NAS (set ${ENV.NAS_DOCKER} in .env)" >&2; exit 127; }`,
    sh,
  ].join('; ');
}

// ---------------------------------------------------------------------------
// PyRaumfeld backend
// ---------------------------------------------------------------------------
export type Zone = { name: string; udn: string };

export function backendCfg() {
  return {
    url: env(ENV.BACKEND_URL),
    /**
     * Where the browser reaches the API when the app is served over HTTPS.
     *
     * A page on https may not call an http address, so the speakers are only
     * reachable from an installed app if the API answers on the app's own
     * origin. `bun run nas:https` puts a proxy there; this is the path it
     * listens on, and what the manifest's start_url carries.
     */
    path: env(ENV.BACKEND_PATH),
    port: envOr(ENV.BACKEND_PORT, '8081'),
    image: envOr(ENV.BACKEND_IMAGE, 'ghcr.io/culmat/pyraumfeld:master'),
    container: envOr(ENV.BACKEND_CONTAINER, 'pyraumfeld'),
  };
}

/**
 * Zones as reported by the PyRaumfeld API, or null when unreachable.
 *
 * The default is generous on purpose: PyRaumfeld talks to the Raumfeld host
 * over UPnP while answering, and /zones regularly takes well over ten seconds
 * when that host is slow to respond.
 */
export async function backendZones(timeoutMs = 25_000): Promise<Zone[] | null> {
  const { url } = backendCfg();
  if (!url) return null;
  const json = await fetchJson<{ data?: Zone[]; success?: boolean }>(joinUrl(url, 'zones'), timeoutMs);
  return json?.data ?? null;
}
