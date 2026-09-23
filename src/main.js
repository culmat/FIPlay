// Styles
import '@/styles/main.css'

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'
import { useStationStore } from '@/stores/stationStore';
import { useUIStore } from '@/stores/uiStore';
import router from './router'
import StationWatcher from './StationWatcher'
import RoomBackend from './RoomBackend'
import ZoneBackend from './ZoneBackend'
import Bowser from "bowser";
import BackendPlayer from './BackendPlayer';
import BrowserPlayer from './BrowserPlayer';
import { bindMediaSession } from './mediaSession';
const browser = Bowser.getParser(window.navigator.userAgent);

const app = createApp(App)

registerPlugins(app)

// The play buttons in the views need this, and importing main.js from a
// component would be circular. Provide is the smallest way in.
app.provide('playStation', playStation)

app.mount('#app')

// Registering needs a secure origin, which a plain http LAN address is not.
// Asking anyway only produces an error nobody can act on. A new version takes
// over once every tab is closed, so an update never interrupts what is playing.
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
    import('virtual:pwa-register')
        .then(({ registerSW }) => registerSW({ immediate: true }))
        .catch(error => console.debug('Service worker not registered:', error));
}

const stationStore = useStationStore();
const uiStore = useUIStore();

const stations = {
    fip: '📻 FIP',
    fip_reggae: '☮️ Reggae',
    fip_jazz: '🎷 Jazz',
    fip_world: '🌍 World',
    fip_groove: '💃 Groove',
    fip_nouveautes: '🆕 Nouveautés',
    fip_electro: '🎛️ Electro',
    fip_sacre_francais: '🥖 Sacré Français',
    fip_rock: '🎸 Rock',
    fip_metal: '🤘 Metal',
    fip_hiphop: '🎧 Hiphop',
    fip_pop: '🎤 Pop',
}

const players = {}

// The stream URLs are https://icecast.radiofrance.fr/<slug>-<quality>.<ext>,
// where <slug> is the station name without underscores. That lets a URL be
// built for a station, and a URL a speaker holds be traced back to one.
const STREAM_BASE = 'https://icecast.radiofrance.fr'

const stationsByStreamSlug = Object.fromEntries(
    Object.keys(stations).map(name => [name.replaceAll('_', ''), name])
)

// Radio France publishes these two qualities for every FIP channel.
function streamSources(stationName) {
    const slug = stationName.replaceAll('_', '');
    return [
        { url: `${STREAM_BASE}/${slug}-hifi.aac`, bitrate: 192 },
        { url: `${STREAM_BASE}/${slug}-midfi.mp3`, bitrate: 128 },
    ];
}

function stationForStreamURL(url) {
    if (!url || !url.includes('icecast.radiofrance.fr')) return null;
    const file = url.split('/').pop() || '';
    return stationsByStreamSlug[file.split('-')[0]] || null;
}

function addPlayer(player, name, volume = 100, kind = 'browser') {
    if (!players[name]) {
        players[name] = player;
        uiStore.addPlayer(name, volume, kind);
    }
}

const browserPlayerName = `${browser.getBrowserName()} / ${browser.getOSName()}`;
addPlayer(new BrowserPlayer(), browserPlayerName);

// Lock-screen artwork and play/pause for the browser player.
bindMediaSession(uiStore, stationStore, browserPlayerName);


for (const [stationName, stationLabel] of Object.entries(stations)) {
    // Same shape the metadata service returns, so the components receive the
    // types they declare while the first response is still on its way. The
    // placeholder used bare strings, which made every field read as undefined
    // and produced a prop type warning per station on every load.
    stationStore.updateStation({
        stationName, stationLabel, now: {
            firstLine: { title: '' },
            secondLine: { title: '' },
            visuals: { card: { src: '' } },
            media: { sources: [] }
        }
    });
    new StationWatcher(0, stationName, stationLabel, stationStore.updateStation);
    //if(stationName == 'fip_pop') break
}

const backends = []

// The Raumfeld backend URL arrives as the ?backend= query parameter. Routes are
// built without it in several places, so remember it and put it back rather
// than silently losing the speakers on the next navigation.
let backendURL = null
let discoveryStarted = false

/**
 * Register a player for every zone and room the backend reports.
 *
 * Safe to run more than once: addPlayer ignores names it already knows, so a
 * later pass only adds speakers that have since appeared.
 */
function discoverPlayers() {
    for (const backend of backends) {
        backend.list().then(items => {
            items.forEach(item => {
                backend.getVolume(item.udn).then(volume => {
                    const name = backend.prefix() + item.name;
                    const isNew = !players[name];
                    addPlayer(new BackendPlayer(backend, item.udn), name, volume, 'speaker');
                    if (isNew) adoptPlayback(backend, item.udn, name);
                }).catch(error => {
                    console.error(`Error fetching volume for item ${item.name}:`, error);
                });
            });
        }).catch(error => {
            console.error('Error fetching items:', error);
        });
    }
}

function startDiscovery(url) {
    backends.push(new ZoneBackend(url), new RoomBackend(url));

    // Ask the backend to rescan the network, but do not wait for it. It is by
    // far the slowest call, and the device list it refreshes is already kept
    // current by the backend itself, so blocking on it only delays the
    // speakers from appearing.
    discoverPlayers();
    backends[0].update()
        .then(() => {
            // Only look again if the first round came up empty. Repeating it
            // once speakers are known just doubles the requests against a
            // backend that answers one at a time and can be slow.
            if (!Object.values(players).some(p => p instanceof BackendPlayer)) discoverPlayers();
        })
        .catch(error => console.debug('Backend rescan failed:', error));
}

router.beforeEach((to, from, next) => {
    if (to.query.backend) {
        backendURL = to.query.backend
    } else if (backendURL) {
        next({ path: to.path, query: { ...to.query, backend: backendURL }, hash: to.hash, replace: true })
        return
    }
    // Guarded synchronously: discovery takes a while, and without this every
    // navigation made in the meantime started a second, competing round.
    if (!discoveryStarted && to.query.backend) {
        discoveryStarted = true;
        startDiscovery(to.query.backend);
    }
    next();
});

/** Wait briefly for a speaker to be discovered, while none is known yet. */
function waitForSpeaker(timeoutMs = 4000) {
    if (Object.values(players).some(p => p instanceof BackendPlayer)) return Promise.resolve();
    return new Promise(resolve => {
        const started = Date.now();
        const check = () => {
            if (Object.values(players).some(p => p instanceof BackendPlayer)) resolve();
            else if (Date.now() - started > timeoutMs) resolve();
            else setTimeout(check, 100);
        };
        check();
    });
}

async function playStation(stationName) {
    const waitForStation = () => new Promise((resolve) => {
        const checkStation = () => {
            if (stationStore.stations[stationName]) {
                resolve();
            } else {
                setTimeout(checkStation, 100);
            }
        };
        checkStation();
    });

    await waitForStation();

    // Someone who configured speakers did not ask for the laptop. Discovery
    // takes about a second, so a click made before it finishes would otherwise
    // land on the browser player, which is the only one registered by then.
    if (backendURL) await waitForSpeaker();

    // Prefer the stream list the metadata service supplies, but fall back to
    // building it from the station name. Radio France stopped returning
    // now.media.sources, and the URLs are derivable, so there is no reason for
    // playback to depend on that field coming back.
    const sources = stationStore.stations[stationName].now.media?.sources;
    const usable = (sources && sources.length) ? sources : streamSources(stationName);
    const highestBitrateSource = usable.reduce((prev, current) => {
        return (prev.bitrate > current.bitrate) ? prev : current;
    });


    // The store puts it on every output that is switched on, and switches one
    // on if none is. Commanding the hardware is left to the subscriber below,
    // so there is one path from state to speaker however playback was started.
    uiStore.playStation({
        name: stationName,
        label: stationStore.stations[stationName].stationLabel,
        url: highestBitrateSource.url,
    });
    console.debug('playing', stationName, highestBitrateSource.url, uiStore.enabledPlayers.map(p => p.title));
}

/**
 * Show what a speaker is already playing.
 *
 * Reads the URL the renderer holds, traces it back to a station and copies the
 * result into the player, so opening FIPlay while the speakers are running
 * shows the station instead of an empty footer. Purely descriptive: the state
 * snapshot is resynced so this is not mistaken for a command and echoed back.
 */
async function adoptPlayback(backend, udn, playerName) {
    const url = await backend.currentURL(udn);
    const stationName = stationForStreamURL(url);
    if (!stationName) {
        console.debug(`${playerName} is not on a FIP station (holds ${url || 'nothing'})`);
        return;
    }

    const state = await backend.transportState(udn);
    uiStore.adoptPlayback(playerName, {
        stationName,
        stationLabel: stations[stationName],
        stationURL: url,
        playing: state === 'PLAYING',
    });
    syncStateSnapshot();
    console.debug(`${playerName} is already on ${stationName} (${state})`);

    // Open that station, so arriving while the speakers are playing shows the
    // track rather than the bare list. Only from the list, so it cannot pull
    // the view away from a station opened deliberately, and with play=false so
    // the navigation is not mistaken for a request to start playback.
    if (router.currentRoute.value.path === '/') {
        router.replace({
            path: '/station/' + stationName,
            query: { ...router.currentRoute.value.query, play: 'false' },
        });
    }
}

router.afterEach((to, from) => {
    // Read the station from the route parameter. Slicing it out of fullPath
    // breaks as soon as the path carries a query string.
    const stationName = to.params.stationName;

    // Opening or reloading a station URL is not a request to start playing.
    // vue-router reports no matched route on the first navigation, which is
    // how a page load is told apart from moving around inside the app.
    const pageLoad = from.matched.length == 0;

    if (!pageLoad &&
        to.fullPath != from.fullPath &&
        to.query.play != 'false' &&
        stationName) {
        console.debug(`Now playing: ${stationName}`);
        playStation(stationName);
    }
    if (to.query.play == 'false') {
        // Drop the marker without going through the router, so this does not
        // start playback. Editing the string would corrupt the other
        // parameters, whose order is not fixed.
        const url = new URL(window.location.href);
        url.searchParams.delete('play');
        history.replaceState(null, '', url);
    }
})

/**
 * Send state changes to the players they belong to.
 *
 * Every output is watched, because several can be playing at once. What is
 * compared is the small part of a player the hardware cares about, so an
 * unrelated edit (a station label, a newly discovered zone) commands nothing.
 */
function snapshot() {
    const out = {};
    for (const player of uiStore.players) {
        out[player.title] = { playing: player.playing, volume: player.volume, stationURL: player.stationURL };
    }
    return out;
}

var lastSnapshot = {};

// Accept the current state as already applied. Without this, state copied from
// a speaker looks like a fresh request and gets sent straight back to it.
function syncStateSnapshot() {
    lastSnapshot = snapshot();
}

/**
 * Send one command to one player, and cope with it failing.
 *
 * A speaker command fails when the backend holds a stale address for the
 * device, which happens whenever the device reconnects to the network. One
 * rescan and one retry cover that. If it still fails, the UI must not go on
 * saying the speaker is playing: the state is put back and the snapshot
 * resynced, so the correction is not itself sent as a pause.
 */
function send(title, command) {
    const player = players[title];
    Promise.resolve()
        .then(command)
        .catch(async firstError => {
            if (player instanceof BackendPlayer) {
                await player.backend.rescan();
                try {
                    await command();
                    return;
                } catch (retryError) {
                    console.error(`${title}: command failed again after a rescan`, retryError);
                }
            } else {
                console.error(`${title}: command failed`, firstError);
            }
            const state = uiStore.players.find(p => p.title === title);
            if (state && state.playing) {
                state.playing = false;
                syncStateSnapshot();
            }
        });
}

uiStore.$subscribe(() => {
    const current = snapshot();

    for (const [title, now] of Object.entries(current)) {
        const was = lastSnapshot[title];
        const player = players[title];

        // A player registered since the last pass has nothing to compare
        // against, and its state came from the hardware anyway.
        if (!player || !was) continue;

        if (now.volume !== was.volume) send(title, () => player.setVolume(now.volume));

        const urlChanged = now.stationURL !== was.stationURL;

        if (now.playing && urlChanged && now.stationURL) {
            // A different station: point the player at it, which starts it too.
            send(title, () => player.playURL(now.stationURL));
        } else if (now.playing && !was.playing) {
            // Same stream as before, so this is a resume, not a new stream.
            send(title, () => player.play());
        } else if (!now.playing && was.playing) {
            send(title, () => player.pause());
        }
    }

    lastSnapshot = current;
});
