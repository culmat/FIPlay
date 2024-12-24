// Utilities
import { defineStore } from 'pinia'

export const useStationStore = defineStore('app', {
  state: () => ({
    stations: {}
  }),
  actions: {
    updateStation(station) {
      this.stations[station.stationName] = station;
    }
  }
})
