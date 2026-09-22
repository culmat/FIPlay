/**
 * Deploy the static FIPlay build to the NAS web server directory.
 *
 * Usage: bun run deploy [--dry-run] [--skip-build]
 *
 * Phases (pattern: cleancentive/infrastructure/scripts/promoto):
 *   1. Preflight  ssh key auth, rsync on both ends, git state
 *   2. Build      bun run build, then write dist/FIPlay/version.json
 *   3. Sync       rsync --delete dist/FIPlay/ -> FIPLAY_NAS_WEB_DIR/
 *   4. Verify     version.json served from FIPLAY_NAS_WEB_URL matches HEAD
 *
 * Requires in .env: FIPLAY_NAS_HOST, FIPLAY_NAS_USER, FIPLAY_NAS_WEB_DIR, FIPLAY_NAS_WEB_URL
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { DIST_DIR, ENV, REPO_ROOT, abort, backendCfg, fetchJson, gitInfo, httpStatus, info, joinUrl, ok, phase, requireEnv, requireSsh, runInherit, ssh, summary, waitFor } from './lib';

/** The NAS web server is occasionally slow on a file it has just received. */
const VERIFY_TIMEOUT_MS = 15_000;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run') || args.has('-n');
const SKIP_BUILD = args.has('--skip-build');
for (const a of args) {
  if (!['--dry-run', '-n', '--skip-build'].includes(a)) abort(`unknown option ${a}\nusage: bun run deploy [--dry-run] [--skip-build]`);
}

type VersionInfo = { commit: string; short: string; branch: string; dirty: boolean; builtAt: string };

// --- Phase 1 -----------------------------------------------------------------
phase('Phase 1: Preflight');
const cfg = requireEnv(ENV.NAS_HOST, ENV.NAS_USER, ENV.NAS_WEB_DIR, ENV.NAS_WEB_URL);
const webDir = cfg[ENV.NAS_WEB_DIR].replace(/\/+$/, '');
const webUrl = cfg[ENV.NAS_WEB_URL].endsWith('/') ? cfg[ENV.NAS_WEB_URL] : `${cfg[ENV.NAS_WEB_URL]}/`;

const { target } = await requireSsh();
ok(`ssh ${target}`);

if (!Bun.which('rsync')) abort('rsync not found locally');
const remoteRsync = await ssh('command -v rsync');
if (remoteRsync.code !== 0 || !remoteRsync.stdout) abort('rsync not found on the NAS');
ok(`rsync local + remote (${remoteRsync.stdout})`);

const git = await gitInfo();
if (git.dirty) info(`WARN working tree is dirty; version.json will say so`);
ok(`git ${git.short} on ${git.branch}${git.dirty ? ' (dirty)' : ''}`);

// --- Phase 2 -----------------------------------------------------------------
phase('Phase 2: Build');
if (SKIP_BUILD) {
  info('--skip-build: using existing dist/FIPlay');
} else {
  const code = runInherit(['bun', 'run', 'build'], { cwd: REPO_ROOT });
  if (code !== 0) abort(`build failed (exit ${code})`);
}
if (!existsSync(resolve(DIST_DIR, 'index.html'))) abort(`${DIST_DIR}/index.html missing`);

const version: VersionInfo = { commit: git.commit, short: git.short, branch: git.branch, dirty: git.dirty, builtAt: new Date().toISOString() };
await Bun.write(resolve(DIST_DIR, 'version.json'), `${JSON.stringify(version, null, 2)}\n`);
ok(`built dist/FIPlay (version.json -> ${git.short})`);

// An installed copy launches at the manifest's start_url, which carries no
// query string, so it would come up without speakers. The backend URL is
// specific to this network, so it is stamped in at deploy time rather than
// committed into the manifest.
const manifestPath = resolve(DIST_DIR, 'manifest.webmanifest');
const backendURL = backendCfg().url;
if (backendURL && existsSync(manifestPath)) {
  const manifest = JSON.parse(await Bun.file(manifestPath).text());
  manifest.start_url = `/FIPlay/?backend=${encodeURIComponent(backendURL)}`;
  await Bun.write(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  ok(`manifest start_url -> ${manifest.start_url}`);
} else if (!backendURL) {
  info(`${ENV.BACKEND_URL} not set: installed app will start without speakers`);
}

// --- Phase 3 -----------------------------------------------------------------
phase(`Phase 3: Sync${DRY_RUN ? ' (dry run)' : ''}`);
const rsyncArgs = [
  'rsync',
  '-rltz',
  '--delete',
  '--no-owner',
  '--no-group',
  '--exclude',
  '@Recycle',
  '--exclude',
  '.DS_Store',
  '-e',
  'ssh -o BatchMode=yes -o ConnectTimeout=10',
  ...(DRY_RUN ? ['-n', '-v'] : ['--stats']),
  `${DIST_DIR}/`,
  `${target}:${webDir}/`,
];
info(rsyncArgs.slice(1).join(' '));
const rsyncCode = runInherit(rsyncArgs);
if (rsyncCode !== 0) abort(`rsync failed (exit ${rsyncCode})`);
ok(DRY_RUN ? 'dry run complete, nothing changed' : `synced to ${target}:${webDir}/`);

if (DRY_RUN) {
  summary(`would deploy ${git.short} to ${webUrl}`);
  process.exit(0);
}

// --- Phase 4 -----------------------------------------------------------------
phase('Phase 4: Verify');
const pageStatus = await httpStatus(webUrl, VERIFY_TIMEOUT_MS);
if (pageStatus !== 200) abort(`${webUrl} answered ${pageStatus ?? 'nothing'}`);
ok(`${webUrl} -> 200`);

// The NAS web server can take several seconds to serve a file it has just
// received, so poll rather than giving the first request one short chance.
let served: VersionInfo | null = null;
const gotVersion = await waitFor(
  async () => {
    served = await fetchJson<VersionInfo>(`${joinUrl(webUrl, 'version.json')}?t=${Date.now()}`, VERIFY_TIMEOUT_MS);
    return served?.commit === git.commit;
  },
  { timeoutMs: 60_000, intervalMs: 2000 },
);
if (!gotVersion) {
  const seen = (served as VersionInfo | null)?.commit;
  abort(seen ? `served version.json says ${seen.slice(0, 7)}, expected ${git.short}` : `${joinUrl(webUrl, 'version.json')} not readable after deploy`);
}
ok(`served version.json -> ${git.short}`);

const backend = backendCfg().url;
summary(`deployed ${git.short} -> ${webUrl}${backend ? `?backend=${backend}` : ''}`);
