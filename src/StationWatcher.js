
// Where the now-playing metadata comes from. Defaults to the public service, so
// the GitHub Pages build keeps working; a deployment that runs its own copy
// sets VITE_METADATA_URL at build time.
const METADATA_URL = (import.meta.env.VITE_METADATA_URL || 'https://fip-metadata.fly.dev').replace(/\/$/, '')

export default class StationWatcher {
    constructor(delayToRefresh, stationName, stationLabel, updateStation) {
        this.stationName = stationName;
        this.stationLabel = stationLabel;
        this.scheduleNextRefresh(delayToRefresh);
        this.updateStation = updateStation;
        this.errorCount = 0;
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
     * The service's own delayToRefresh consistently outlasts the track it
     * describes, by half a minute or so, which leaves a finished track on
     * screen with its timer running past the end. Ask again when the track is
     * due to finish instead, and keep asking while the answer is still the old
     * one, which happens when the service itself has not caught up yet.
     */
    refreshDelay(station) {
        const suggested = station.delayToRefresh || 30000;
        const endTime = station.now && station.now.endTime;
        const endsIn = endTime ? endTime * 1000 - Date.now() + 2000 : suggested;
        return Math.min(Math.max(Math.min(suggested, endsIn), 10000), 120000);
    }
    getStationInfo() {
        fetch(METADATA_URL + '/api/metadata/' + this.stationName)
            .then(response => response.json())
            .then(station => {
                station.stationLabel = this.stationLabel;
                this.updateStation(station);
                this.scheduleNextRefresh(this.refreshDelay(station));
            })
            .catch(error => {
                console.error('Error fetching metadata for ' + this.stationName + ':', error);
                if (this.errorCount++ < 3) {
                    this.scheduleNextRefresh(777 + this.errorCount * 222);
                } else {
                    console.error('Too many errors fetching metadata for ' + this.stationName + ':', error);
                }
            });
    }

}