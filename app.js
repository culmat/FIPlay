import { fetchStations } from './services/api.js';
import StationCard from './components/StationCard.js';
import VolumeControl from './components/VolumeControl.js';

let stations = [];
let currentStation = null;

const App = {
    oninit: async () => {
        stations = await fetchStations();
        m.redraw();
    },
    view: () => {
        return m('div', [
            m(VolumeControl),
            m('div', { class: 'columns is-multiline' },
                stations.map(station => m(StationCard, { station, currentStation }))
            )
        ]);
    }
};

m.mount(document.getElementById('app'), App);