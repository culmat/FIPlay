// Where the now-playing metadata comes from. Defaults to the public service, so
// the GitHub Pages build keeps working; a deployment that runs its own copy
// sets VITE_METADATA_URL at build time.
const METADATA_URL = (import.meta.env.VITE_METADATA_URL || 'https://fip-metadata.fly.dev').replace(/\/$/, '')

/**
 * How long the audio trails the feed's clock.
 *
 * The feed's start and end times are the studio's. The stream reaches a speaker
 * or a browser some seconds later: the HLS live edge alone trails by about five,
 * and a player buffers a few more. So the display should move on that much after
 * the feed says a track ended, not before, and the progress bar should run that
 * much behind the feed's clock.
 */
export const STREAM_DELAY_MS = 8000

/** How often to ask again while the track on display is overdue. */
const OVERDUE_MS = 3000
/** While the display runs ahead of the feed, look for its confirmation this often. */
const CONFIRM_MS = 10000
const MIN_MS = 1000
const MAX_MS = 120000

const clamp = (ms, min, max) => Math.min(Math.max(ms, min), max)

/** A track with a start time is a song; without one it is a programme placeholder. */
const isSong = track => !!(track && track.startTime)

/** The same track: by the service's id when both carry one, else by title and start. */
const sameTrack = (a, b) => {
    if (!a || !b) return false
    if (a.songUuid && b.songUuid) return a.songUuid === b.songUuid
    return a.firstLine?.title === b.firstLine?.title && a.startTime === b.startTime
}

export default class StationWatcher {
    constructor(delayToRefresh, stationName, stationLabel, updateStation) {
        this.stationName = stationName;
        this.stationLabel = stationLabel;
        this.updateStation = updateStation;
        this.errorCount = 0;
        this.shown = null;     // the track on display
        this.promoted = false; // whether it came from the feed's "next" rather than its "now"
        this.feedNow = null;   // the last song the feed itself called current
        this.announced = null; // the last useful "next" the feed announced
        this.scheduleNextRefresh(delayToRefresh);
    }
    scheduleNextRefresh(delayToRefresh) {
        console.debug(this.stationName + ' will refresh at ' + new Date(Date.now() + delayToRefresh));
        setTimeout(() => {
            this.getStationInfo();
        },
            delayToRefresh
        );
    }
    /**
     * How long to wait before asking again.
     *
     * The feed's own delayToRefresh outlasts the track by half a minute or so,
     * and the feed names a new track 20 to 40 seconds after it started. So ask
     * when the track on display should be over on the speaker, and keep asking
     * every few seconds while the answer is still the old one.
     */
    refreshDelay(station) {
        const suggested = station.delayToRefresh || 30000;
        if (!isSong(this.shown)) return clamp(suggested, OVERDUE_MS, MAX_MS);
        const wait = this.shown.endTime * 1000 + STREAM_DELAY_MS - Date.now();
        if (wait <= 0) return OVERDUE_MS;
        return clamp(Math.min(suggested, wait, this.promoted ? CONFIRM_MS : MAX_MS), MIN_MS, MAX_MS);
    }
    /**
     * Decide what an answer means for the display.
     *
     * Around a track change the feed is late and noisy: for 20 to 40 seconds it
     * still names the old track, often with a programme placeholder ("Le
     * direct", no start time) in between, and its "next" turns into a copy of
     * the old track just when it would be needed. Three rules keep the display
     * steady and on time:
     * - a placeholder while a song is on display is no news;
     * - the old track, once the display has moved on to the announced next
     *   one, is no news either;
     * - when the song on display should be over on the speaker and the feed
     *   has announced what follows, show that without waiting for the feed.
     * Anything else is the feed's word and replaces what is shown.
     */
    adopt(station) {
        const now = station.now;
        const oldNews = this.promoted && sameTrack(now, this.feedNow);
        const placeholder = !isSong(now) && isSong(this.shown);
        if (!oldNews && !placeholder) {
            if (isSong(now)) this.feedNow = now;
            this.display(station, false);
        }
        this.remember(station.next);
        this.promote(station);
    }
    display(station, promoted) {
        this.shown = station.now;
        this.promoted = promoted;
        this.updateStation(station);
    }
    /**
     * Keep the last useful announcement of what follows.
     *
     * The feed announces the next track well ahead, but around the change it
     * replaces the announcement with the old track or drops it, so the answer
     * that arrives when the change is due is the one least likely to carry it.
     */
    remember(next) {
        const shown = this.shown;
        const stale = track => isSong(shown) && track.startTime <= shown.startTime;
        if (this.announced && stale(this.announced)) this.announced = null;
        if (isSong(next) && !stale(next) && !sameTrack(next, shown)) this.announced = next;
    }
    /** Move the display on to the announced next track once it is due. */
    promote(station) {
        const next = this.announced;
        if (this.promoted || !next) return;
        const endsAt = isSong(this.shown) ? this.shown.endTime : 0;
        if (Date.now() < Math.max(endsAt, next.startTime) * 1000 + STREAM_DELAY_MS) return;
        console.debug(this.stationName + ' moves on to the announced next track before the feed does');
        this.announced = null;
        this.display({
            ...station,
            // The streams belong to the channel, but clients find them under "now".
            now: { ...next, media: this.shown?.media },
            next: null,
        }, true);
    }
    /**
     * Say so, once, when no metadata is coming.
     *
     * Without this the station keeps the empty placeholder it was seeded with,
     * which is indistinguishable from one whose first response is still on its
     * way, so its card would shimmer as a skeleton forever. The station is
     * still playable: the stream URL is derived from its name.
     */
    giveUp() {
        this.updateStation({
            stationName: this.stationName,
            stationLabel: this.stationLabel,
            unavailable: true,
            now: {
                firstLine: { title: '' },
                secondLine: { title: '' },
                visuals: { card: { src: '' } },
                media: { sources: [] }
            }
        });
    }
    getStationInfo() {
        fetch(METADATA_URL + '/api/metadata/' + this.stationName)
            .then(response => response.json())
            .then(station => {
                station.stationLabel = this.stationLabel;
                this.adopt(station);
                this.scheduleNextRefresh(this.refreshDelay(station));
            })
            .catch(error => {
                console.error('Error fetching metadata for ' + this.stationName + ':', error);
                if (this.errorCount++ < 3) {
                    this.scheduleNextRefresh(777 + this.errorCount * 222);
                } else {
                    console.error('Too many errors fetching metadata for ' + this.stationName + ':', error);
                    this.giveUp();
                }
            });
    }

}
