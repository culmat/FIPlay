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
    fip_reggae: '☮️ Reggae',
    fip_pop: '🎤 Pop',
    fip_metal: '🤘 Metal',
    fip_hiphop: '🎧 Hiphop',
    fip_rock: '🎸 Rock',
    fip_jazz: '🎷 Jazz',
    fip_world: '🌍 World',
    fip_groove: '💃 Groove',
    fip_nouveautes: '🆕 Nouveautés',
    fip_electro: '🎛️ Electro',
    fip_sacre_francais: '🥖 Sacré Français',
    fip: '📻 FIP'
}

const players = {}

function addPlayer(player, name, volume = 1) {
    if (!players[name]) {
        players[name] = player;
        uiStore.addPlayer(name, volume);
    }
}

addPlayer(new BrowserPlayer(), `${browser.getBrowserName()} / ${browser.getOSName()}`);


for (const [stationName, stationLabel] of Object.entries(stations)) {
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


uiStore.$subscribe((mutation, state) => {
    if (mutation.events.key == "playing") {
        if (mutation.events.newValue == undefined) {
            uiStore.activePlayer.playing = mutation.events.oldValue;
        } else if (mutation.events.newValue == "true") {
            players[uiStore.playerName].play();
        }
        else if (mutation.events.newValue == "false") {
            players[uiStore.playerName].pause();
        }
    } else if (mutation.events.key == "volume") {
        players[uiStore.playerName].setVolume(mutation.events.newValue);
    }
})