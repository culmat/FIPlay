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

const app = createApp(App)

registerPlugins(app)

app.mount('#app')

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
                const stationStore = useStationStore();
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
    if(stationName == 'fip_pop') break
}


