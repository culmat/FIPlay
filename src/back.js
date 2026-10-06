import router from './router'
import { ui } from './ui'

/**
 * What the phone's back button does in the installed app.
 *
 * Firefox for Android gives a home-screen web app no way out when back runs
 * out of history: the window stays, empty, instead of closing, and the page
 * is never asked. So the app keeps one entry under its first page and never
 * lets back reach the bottom. That entry is the #base fragment on the launch
 * route, the way #art is on the station (immersive.js): real history, with
 * nothing rendered differently. Only back ever lands on it, and landing on it
 * puts the list straight back on top. Back on the list therefore stays on
 * the list, and back from a station the app opened by itself goes to the
 * list, as it does from a station that was tapped.
 *
 * Before any of that, a back press with a dialog open closes the dialog and
 * goes no further.
 *
 * Standalone mode only. In a tab the browser's back must still leave the site.
 */

export const BASE = '#base'

const installed = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

/** Is the list one entry down: the launch entry, or the guard under it? */
function listIsBeneath () {
  const back = history.state?.back
  if (typeof back !== 'string') return false
  return back.replace(/[?#].*$/, '') === '/' || back.endsWith(BASE)
}

/**
 * Back to the list from a station page.
 *
 * Going back when the list is beneath keeps the stack one page deep, so the
 * phone's back button does not then return to the station just left. A
 * station opened over another one (from the bar) has no list beneath, and the
 * list is pushed.
 */
export function leaveToList () {
  return listIsBeneath() ? router.back() : router.push('/')
}

export function bindBack () {
  // Where the browser was when the last navigation settled. During a push or
  // a replace it is still there while the guards run; after a pop it has
  // moved. A refused navigation settles nowhere: the entry it came from is
  // restored, and the position recorded for it still holds.
  let settledAt
  router.afterEach((to, from, failure) => {
    if (!failure) settledAt = history.state?.position
  })

  router.beforeEach(to => {
    const popped = settledAt !== undefined && history.state?.position !== settledAt
    if (!popped) return

    // A dialog is the topmost thing on the screen, so back closes it and only
    // it. Refusing the navigation puts the entry back.
    if (ui.outputOpen || ui.aboutOpen) {
      ui.outputOpen = false
      ui.aboutOpen = false
      return false
    }

    // The bottom of the stack: put the list back on top of it. A redirected
    // pop is pushed, not replaced, so the guard entry stays beneath.
    if (to.hash === BASE) {
      const query = { ...to.query }
      delete query.play
      return { path: '/', query, hash: '' }
    }
  })

  if (!installed()) return

  router.isReady().then(async () => {
    // A restored session has something beneath already; only a launch does not.
    if (history.state?.back != null) return
    const route = router.currentRoute.value
    const { path, query } = route
    const hash = route.hash === BASE ? '' : route.hash
    await router.replace({ path, query, hash: BASE })
    await router.push({ path, query, hash })
  })
}
