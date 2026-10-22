/**
 * Manage the Music Assistant container on the NAS (the house-radio trial).
 *
 * Usage:
 *   bun run ma status              container state, version, memory, onboarding state
 *   bun run ma logs [-n N] [-f]    tail (or follow) container logs
 *   bun run ma pull                pull the image, report digest change
 *   bun run ma restart             restart the container, wait for the API
 *   bun run ma update [--force]    pull; if the digest changed (or --force, or the
 *                                  container does not exist yet) (re)create it
 *
 * Music Assistant needs host networking: it discovers the Raumfeld host and other
 * players over UPnP and mDNS, and its stream server must be reachable by the speakers.
 * Its data lives on the disk volume, not under /share/<name>, because /share is a
 * tmpfs on QNAP and a folder created directly there is gone after a reboot.
 * The music library is mounted read-only at /media.
 *
 * See radio/REQUIREMENTS.md, section "The trial".
 *
 * Requires in .env: FIPLAY_NAS_HOST, FIPLAY_NAS_USER, FIPLAY_MA_MUSIC_DIR (for update);
 * FIPLAY_MA_URL for API checks.
 * Optional: FIPLAY_MA_IMAGE, FIPLAY_MA_CONTAINER, FIPLAY_MA_DATA_DIR, FIPLAY_NAS_DOCKER
 */
import { abort, env, envOr, fetchJson, gap, info, joinUrl, ok, remoteDocker, requireSsh, shq, skip, ssh, summary, waitFor } from './lib';

export function maCfg() {
  return {
    url: env('FIPLAY_MA_URL'),
    image: envOr('FIPLAY_MA_IMAGE', 'ghcr.io/music-assistant/server:beta'),
    container: envOr('FIPLAY_MA_CONTAINER', 'music-assistant'),
    dataDir: envOr('FIPLAY_MA_DATA_DIR', '/share/CACHEDEV1_DATA/music-assistant').replace(/\/+$/, ''),
    musicDir: env('FIPLAY_MA_MUSIC_DIR')?.replace(/\/+$/, ''),
  };
}

type ServerInfo = { server_version?: string; schema_version?: number; onboard_done?: boolean; base_url?: string };

/** Music Assistant's unauthenticated /info, or null when it does not answer. */
async function serverInfo(timeoutMs = 5000): Promise<ServerInfo | null> {
  const { url } = maCfg();
  if (!url) return null;
  return fetchJson<ServerInfo>(joinUrl(url, 'info'), timeoutMs);
}

type ContainerState = { status: string; image: string; running: boolean } | null;

async function containerState(): Promise<ContainerState> {
  const { container } = maCfg();
  const res = await ssh(remoteDocker(`"$D" ps -a --filter name=^${shq(container)}\\$ --format '{{.Status}}|{{.Image}}'`));
  if (res.code !== 0) abort(`docker ps failed on NAS: ${res.stderr || res.stdout}`);
  if (!res.stdout) return null;
  const [status, image] = res.stdout.split('|');
  return { status, image, running: status.startsWith('Up') };
}

async function imageDigest(): Promise<string> {
  const { image } = maCfg();
  const res = await ssh(remoteDocker(`"$D" image inspect --format '{{index .RepoDigests 0}}' ${shq(image)} 2>/dev/null || true`));
  return res.stdout.replace(/^.*@/, '');
}

/** Print container + API status. Returns true when everything is healthy. */
export async function reportStatus(): Promise<boolean> {
  const { container, url } = maCfg();
  const state = await containerState();
  if (!state) {
    gap('MISSING', `container ${container} does not exist on the NAS (bun run ma update)`);
    return false;
  }
  if (!state.running) {
    gap('DOWN', `container ${container}: ${state.status} (${state.image})`);
    return false;
  }
  const stats = await ssh(remoteDocker(`"$D" stats --no-stream --format '{{.CPUPerc}} cpu, {{.MemUsage}}' ${shq(container)}`));
  ok(`container ${container}: ${state.status} (${state.image}); ${stats.stdout || 'no stats'}`);

  if (!url) {
    skip('FIPLAY_MA_URL not set; skipping API check');
    return true;
  }
  const si = await serverInfo();
  if (!si) {
    gap('UNREACHABLE', `${joinUrl(url, 'info')} did not answer`);
    return false;
  }
  ok(`${url} -> Music Assistant ${si.server_version ?? '?'}${si.onboard_done === false ? ' (not set up yet: open it in a browser and create the first account)' : ''}`);
  return true;
}

async function cmdLogs(argv: string[]): Promise<void> {
  const { container } = maCfg();
  let tail = '50';
  let follow = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-n' && argv[i + 1]) tail = argv[++i];
    else if (argv[i] === '-f') follow = true;
    else abort(`unknown option ${argv[i]}`);
  }
  if (!/^\d+$/.test(tail)) abort(`-n expects a number, got ${tail}`);
  await ssh(remoteDocker(`"$D" logs --tail ${tail} ${follow ? '-f ' : ''}${shq(container)}`), { inherit: true, tty: follow });
}

/** Returns true when the pull changed the image digest. */
async function cmdPull(): Promise<boolean> {
  const { image } = maCfg();
  const before = await imageDigest();
  info(`pulling ${image}…`);
  const res = await ssh(remoteDocker(`"$D" pull -q ${shq(image)}`));
  if (res.code !== 0) abort(`docker pull failed: ${res.stderr || res.stdout}`);
  const after = await imageDigest();
  if (before === after) {
    ok(`image unchanged (${after.slice(0, 19)})`);
    return false;
  }
  ok(`image updated ${before ? before.slice(7, 19) : '(none)'} -> ${after.slice(7, 19)}`);
  return true;
}

async function afterStart(): Promise<void> {
  if (!maCfg().url) {
    skip('FIPLAY_MA_URL not set; not waiting for the API');
    return;
  }
  info('waiting for the API…');
  // The first start creates the database and loads every provider: give it time.
  if (!(await waitFor(async () => (await serverInfo()) !== null, { timeoutMs: 180_000, intervalMs: 3000 }))) {
    abort('Music Assistant did not answer within 3 minutes; check `bun run ma logs`');
  }
  await reportStatus();
}

async function cmdRestart(): Promise<void> {
  const { container } = maCfg();
  const res = await ssh(remoteDocker(`"$D" restart ${shq(container)}`));
  if (res.code !== 0) abort(`docker restart failed: ${res.stderr || res.stdout}`);
  ok(`restarted ${container}`);
  await afterStart();
}

async function cmdUpdate(force: boolean): Promise<void> {
  const { container, image, dataDir, musicDir } = maCfg();
  if (!musicDir) abort('FIPLAY_MA_MUSIC_DIR is not set in .env (the music library on the NAS, mounted read-only)');
  if (!dataDir.startsWith('/share/CACHEDEV')) {
    info(`WARN ${dataDir} is not on a disk volume path; /share itself is a tmpfs emptied at boot`);
  }
  const changed = await cmdPull();
  const exists = (await containerState()) !== null;
  if (exists && !changed && !force) {
    summary(`${container} already runs the latest ${image}; nothing to do (use --force to recreate)`);
    return;
  }
  info(`${exists ? 'recreating' : 'creating'} ${container}…`);
  const res = await ssh(
    remoteDocker(
      [
        `mkdir -p ${shq(dataDir)}`,
        `"$D" rm -f ${shq(container)} >/dev/null 2>&1 || true`,
        `"$D" run -d --name ${shq(container)} --network host --restart unless-stopped` +
          ` -v ${shq(`${dataDir}:/data`)} -v ${shq(`${musicDir}:/media:ro`)} -e LOG_LEVEL=info ${shq(image)}`,
      ].join(' && '),
    ),
  );
  if (res.code !== 0) abort(`docker run failed: ${res.stderr || res.stdout}`);
  ok(`${exists ? 'recreated' : 'created'} ${container} (${res.stdout.slice(0, 12)})`);
  await afterStart();
  summary(`${container} runs ${image}`);
}

function usage(): never {
  console.error('usage: bun run ma <status|logs [-n N] [-f]|pull|restart|update [--force]>');
  process.exit(1);
}

if (import.meta.main) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) usage();
  await requireSsh();
  switch (cmd) {
    case 'status':
      process.exit((await reportStatus()) ? 0 : 1);
    case 'logs':
      await cmdLogs(rest);
      break;
    case 'pull':
      await cmdPull();
      break;
    case 'restart':
      await cmdRestart();
      break;
    case 'update':
      await cmdUpdate(rest.includes('--force'));
      break;
    default:
      usage();
  }
}
