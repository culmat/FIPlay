/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'
import { useStationStore } from '@/stores/stationStore';
import { useAppStore } from '@/stores/appStore';
import router from './router'
export { togglePlay,adjustVolume,toggleClientSound }

const app = createApp(App)

registerPlugins(app)

app.mount('#app')

const stationStore = useStationStore();
const appStore = useAppStore();

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

class StationWatcher {
    constructor(delayToRefresh, stationName, stationLabel) {
        this.stationName = stationName;
        this.stationLabel = stationLabel;
        this.scheduleNextRefresh(delayToRefresh);
    }
    scheduleNextRefresh(delayToRefresh) {
        console.debug(this.stationName+' will refresh at '+ new Date(Date.now() + delayToRefresh));
        setTimeout(() => {
            this.getStationInfo();
            }, 
            delayToRefresh
        );
    }
    getStationInfo() {
        fetch('https://fip-metadata.fly.dev/api/metadata/'+this.stationName)
            .then(response => response.json())
            .then(station => {
                station.stationLabel = this.stationLabel;
                stationStore.updateStation(station);
                this.scheduleNextRefresh(station.delayToRefresh);
            })
            .catch(error => {
                console.error('Error fetching metadata:', error);
            });
    }

}
for (const [stationName, stationLabel] of Object.entries(stations)) {
    new StationWatcher(0, stationName, stationLabel);
    //if(stationName == 'fip_pop') break
}

var audio
var checkBackEndConnectionTimer
function checkBackEndConnection() { 
    if(!appStore.backend) {
        return
    }
    console.warn('Backend not implemented');
    appStore.connected = false;
    if(checkBackEndConnectionTimer) {
        clearTimeout(checkBackEndConnectionTimer);
    }
    checkBackEndConnectionTimer = setTimeout(() => {
        checkBackEndConnection();
        }, 
        5000
    );
}

function adjustVolume(louder) {
    if(!audio) {
        console.warn('No audio object');
        return;
    }
    if(louder) {
        audio.volume = Math.min(1, audio.volume + 0.1);
    } else {
        audio.volume = Math.max(0, audio.volume - 0.1);
    }
    console.debug('Volume:', audio.volume);
}    
function toggleClientSound() {
    appStore.clientSound = !appStore.clientSound;
    if(appStore.clientSound && appStore.playing && audio) {
        audio.play().catch(error => {
            console.error('Error playing audio:', error);
        });
    } else if(!appStore.clientSound && audio) {
        audio.pause();
    }
}

function togglePlay() {
    appStore.playing = !appStore.playing;
    if(appStore.backend){
        console.warn('Backend not implemented');
    }
    if(audio) {
        if(audio.paused) {
            audio.play().catch(error => {
                console.error('Error playing audio:', error);
            });
        } else {
            audio.pause();
        }
    }
}

router.beforeEach((to, from, next) => {
    if (to.query.backend) {
        appStore.backend = to.query.backend;
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
  
      console.debug(`Media source URL with highest bitrate: ${highestBitrateSource.url}`);
      if(audio && !audio.paused) {
          audio.pause();
      }
      audio = new Audio(highestBitrateSource.url);
      appStore.stationLabel = stationStore.stations[stationName].stationLabel
      togglePlay();
}

router.afterEach((to, from) => {
  if (to.fullPath.startsWith('/station/')) {
    const stationName = to.fullPath.substring('/station/'.length);
    console.debug(`Now playing: ${stationName}`);
    playStation(stationName);
  }
})

checkBackEndConnection()
