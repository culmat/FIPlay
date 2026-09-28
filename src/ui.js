import { reactive } from 'vue'

/**
 * State any view can set and no view owns.
 *
 * The overlays live outside the router-view so they survive navigation and are
 * not clipped by a page's stacking context. A module-level reactive object
 * keeps that to a few lines; a Pinia store would be ceremony for a handful of
 * booleans.
 */
export const ui = reactive({
  outputOpen: false,
  aboutOpen: false,
  // A newer version of the app is downloaded and waiting to take over.
  updateReady: false,
  updateDismissed: false,
  // The station page shows nothing but the artwork. Not kept on that page:
  // main.js rebuilds it with a router.replace whenever the speakers move to
  // another station, and the mode has to outlive that.
  immersive: false,
})
