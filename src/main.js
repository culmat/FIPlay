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
import { VToolbarItems } from 'vuetify/components/VToolbar';
const browser = Bowser.getParser(window.navigator.userAgent);

const app = createApp(App)

registerPlugins(app)

app.mount('#app')

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

addPlayer(new BrowserPlayer(), `${browser.getBrowserName()} / ${browser.getOSName()}`);


for (const [stationName, stationLabel] of Object.entries(stations)) {
    stationStore.updateStation({
        stationName, stationLabel, now: {
            firstLine: '',
            secondLine: '',
            visuals: { card: '' },
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
    // Prefer the stream list the metadata service supplies, but fall back to
    // building it from the station name. Radio France stopped returning
    // now.media.sources, and the URLs are derivable, so there is no reason for
    // playback to depend on that field coming back.
    const sources = stationStore.stations[stationName].now.media?.sources;
    const usable = (sources && sources.length) ? sources : streamSources(stationName);
    const highestBitrateSource = usable.reduce((prev, current) => {
        return (prev.bitrate > current.bitrate) ? prev : current;
    });


    uiStore.activePlayer.stationLabel = stationStore.stations[stationName].stationLabel;
    uiStore.activePlayer.stationURL = highestBitrateSource.url;
    uiStore.activePlayer.playing = "true";
    uiStore.activePlayer.stationName = stationName;
    console.debug("playing ", stationName, uiStore.activePlayer.stationURL, players[uiStore.playerName])
    players[uiStore.playerName].playURL(uiStore.activePlayer.stationURL);
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
        playing: state === 'PLAYING' ? 'true' : 'false',
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
    if (to.fullPath != from.fullPath &&
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

function deepCompare(obj1, obj2, path = '', changes = {}) {
    for (const key in obj1) {
        if (obj1.hasOwnProperty(key)) {
            const newPath = path ? `${path}.${key}` : key;
            if (typeof obj1[key] === 'object' && obj1[key] !== null && typeof obj2[key] === 'object' && obj2[key] !== null) {
                deepCompare(obj1[key], obj2[key], newPath, changes);
            } else if (obj1[key] !== obj2[key]) {
                changes[newPath] = { from: obj1[key], to: obj2[key] };
            }
        }
    }
    return changes;
}

var lastStateCopy

// Accept the current state as already applied. Without this, state copied from
// a speaker looks like a fresh request and gets sent straight back to it.
function syncStateSnapshot() {
    lastStateCopy = { activePlayer: JSON.parse(JSON.stringify(uiStore.activePlayer)) };
}

uiStore.$subscribe((mutation, state) => {
    const stateCopy = {};
    stateCopy.activePlayer = JSON.parse(JSON.stringify(uiStore.activePlayer));
    if (!lastStateCopy) {
        lastStateCopy = stateCopy;
    } else {
        var changes = deepCompare(lastStateCopy, stateCopy);
        if (changes['activePlayer.volume']) {
            players[uiStore.playerName].setVolume(changes['activePlayer.volume'].to);
        } else if (changes['activePlayer.playing']) {
            if (changes['activePlayer.playing'].to == "true") {
                players[uiStore.playerName].play();
            } else if (changes['activePlayer.playing'].to == "false") {
                players[uiStore.playerName].pause();
            } else {
                uiStore.activePlayer.playing = lastStateCopy.activePlayer.playing;
            }
        }
        lastStateCopy = stateCopy;
    }
})