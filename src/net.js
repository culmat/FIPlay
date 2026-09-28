import { reactive } from 'vue'

/**
 * Whether the browser has a network at all.
 *
 * `navigator.onLine` is only trustworthy in one direction: false means airplane
 * mode or no interface, true means nothing more than "there is an interface".
 * That one direction is enough to stop pretending to play, and to say why.
 */
export const net = reactive({ online: navigator.onLine !== false })
window.addEventListener('online', () => { net.online = true })
window.addEventListener('offline', () => { net.online = false })

/**
 * An AbortSignal that fires after `ms`.
 *
 * AbortSignal.timeout is the one-liner, but it only arrived in 2022 and the
 * phones this app is installed on are not all that new. The controller form
 * works wherever fetch does.
 */
export function timeoutSignal (ms) {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms)
  const controller = new AbortController()
  setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms)
  return controller.signal
}
