import { nextTick, ref, watch } from 'vue'
import { ui } from './ui'

/**
 * The station page with nothing but the artwork on it.
 *
 * The flag is ui.immersive, so the page can be rebuilt underneath it. What
 * lives here is everything the mode asks of the browser: the change between
 * the two layouts, fullscreen, and keeping the screen on.
 */

const canFullscreen = () =>
  !!document.documentElement.requestFullscreen && document.fullscreenEnabled

/**
 * Show only the artwork, or the whole page again.
 *
 * Where the browser can go fullscreen, the window growing to the screen is the
 * transition and the layout simply flips underneath it. Elsewhere (an iPhone,
 * a browser that refused) the art morphs between its two places, unless the
 * person asked for less motion. Never both: a morph measured against the old
 * viewport would jump when fullscreen changed the viewport under it.
 */
export function setImmersive (on) {
  if (on === ui.immersive) return

  if (on && canFullscreen()) {
    ui.immersive = true
    // Has to be called within the tap that asked for it, so it is not awaited.
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .catch(error => console.debug('Fullscreen refused:', error.message))
    return
  }

  if (!on && document.fullscreenElement) {
    // Leaving fullscreen is left to the watcher in bindImmersive, which covers
    // every other way out of the mode as well.
    ui.immersive = false
    return
  }

  const apply = async () => {
    ui.immersive = on
    await nextTick()
  }
  // The reduced-motion rule in main.css does not reach the transition's
  // pseudo-elements, so the preference has to be honoured here.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (document.startViewTransition && !reduced) document.startViewTransition(apply)
  else apply()
}

/** Tie the mode to fullscreen, and the screen to the music. */
export function bindImmersive (uiStore) {
  // Esc, the browser's own button, the OS: leaving fullscreen leaves the mode.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && ui.immersive) ui.immersive = false
  })

  // And leaving the mode any other way (back to the list, say) leaves fullscreen.
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
