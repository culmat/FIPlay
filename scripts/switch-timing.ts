/**
 * Time how long a Raumfeld room takes to switch FIP stations, started the way FIPlay
 * starts them (PyRaumfeld) or through Music Assistant.
 *
 * Usage:
 *   bun scripts/switch-timing.ts direct|ma [--room Living] [--rounds 6]
 *                                [--stations "FIP Jazz,FIP Rock"] [--dwell 12] [--logs]
 *
 * Each round switches to the next station and polls GetTransportInfo on the room's zone
 * renderer and every device renderer every 250 ms, until all of them are PLAYING again
 * after the zone took the new stream. A PLAYING renderer is not yet sound: confirm by ear.
 * --logs prints Music Assistant's log lines from the run (stream details, buffer ready,
 * first chunk); most of them are only there at debug level.
 *
 * Requires in .env: FIPLAY_RAUMFELD_HOST (the host's web service, e.g. http://<host>:47365);
 * FIPLAY_BACKEND_URL for direct; FIPLAY_MA_URL for ma. The Music Assistant token is
 * read from FIPLAY_MA_TOKEN in the environment only, never from a file in the repo.
 */
import { abort, backendCfg, backendZones, info, joinUrl, ok, remoteDocker, requireEnv, shq, sleep, ssh, summary } from './lib';
import { maCfg } from './ma';

const POLL_MS = 250;
const SWITCH_TIMEOUT_MS = 45_000;

type Renderer = { label: string; service: string; control: string };

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// ---------------------------------------------------------------------------
// UPnP
// ---------------------------------------------------------------------------
async function text(url: string, init: RequestInit = {}, timeoutMs = 6000): Promise<string> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  return res.text();
}

/** The room's zone renderer and the renderers of its devices, from the host's /listDevices. */
async function renderers(host: string, room: string): Promise<Renderer[]> {
  const list = await text(joinUrl(host, 'listDevices'), {}, 10_000);
  const found: Renderer[] = [];
  for (const [, type, location, name] of list.matchAll(/<device udn='[^']+' type='([^']+)' location='([^']+)'>([^<]*)<\/device>/g)) {
    if (!type.includes('MediaRenderer')) continue;
    const desc = await text(location);
    const base = location.match(/^https?:\/\/[^/]+/)![0];
    const services = [...desc.matchAll(/<serviceType>([^<]+)<\/serviceType>.*?<controlURL>([^<]+)<\/controlURL>/gs)];
    const av = services.find(([, t]) => t.includes('AVTransport'));
    if (!av) continue;
    const model = desc.match(/<modelName>([^<]*)/)?.[1] ?? name;
    const isZone = name === room;
    found.push({
      label: isZone ? 'ZONE' : model.replace(/^(Teufel|Raumfeld) /, ''),
      service: av[1],
      control: base + (av[2].startsWith('/') ? av[2] : `/${av[2]}`),
    });
  }
  if (!found.some((r) => r.label === 'ZONE')) abort(`no zone renderer named "${room}" in the host's /listDevices`);
  return found.sort((a, b) => Number(a.label === 'ZONE') - Number(b.label === 'ZONE') || a.label.localeCompare(b.label));
}

async function soap(r: Renderer, action: string, field: string): Promise<string> {
  const body =
    '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' +
    `<s:Body><u:${action} xmlns:u="${r.service}"><InstanceID>0</InstanceID></u:${action}></s:Body></s:Envelope>`;
  try {
    const xml = await text(r.control, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/xml; charset="utf-8"', SOAPACTION: `"${r.service}#${action}"` },
    }, 3000);
    return xml.match(new RegExp(`<${field}>([^<]*)`))?.[1] ?? '?';
  } catch {
    return 'ERR';
  }
}

// ---------------------------------------------------------------------------
// The two ways of switching
// ---------------------------------------------------------------------------
type Switcher = { name: string; to(station: string): Promise<void>; close(): void };

const slug = (station: string) => station.toLowerCase().replaceAll(' ', '');

async function directSwitcher(room: string): Promise<Switcher> {
  const { url } = backendCfg();
  const zone = (await backendZones())?.find((z) => z.name.includes(room));
  if (!url || !zone) abort(`PyRaumfeld has no zone with "${room}" in its name`);
  return {
    name: 'direct',
    async to(station) {
      // As FIPlay's BackendPlayer.playURL does: the stream with its title, then play.
      const stream = `https://icecast.radiofrance.fr/${slug(station)}-hifi.aac`;
      const query = new URLSearchParams({ title: station }).toString();
      for (const path of [`zone/${zone.udn}/play/${stream}?${query}`, `zone/${zone.udn}/play`]) {
        const res = await fetch(joinUrl(url, path), { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) abort(`PyRaumfeld answered ${res.status}`);
      }
    },
    close() {},
  };
}

class MaSocket {
  private ws: WebSocket;
  private next = 0;
  private pending = new Map<string, (m: any) => void>();
  ready: Promise<void>;

  constructor(url: string, token: string) {
    this.ws = new WebSocket(url.replace(/^http/, 'ws').replace(/\/*$/, '/ws'));
    this.ready = new Promise((resolve, reject) => {
      this.ws.onerror = () => reject(new Error('websocket error'));
      this.ws.onmessage = (ev) => {
        const m = JSON.parse(String(ev.data));
        if (m.server_id && !m.message_id) {
          this.call('auth', { token }).then(() => resolve(), reject);
        } else if (m.message_id && this.pending.has(m.message_id)) {
          this.pending.get(m.message_id)!(m);
          this.pending.delete(m.message_id);
        }
      };
    });
  }

  call(command: string, args: object = {}): Promise<any> {
    const id = String(++this.next);
    return new Promise((resolve, reject) => {
      this.pending.set(id, (m) => (m.error_code ? reject(new Error(`${command}: ${m.details}`)) : resolve(m.result)));
      this.ws.send(JSON.stringify({ message_id: id, command, args }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function maSwitcher(room: string, stations: string[]): Promise<Switcher> {
  const { url } = maCfg();
  const token = process.env.FIPLAY_MA_TOKEN;
  if (!url) abort('FIPLAY_MA_URL is not set in .env');
  if (!token) abort('FIPLAY_MA_TOKEN is not set: create a long-lived token in Music Assistant (profile) and export it for this shell');
  const ma = new MaSocket(url, token);
  await ma.ready;
  const players: any[] = await ma.call('players/all');
  const player = players.find((p) => p.provider?.startsWith('raumfeld') && p.name === room) ?? players.find((p) => p.name === room);
  if (!player) abort(`Music Assistant has no player named "${room}"`);
  const uris = new Map<string, string>();
  for (const station of stations) {
    const items: any[] = await ma.call('music/radios/library_items', { search: station, limit: 10 });
    // A station not in the library is played straight from the FIP provider.
    const item = items.find((i) => i.name.toLowerCase() === station.toLowerCase());
    uris.set(station, item?.uri ?? `fip://radio/${station.toLowerCase().replaceAll(' ', '_')}`);
  }
  info(`Music Assistant player ${player.player_id}; ${[...uris].map(([s, u]) => `${s} = ${u}`).join(', ')}`);
  return {
    name: 'ma',
    async to(station) {
      await ma.call('player_queues/play_media', { queue_id: player.player_id, media: [uris.get(station)], option: 'replace' });
    },
    close: () => ma.close(),
  };
}

// ---------------------------------------------------------------------------
// One switch
// ---------------------------------------------------------------------------
type Result = { station: string; ackMs: number; uriMs: number | null; firstOutMs: number | null; allPlayingMs: number | null; timeline: string[] };

async function timeSwitch(sw: Switcher, station: string, rs: Renderer[]): Promise<Result> {
  const zone = rs.find((r) => r.label === 'ZONE')!;
  const uriBefore = await soap(zone, 'GetMediaInfo', 'CurrentURI');
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  let ackMs = -1;
  const ack = sw.to(station).then(() => (ackMs = ms()));
  const result: Result = { station, ackMs: 0, uriMs: null, firstOutMs: null, allPlayingMs: null, timeline: [] };
  let last = '';
  while (ms() < SWITCH_TIMEOUT_MS) {
    const t = ms();
    const [uri, ...states] = await Promise.all([soap(zone, 'GetMediaInfo', 'CurrentURI'), ...rs.map((r) => soap(r, 'GetTransportInfo', 'CurrentTransportState'))]);
    const line = rs.map((r, i) => `${r.label}=${states[i]}`).join(' ');
    if (line !== last) result.timeline.push(`${String(t).padStart(6)} ms  ${line}`);
    last = line;
    if (result.uriMs === null && uri !== uriBefore && uri !== '?' && uri !== 'ERR') result.uriMs = t;
    const allPlaying = states.every((s) => s === 'PLAYING');
    if (!allPlaying && result.firstOutMs === null) result.firstOutMs = t;
    if (allPlaying && result.uriMs !== null && ackMs >= 0) {
      result.allPlayingMs = t;
      break;
    }
    await sleep(Math.max(0, POLL_MS - (ms() - t)));
  }
  await ack;
  result.ackMs = ackMs;
  return result;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const fmt = (n: number | null) => (n === null ? '   -  ' : `${(n / 1000).toFixed(1).padStart(5)} s`);

if (import.meta.main) {
  const mode = process.argv[2];
  if (mode !== 'direct' && mode !== 'ma') abort('usage: bun scripts/switch-timing.ts direct|ma [--room Living] [--rounds 6] [--stations "FIP Jazz,FIP Rock"] [--dwell 12] [--logs]');
  const { FIPLAY_RAUMFELD_HOST: host } = requireEnv('FIPLAY_RAUMFELD_HOST');
  const room = arg('room', 'Living');
  const rounds = Number(arg('rounds', '6'));
  const dwellMs = Number(arg('dwell', '12')) * 1000;
  const stations = arg('stations', 'FIP Jazz,FIP Rock').split(',').map((s) => s.trim());

  const rs = await renderers(host, room);
  ok(`renderers: ${rs.map((r) => r.label).join(', ')}`);
  const sw = mode === 'direct' ? await directSwitcher(room) : await maSwitcher(room, stations);
  const since = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  const results: Result[] = [];
  for (let i = 0; i < rounds; i++) {
    const r = await timeSwitch(sw, stations[i % stations.length], rs);
    results.push(r);
    console.log(`\n${sw.name} #${i + 1} -> ${r.station}: command answered ${fmt(r.ackMs)}, zone took the stream ${fmt(r.uriMs)}, first not playing ${fmt(r.firstOutMs)}, all playing ${fmt(r.allPlayingMs)}`);
    for (const l of r.timeline) console.log(`  ${l}`);
    await sleep(dwellMs);
  }
  sw.close();

  // The first round may start from a stopped room; leave it out of the medians when there are enough.
  const counted = results.length > 2 ? results.slice(1) : results;
  const done = counted.filter((r) => r.allPlayingMs !== null);
  summary(
    `${sw.name}: median of ${done.length}/${counted.length} switches: command ${fmt(median(done.map((r) => r.ackMs)))}, ` +
      `stream taken ${fmt(median(done.map((r) => r.uriMs!)))}, all playing ${fmt(median(done.map((r) => r.allPlayingMs!)))}`,
  );

  if (process.argv.includes('--logs') && mode === 'ma') {
    const { container } = maCfg();
    const pattern = 'streamdetails|became ready|First chunk|/single/|Starting playback|raumfeld';
    const res = await ssh(remoteDocker(`"$D" logs --since ${since} ${shq(container)} 2>&1 | grep -i -E ${shq(pattern)} | tail -80`));
    console.log(`\nMusic Assistant log since ${since}:\n${res.stdout}`);
  }
}
