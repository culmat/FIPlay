import { reactive } from 'vue'

import { timeoutSignal } from './net'

export const PUBLIC_METADATA_URL = 'https://fip-metadata.fly.dev'

const STORAGE_KEY = 'fiplay:home'
const PROBE_MS = 5000
const RECHECK_MS = 60000
const SUSPECT_MS = 10000

/**
 * Am I at home?
 *
 * The NAS deployment talks to two services that only exist on the home
 * network: the speaker backend and its own copy of the metadata service, both
 * proxied onto the app's own origin. Away from home that origin resolves to an
 * address that never answers, and every request to it waits for the browser's
 * connect timeout, most of a minute on a phone. Nothing in a browser says
 * "WLAN is off" reliably, so the one dependable test is to ask the home server
 * itself, with a short timeout, and to remember the answer between launches
 * so the next launch away does not wait even that long.
 *
 * `mode` is 'home' or 'away'. Builds without home services (GitHub Pages, a
 * plain dev server) leave it at 'home' and never probe.
 */

/**
 * The address to probe, or null when this build has no home services.
 *
 * The build's own metadata service comes first, else the speaker backend from
 * the query string (where the installed app's start_url puts it). On the app's
 * own origin the target is version.json: the deploy writes it, the service
 * worker neither precaches it nor answers for it, so it always reaches the
 * network. On another origin the root will do; any answer counts.
 */
function probeTarget () {
  const own = (import.meta.env.VITE_METADATA_URL || '').replace(/\/+$/, '')
  const backend = new URLSearchParams(location.search).get('backend')
  const ref = (own && own !== PUBLIC_METADATA_URL) ? own : backend
  if (!ref) return null
  let url
  try {
    url = new URL(ref, location.origin)
  } catch {
    return null
  }
  if (url.origin === location.origin) {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
    return new URL(`${base}version.json`, location.origin).toString()
  }
  return `${url.origin}/`
}

function remembered () {
  try {
    const mode = localStorage.getItem(STORAGE_KEY)
    return mode === 'away' || mode === 'home' ? mode : null
  } catch {
    return null
  }
}

function remember (mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Storage unavailable (private mode): the mode still holds for this launch.
  }
}

const target = probeTarget()

export const home = reactive({
  enabled: !!target,
  mode: (target && remembered()) || 'home',
  checkedAt: 0,
})

function set (mode) {
  home.checkedAt = Date.now()
  if (home.mode === mode) return
  home.mode = mode
  remember(mode)
  console.info(`home network: ${mode === 'home' ? 'reachable' : 'out of reach'}`)
}

let inflight = null

/** Ask the home server, once at a time; resolves to the mode. */
export function probe () {
  if (!target) return Promise.resolve(home.mode)
  if (inflight) return inflight
  inflight = (async () => {
    if (navigator.onLine === false) {
      set('away')
      return home.mode
    }
    try {
      // no-cors: a pure reachability test. A 404, or an answer without CORS
      // headers, still means the box is there.
      await fetch(target, { mode: 'no-cors', cache: 'no-store', signal: timeoutSignal(PROBE_MS) })
      set('home')
    } catch {
      set('away')
    }
    return home.mode
  })().finally(() => { inflight = null })
  return inflight
}

/** A home request just failed at network level: check, unless we just did. */
export function suspect () {
  if (!target || Date.now() - home.checkedAt < SUSPECT_MS) return
  probe()
}

/**
 * Keep the mode current: on launch, when the app returns to the foreground,
 * when the network comes or goes, and every minute while away and visible so
 * walking in the door is noticed without a relaunch.
 */
export function start () {
  if (!target) return
  console.debug(`home network: probing ${target} (remembered: ${remembered() || 'nothing'})`)
  probe()
  document.addEventListener('visibilitychange', () => { if (!document.hidden) probe() })
  window.addEventListener('online', () => probe())
  window.addEventListener('offline', () => set('away'))
  setInterval(() => { if (home.mode === 'away' && !document.hidden) probe() }, RECHECK_MS)
}
