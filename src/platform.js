/**
 * iOS refuses to let a page set the volume of an <audio> element: the hardware
 * buttons own it. Showing a slider that does nothing is worse than showing no
 * slider, so the views ask this before rendering one for the browser player.
 *
 * iPadOS Safari reports a desktop user agent, hence the touch-point check.
 */
export const isIOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
