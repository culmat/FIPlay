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
