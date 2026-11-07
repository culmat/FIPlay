/**
 * What a Raumfeld zone playing a FIP station shows for it in the Raumfeld app.
 *
 * FIP's streams carry no metadata, and the zone keeps the description a stream was
 * started with. So FIPlay describes the song when it starts a station, and replaces
 * the description whenever the song changes, through PyRaumfeld's bend route (the
 * zone's BendAVTransportURI), which leaves the stream playing. Music Assistant does the
 * same for the streams it serves.
 *
 * The description's item id names the station and the song's start time:
 * `fiplay:<station>:<start>`. The zone keeps the id as given, so every open copy of
 * FIPlay can tell what the zone already shows. Each copy only ever moves the zone on to
 * a later song, so two copies whose displays change a few seconds apart cannot swing
 * it back and forth.
 */

const ID_PREFIX = 'fiplay'

// Radio France serves a cover at the size its address ends with; the bare address is a
// 404. The size is the one Music Assistant gives the zone.
const COVER_SIZE = '1000x1000'

/** A track with a start time and a title is a song; anything else is a programme placeholder. */
const isSong = track => !!(track?.startTime && track.firstLine?.title)

/**
 * The details for PyRaumfeld's play and bend routes: the song when one is on, else the
 * station alone.
 *
 * @param stationName the station's key, e.g. `fip_jazz`
 * @param stationTitle its name for people, e.g. "FIP Jazz", which also serves as album
 * @param song what FIPlay shows as playing on it now, in the metadata service's shape
 * @param stationArt the cover to show for the station without a song
 */
export function describeStation (stationName, stationTitle, song, stationArt) {
  if (!isSong(song)) return { title: stationTitle, art: stationArt, id: `${ID_PREFIX}:${stationName}` }
  const cover = song.visuals?.card?.src
  return {
    title: song.firstLine.title,
    artist: song.secondLine?.title,
    album: stationTitle,
    art: cover ? `${cover}/${COVER_SIZE}` : stationArt,
    id: `${ID_PREFIX}:${stationName}:${song.startTime}`,
  }
}

/**
 * Whether a description names a later song than the one the zone holds.
 *
 * A description without a song never replaces anything, and anything the zone holds
 * that FIPlay did not describe, or describes another station, is replaced.
 *
 * @param wanted a description from describeStation
 * @param heldId the item id of what the zone shows now, or null
 */
export function isNewer (wanted, heldId) {
  const [, station, start] = (wanted.id || '').split(':')
  if (!start) return false
  const [prefix, heldStation, heldStart] = (heldId || '').split(':')
  if (prefix !== ID_PREFIX || heldStation !== station) return true
  return Number(start) > Number(heldStart || 0)
}
