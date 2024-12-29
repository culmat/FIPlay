import { defineStore } from 'pinia'

export const useStationStore = defineStore('stations', {
  state: () => ({
    stations: {}
  }),
  actions: {
    updateStation(station) {
      this.stations[station.stationName] = station;
    }
  }
})

