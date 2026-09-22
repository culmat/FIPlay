import { reactive } from 'vue'

/**
 * The two overlays that any view can open.
 *
 * They live outside the router-view so they survive navigation and are not
 * clipped by a page's stacking context. A module-level reactive object keeps
 * that to three lines; a Pinia store would be ceremony for two booleans.
 */
export const ui = reactive({
  outputOpen: false,
  aboutOpen: false,
})
