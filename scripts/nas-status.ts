/**
 * Read-only gap analysis of everything FIPlay depends on.
 *
 * Usage: bun run nas:status
 *
 * Checks: ssh to the NAS, the deployed build (version.json vs local HEAD),
 * the PyRaumfeld container + API, the public metadata API and GitHub Pages.
 * Exits 1 when anything is behind or unreachable (pattern: promoto --status).
 *
 * Uses from .env: FIPLAY_NAS_HOST, FIPLAY_NAS_USER, FIPLAY_NAS_WEB_URL, FIPLAY_BACKEND_URL
 */
import { reportStatus } from './backend';
import { ENV, PUBLIC, env, fetchJson, gap, gaps, gitInfo, httpStatus, info, joinUrl, ok, skip, sshOk, sshTarget, summary } from './lib';

type VersionInfo = { commit: string; short?: string; builtAt?: string; dirty?: boolean };

// --- ssh ---------------------------------------------------------------------
const { target } = sshTarget();
const sshWorks = await sshOk();
if (sshWorks) ok(`ssh ${target}`);
else gap('MISSING', `passwordless ssh to ${target} (run: bun run nas:setup-ssh)`);

// --- deployed FIPlay -----------------------------------------------------------
const webUrl = env(ENV.NAS_WEB_URL);
if (!webUrl) {
  skip(`${ENV.NAS_WEB_URL} not set; skipping deployed-build check`);
} else {
  const status = await httpStatus(webUrl);
  if (status !== 200) {
    gap('UNREACHABLE', `${webUrl} -> ${status ?? 'no answer'}`);
  } else {
    ok(`${webUrl} -> 200`);
    const local = await gitInfo();
    const served = await fetchJson<VersionInfo>(`${joinUrl(webUrl, 'version.json')}?t=${Date.now()}`, 15_000);
    if (!served?.commit) {
      gap('UNKNOWN', `no version.json on the NAS (deployed before this tooling); run: bun run deploy`);
    } else if (served.commit === local.commit) {
      ok(`deployed ${served.commit.slice(0, 7)} = local HEAD${served.dirty ? ' (built from a dirty tree)' : ''}`);
    } else {
      gap('BEHIND', `deployed ${served.commit.slice(0, 7)} but local HEAD is ${local.short}; run: bun run deploy`);
    }
    if (served?.builtAt) info(`built ${served.builtAt}`);
  }
}

// --- backend -------------------------------------------------------------------
if (sshWorks) await reportStatus();
else skip('backend container check needs ssh');

// --- public services -----------------------------------------------------------
for (const [name, url] of Object.entries(PUBLIC)) {
  const status = await httpStatus(url);
  if (status === 200) ok(`${name}: ${url} -> 200`);
  else gap('UNREACHABLE', `${name}: ${url} -> ${status ?? 'no answer'}`);
}

// --- summary -------------------------------------------------------------------
if (gaps() > 0) {
  summary(`${gaps()} problem(s) found`);
  process.exit(1);
}
summary('everything up to date and reachable');
