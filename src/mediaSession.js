import { watchEffect } from 'vue'

/**
 * Publish what the browser player is playing to the operating system.
 *
 * This is what puts the cover art on a phone's lock screen and makes the
 * headphone and notification buttons work. It applies to the browser player
 * only: when a speaker is selected, this tab is not producing sound and
 * claiming the OS controls would hand them to an <audio> element that is
 * silent.
 */
export function bindMediaSession (uiStore, stationStore, browserPlayerName) {
  if (!('mediaSession' in navigator)) return

  const ms = navigator.mediaSession

  ms.setActionHandler('play', () => uiStore.setPlaying(true))
  ms.setActionHandler('pause', () => uiStore.setPlaying(false))

  watchEffect(() => {
    const player = uiStore.players.find(p => p.title === browserPlayerName)
    const mine = player?.enabled && player.stationName

    if (!mine) {
      ms.metadata = null
      ms.playbackState = 'none'
      return
    }

    const station = stationStore.stations[player.stationName]
    const now = station?.now
    const art = now?.visuals?.card?.src

    ms.metadata = new window.MediaMetadata({
      title: now?.firstLine?.title || station?.stationLabel || 'FIP',
      artist: now?.secondLine?.title || '',
      album: station?.stationLabel || 'FIP',
      artwork: art
        ? [
          { src: `${art}/200x200`, sizes: '200x200', type: 'image/webp' },
          { src: `${art}/400x400`, sizes: '400x400', type: 'image/webp' },
          { src: `${art}/600x600`, sizes: '600x600', type: 'image/webp' },
        ]
        : [],
    })
    ms.playbackState = player.playing ? 'playing' : 'paused'
  })
}
