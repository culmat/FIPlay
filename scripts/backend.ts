/**
 * Manage the PyRaumfeld container on the NAS.
 *
 * Usage:
 *   bun run backend status              container state + zones from the API
 *   bun run backend logs [-n N] [-f]    tail (or follow) container logs
 *   bun run backend pull                pull the image, report digest change
 *   bun run backend restart             restart the container, wait for /zones
 *   bun run backend update [--force]    pull; if the digest changed (or --force)
 *                                       recreate the container and wait for /zones
 *
 * The container is recreated exactly as it runs today: host networking (UPnP
 * discovery needs it), restart unless-stopped, PORT from FIPLAY_BACKEND_PORT.
 *
 * Requires in .env: FIPLAY_NAS_HOST, FIPLAY_NAS_USER; FIPLAY_BACKEND_URL for API checks.
 * Optional: FIPLAY_BACKEND_PORT, FIPLAY_BACKEND_IMAGE, FIPLAY_BACKEND_CONTAINER, FIPLAY_NAS_DOCKER
 */
import { abort, backendCfg, backendZones, gap, info, ok, remoteDocker, requireSsh, shq, skip, ssh, summary, waitFor } from './lib';

export type ContainerState = { status: string; image: string; running: boolean } | null;

/** `docker ps -a` for the backend container; null when it does not exist. */
export async function containerState(): Promise<ContainerState> {
  const { container } = backendCfg();
  const res = await ssh(remoteDocker(`"$D" ps -a --filter name=^${shq(container)}\\$ --format '{{.Status}}|{{.Image}}'`));
  if (res.code !== 0) abort(`docker ps failed on NAS: ${res.stderr || res.stdout}`);
  if (!res.stdout) return null;
  const [status, image] = res.stdout.split('|');
  return { status, image, running: status.startsWith('Up') };
}

/** RepoDigest of the local image on the NAS, or '' when not pulled yet. */
async function imageDigest(): Promise<string> {
  const { image } = backendCfg();
  const res = await ssh(remoteDocker(`"$D" image inspect --format '{{index .RepoDigests 0}}' ${shq(image)} 2>/dev/null || true`));
  return res.stdout.replace(/^.*@/, '');
}

async function waitForZones(timeoutMs: number): Promise<boolean> {
  return waitFor(async () => (await backendZones(10_000)) !== null, { timeoutMs, intervalMs: 2000 });
}

/** Print container + API status. Returns true when everything is healthy. */
export async function reportStatus(): Promise<boolean> {
  const { container, url } = backendCfg();
  let healthy = true;

  const state = await containerState();
  if (!state) {
    gap('MISSING', `container ${container} does not exist on the NAS`);
    healthy = false;
  } else if (!state.running) {
    gap('DOWN', `container ${container}: ${state.status} (${state.image})`);
    healthy = false;
  } else {
    ok(`container ${container}: ${state.status} (${state.image})`);
  }

  if (!url) {
    skip('FIPLAY_BACKEND_URL not set; skipping API check');
    return healthy;
  }
  const zones = await backendZones();
  if (zones === null) {
    gap('UNREACHABLE', `${url}zones did not answer`);
    return false;
  }
  ok(`${url}zones -> ${zones.length} zone(s)${zones.length ? `: ${zones.map((z) => z.name).join(', ')}` : ''}`);
  return healthy;
}

async function cmdLogs(argv: string[]): Promise<void> {
  const { container } = backendCfg();
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

/** True when the image name refers to a registry rather than a local build. */
function isRegistryImage(image: string): boolean {
  const [first] = image.split('/');
  return image.includes('/') && (first.includes('.') || first.includes(':') || first === 'localhost');
}

/** Returns true when the pull changed the image digest. */
async function cmdPull(): Promise<boolean> {
  const { image } = backendCfg();
  if (!isRegistryImage(image)) {
    skip(`${image} is a local image; nothing to pull`);
    return false;
  }
  const before = await imageDigest();
  info(`pulling ${image}…`);
  const res = await ssh(remoteDocker(`"$D" pull ${shq(image)}`), { inherit: true });
  if (res.code !== 0) abort(`docker pull failed (exit ${res.code})`);
  const after = await imageDigest();
  if (before === after) {
    ok(`image unchanged (${after.slice(0, 19)})`);
    return false;
  }
  ok(`image updated ${before ? before.slice(7, 19) : '(none)'} -> ${after.slice(7, 19)}`);
  return true;
}

async function cmdRestart(): Promise<void> {
  const { container } = backendCfg();
  const res = await ssh(remoteDocker(`"$D" restart ${shq(container)}`));
  if (res.code !== 0) abort(`docker restart failed: ${res.stderr || res.stdout}`);
  ok(`restarted ${container}`);
  await afterStart();
}

async function afterStart(): Promise<void> {
  if (!backendCfg().url) {
    skip('FIPLAY_BACKEND_URL not set; not waiting for the API');
    return;
  }
  info('waiting for /zones…');
  if (!(await waitForZones(60_000))) abort('backend did not answer on /zones within 60s; check `bun run backend logs`');
  await reportStatus();
}

async function cmdUpdate(force: boolean): Promise<void> {
  const { container, image, port } = backendCfg();
  const changed = await cmdPull();
  if (!changed && !force) {
    summary(
      isRegistryImage(image)
        ? `${container} already runs the latest ${image}; nothing to do (use --force to recreate)`
        : `${container} runs the local image ${image}; use --force to recreate it`,
    );
    return;
  }
  info(`recreating ${container}…`);
  const res = await ssh(
    remoteDocker(
      [
        `"$D" rm -f ${shq(container)} >/dev/null 2>&1 || true`,
        `"$D" run -d --name ${shq(container)} --network host --restart unless-stopped -e PORT=${shq(port)} ${shq(image)}`,
      ].join(' && '),
    ),
  );
  if (res.code !== 0) abort(`docker run failed: ${res.stderr || res.stdout}`);
  ok(`recreated ${container} (${res.stdout.slice(0, 12)})`);
  await afterStart();
  summary(`${container} updated to ${image}`);
}

function usage(): never {
  console.error('usage: bun run backend <status|logs [-n N] [-f]|pull|restart|update [--force]>');
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
