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
export { togglePlay,adjustVolume }

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

var backend
var audio

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

function togglePlay() {
    if(!audio) {
        console.warn('No audio object');
        return;
    }
    if(audio.paused) {
        audio.play().catch(error => {
            console.error('Error playing audio:', error);
        });
    } else {
        audio.pause();
    }
    appStore.playing = !audio.paused;
    
}

router.afterEach((to, from) => {
  if (to.query.backend) {
    backend = to.query.backend;
  }
  if (to.fullPath.startsWith('/station/')) {
    if(!backend) {
      console.warn('No backend specified');
    }
    const stationName = to.fullPath.substring('/station/'.length);
    console.log(`Now playing: ${stationName}`);
    
    const highestBitrateSource = stationStore.stations[stationName].now.media.sources.reduce((prev, current) => {
      return (prev.bitrate > current.bitrate) ? prev : current;
    });

    console.log(`Media source URL with highest bitrate: ${highestBitrateSource.url}`);
    if(audio && !audio.paused) {
        togglePlay();
    }
    audio = new Audio(highestBitrateSource.url);
    appStore.stationLabel = stationStore.stations[stationName].stationLabel
    togglePlay();
  }
})


