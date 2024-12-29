import { defineStore } from 'pinia'

export const useUIStore = defineStore('UI', {
  state: () => ({
    players: [
      // {name, playing, volume}

    ],
    playerName: null,
  }),
  actions: {
    addPlayer(name, volume = 1) {
      if (!this.players.find(p => p.title === name)) {
        const player = {
          title: name,
          playing: false,
          volume: volume,
          stationLabel: null,
          stationURL: null,
          stationName: null,
        };
        this.players.push(player);
        this.playerName = name;
      }
    }
  },
  getters: {
    activePlayer: (state) => {
      return state.players.find(player => player.title === state.playerName) || null;
    }
  }
})

