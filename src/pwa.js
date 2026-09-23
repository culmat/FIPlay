import { ui } from '@/ui'

/**
 * Keep the installed app current without ever interrupting music.
 *
 * A service worker downloads a new version in the background and then waits
 * until every window of the app is closed. On a phone that means launching
 * twice after a deploy, which nobody does. So: when a new version is waiting
 * and nothing is playing in this browser, apply it at once (the page reloads,
 * a moment after launch). When something is playing here, offer a Restart
 * instead and leave the choice to the person. Speakers are unaffected either
 * way; they play on their own.
 *
 * The check for a new version runs on launch, when the app comes back to the
 * foreground, and hourly while it stays open.
 */
let updateSW = null

export function registerServiceWorker ({ canRestartNow }) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return

  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      updateSW = registerSW({
        immediate: true,
        onNeedRefresh () {
          if (canRestartNow()) {
            applyUpdate()
          } else {
            ui.updateReady = true
          }
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

/** Let the waiting version take over and reload into it. */
export function applyUpdate () {
  ui.updateReady = false
  if (updateSW) updateSW(true)
  else location.reload()
}
