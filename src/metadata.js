import { reactive, watch } from 'vue'

import { PUBLIC_METADATA_URL, home, suspect } from './home'
import { timeoutSignal } from './net'

/**
 * Where the now-playing metadata comes from.
 *
 * The public service is the default, so the GitHub Pages build keeps working.
 * A deployment that runs its own copy sets VITE_METADATA_URL at build time and
 * gets it first, with the public one behind it: away from home the NAS copy
 * is out of reach, and the station list must not wait for the browser to give
 * up on it.
 */
const bases = [...new Set(
  [import.meta.env.VITE_METADATA_URL, PUBLIC_METADATA_URL]
    .filter(Boolean)
    .map(url => url.replace(/\/+$/, ''))
)]
const last = bases.length - 1
export const hasFallback = bases.length > 1

/** How long to give a service that has another behind it. */
const TIMEOUT_MS = 5000

/** Answers that mean the proxy or the box answered, not the service. */
const GATEWAY = new Set([404, 502, 503, 504])

// Which base is in use. Away from home, start on the public one and skip the
// wait; back home, return to the own copy. A one-off timeout at home is undone
// the next time the app comes to the foreground.
const state = reactive({ index: hasFallback && home.mode === 'away' ? last : 0 })

watch(() => home.mode, mode => { state.index = mode === 'home' ? 0 : last })
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && home.mode === 'home') state.index = 0
})

export function metadataSource () {
  return { url: bases[state.index], fallback: state.index > 0, hasFallback }
}

/** The service or the proxy did not answer, as opposed to answering "no". */
class Unreachable extends Error {}

async function ask (url, timed) {
  let response
  try {
    response = await fetch(url, timed ? { signal: timeoutSignal(TIMEOUT_MS) } : {})
  } catch (error) {
    throw new Unreachable(`${error.name}: ${error.message}`)
  }
  if (GATEWAY.has(response.status)) throw new Unreachable(`HTTP ${response.status}`)
  // Anything else is the service's word on this station, e.g. the 500 for one
  // it does not know; that must not move everyone to the fallback.
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  try {
    return await response.json()
  } catch (error) {
    throw new Unreachable(`not JSON: ${error.message}`)
  }
}

/**
 * The metadata for one station, from the first service that answers.
 *
 * Twelve watchers ask at once, so the switch to the next base happens only if
 * nobody else made it yet, and a failure at network level also asks home.js
 * to check whether the home network is gone altogether.
 */
export async function fetchMetadata (stationName) {
  for (let i = state.index; i < bases.length; i++) {
    try {
      return await ask(`${bases[i]}/api/metadata/${stationName}`, i < last)
    } catch (error) {
      if (i === last || !(error instanceof Unreachable)) throw error
      if (state.index === i) {
        state.index = i + 1
        console.warn(`${bases[i]} did not answer (${error.message}); track info now from ${bases[i + 1]}`)
      }
      suspect()
    }
  }
}
