import { ui } from '@/ui'

/**
 * Keep the installed app current without ever interrupting music.
 *
 * The service worker is built to take over the moment a new version has
 * downloaded (skipWaiting + clientsClaim in vite.config.mjs), because waiting
 * for "all windows closed" never resolves on a phone. From that moment the
 * server, and the worker's cache, serve the new version; the page that is open
 * still runs the old code until it reloads. That reload is the one decision
 * left to make: at once when nothing is playing in this browser (a moment
 * after launch, typically), or offered as a Restart when something is, since a
 * reload would cut the local player off. Speakers play on regardless.
 *
 * Checks for a new version run on launch, when the app returns to the
 * foreground, and hourly while it stays open.
 */
export function registerServiceWorker ({ canRestartNow }) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return

  // A page that already had a worker and gets a different one is being
  // updated. The first time a worker claims a fresh page is not an update.
  let hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    if (canRestartNow()) applyUpdate()
    else ui.updateReady = true
  })

  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        // Only reached if a worker ever waits (it should not); same policy.
        onNeedRefresh () {
          if (canRestartNow()) applyUpdate()
          else ui.updateReady = true
        },
        onRegisteredSW (_url, registration) {
          if (!registration) return
          const check = () => registration.update().catch(() => {})
          setInterval(check, 60 * 60 * 1000)
          document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
        },
        onRegisterError (error) {
          console.debug('Service worker not registered:', error)
        },
      })
    })
    .catch(error => console.debug('Service worker not registered:', error))
}

/** Reload into the version the worker is already serving. */
export function applyUpdate () {
  ui.updateReady = false
  location.reload()
}
