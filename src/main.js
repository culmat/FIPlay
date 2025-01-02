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

function addPlayer(player, name, volume = 100) {
    if (!players[name]) {
        players[name] = player;
        uiStore.addPlayer(name, volume);
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

router.beforeEach((to, from, next) => {
    if (backends.length == 0 && to.query.backend) {
        backends.push(new RoomBackend(to.query.backend));
        backends.push(new ZoneBackend(to.query.backend));
        for (const backend of backends) {
            backend.list().then(items => {
                items.forEach(item => {
                    backend.getVolume(item.udn).then(volume => {
                        addPlayer(new BackendPlayer(backend, item.udn), item.name, volume);
                    }).catch(error => {
                        console.error(`Error fetching volume for item ${item.name}:`, error);
                    });
                });
            }).catch(error => {
                console.error('Error fetching items:', error);
            });
        }
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
    const highestBitrateSource = stationStore.stations[stationName].now.media.sources.reduce((prev, current) => {
        return (prev.bitrate > current.bitrate) ? prev : current;
    });


    uiStore.activePlayer.stationLabel = stationStore.stations[stationName].stationLabel;
    uiStore.activePlayer.stationURL = highestBitrateSource.url;
    uiStore.activePlayer.playing = "true";
    uiStore.activePlayer.stationName = stationName;
    console.debug("playing ", stationName, uiStore.activePlayer.stationURL, players[uiStore.playerName])
    players[uiStore.playerName].playURL(uiStore.activePlayer.stationURL);
}

router.afterEach((to, from) => {
    if (to.fullPath != from.fullPath &&
        to.query.play != 'false' &&
        to.fullPath.startsWith('/station/')) {
        const stationName = to.fullPath.substring('/station/'.length);
        console.debug(`Now playing: ${stationName}`);
        playStation(stationName);
    }
    if (to.query.play == 'false') {
        const newUrl = to.href.replace('?play=false', '');
        history.replaceState(null, '', newUrl);
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