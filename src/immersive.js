import { nextTick, ref, watch } from 'vue'
import router from './router'
import { ui } from './ui'

/**
 * The station page with nothing but the artwork on it.
 *
 * The mode is the #art fragment of the station's URL, so it can be linked to,
 * survives a reload, and is one step of history: the back gesture leaves the
 * artwork before it leaves the station. ui.immersive mirrors the route for
 * the components. What lives here is everything the mode asks of the
 * browser: the change between the two layouts, fullscreen, and keeping the
 * screen on.
 */

export const ART = '#art'

const canFullscreen = () =>
  !!document.documentElement.requestFullscreen && document.fullscreenEnabled

/** Resolves once the next navigation has settled, or soon enough if none comes. */
function afterNavigation () {
  return new Promise(resolve => {
    const done = () => { off(); clearTimeout(timer); resolve() }
    const off = router.afterEach(done)
    const timer = setTimeout(done, 1000)
  })
}

// The query is passed along on purpose: a location given as only a hash
// resolves without one, and the speakers arrive through ?backend=.
function enter () {
  const here = router.currentRoute.value
  return router.push({ hash: ART, query: here.query })
}

/**
 * Leave the artwork the way it was entered.
 *
 * Entering pushed an entry, so going back is the natural way out and keeps
 * history tidy. A link or a reload straight into the artwork has nothing of
 * ours behind it, and the mode is then dropped from the entry instead of
 * leaving the page.
 */
function leave () {
  const here = router.currentRoute.value
  const pushedFrom = here.fullPath.replace(/#.*$/, '')
  if (history.state?.back === pushedFrom) {
    const settled = afterNavigation()
    router.back()
    return settled
  }
  return router.replace({ hash: '', query: here.query })
}

/**
 * Show only the artwork, or the whole page again.
 *
 * Where the browser can go fullscreen, the window growing to the screen is the
 * transition and the layout simply flips underneath it. Elsewhere (an iPhone,
 * a browser that refused) the art morphs between its two places, unless the
 * person asked for less motion. Never both: a morph measured against the old
 * viewport would jump when fullscreen changed the viewport under it.
 */
let busy = false

export function setImmersive (on) {
  // One change at a time. Esc in fullscreen arrives twice, as the key and as
  // the browser leaving fullscreen, and a second back would leave the station.
  if (on === ui.immersive || busy) return
  busy = true
  const release = () => { busy = false }

  if (on && canFullscreen()) {
    // Within the tap that asked for it, before anything is awaited.
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .catch(error => console.debug('Fullscreen refused:', error.message))
    enter().finally(release)
    return
  }

  if (!on && document.fullscreenElement) {
    // Leaving fullscreen is left to the watcher in bindImmersive, which covers
    // every other way out of the mode as well.
    leave().finally(release)
    return
  }

  const apply = async () => {
    await (on ? enter() : leave())
    await nextTick()
  }
  // The reduced-motion rule in main.css does not reach the transition's
  // pseudo-elements, so the preference has to be honoured here.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const change = document.startViewTransition && !reduced
    ? document.startViewTransition(apply).finished
    : apply()
  change.catch(() => { /* a skipped transition still lands on the right layout */ }).finally(release)
}

/** Mirror the route, tie the mode to fullscreen, and the screen to the music. */
export function bindImmersive (uiStore) {
  // Before the components see the route change, so the page never renders a
  // frame of the wrong layout.
  watch(() => router.currentRoute.value.hash === ART, on => { ui.immersive = on }, { immediate: true })

  // Esc, the browser's own button, the OS: leaving fullscreen leaves the mode.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && ui.immersive) setImmersive(false)
  })

  // And leaving the mode any other way (the back gesture, say) leaves fullscreen.
  watch(() => ui.immersive, on => {
    if (!on && document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* already on the way out */ })
    }
  })

  // A screen showing nothing but the artwork is there to be looked at, so it
  // stays on while there is music. The API exists on secure origins only; the
  // phone's own rules apply elsewhere. The system drops the lock when the tab
  // is hidden, hence the visibility term and the release listener.
  const visible = ref(!document.hidden)
  document.addEventListener('visibilitychange', () => { visible.value = !document.hidden })

  let lock = null
  // One request or release at a time, in the order they were asked for, or a
  // quick in-and-out could leave a second lock behind.
  let queue = Promise.resolve()

  watch(() => ui.immersive && uiStore.anyPlaying && visible.value, want => {
    if (!navigator.wakeLock) return
    queue = queue.then(async () => {
      if (want && !lock) {
        const next = await navigator.wakeLock.request('screen')
        next.addEventListener('release', () => { if (lock === next) lock = null })
        lock = next
      } else if (!want && lock) {
        await lock.release()
      }
    }).catch(error => console.debug('Screen wake lock:', error.message))
  }, { immediate: true })
}
