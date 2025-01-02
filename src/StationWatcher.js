
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
    getStationInfo() {
        fetch('https://fip-metadata.fly.dev/api/metadata/' + this.stationName)
            .then(response => response.json())
            .then(station => {
                station.stationLabel = this.stationLabel;
                this.updateStation(station);
                this.scheduleNextRefresh(station.delayToRefresh);
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