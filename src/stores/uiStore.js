import { defineStore } from 'pinia'

export const useUIStore = defineStore('UI', {
  state: () => ({
    players: [
      // {name, playing, volume}

    ],
    playerName: null,
  }),
  actions: {
    // kind is 'speaker' for a Raumfeld zone or room, 'browser' for the local
    // <audio> fallback. Speakers win the default selection: the browser player
    // exists so there is always something to play on, not as the preference.
    addPlayer(name, volume = 1, kind = 'browser') {
      if (!this.players.find(p => p.title === name)) {
        const player = {
          title: name,
          kind: kind,
          playing: false,
          volume: volume,
          stationLabel: null,
          stationURL: null,
          stationName: null,
        };
        this.players.push(player);

        // Speakers are discovered asynchronously and therefore arrive after the
        // browser player. Take over the selection when the first one shows up,
        // but never hand it back, so later arrivals do not keep reshuffling it.
        const active = this.players.find(p => p.title === this.playerName);
        if (!active || (kind === 'speaker' && active.kind === 'browser')) {
          this.playerName = name;
        }
      }
    },

    // Reflect what a speaker is already playing. This describes the world
    // rather than requesting a change, so callers must resync the state
    // snapshot afterwards to keep it from being sent back as a command.
    adoptPlayback(name, { stationName, stationLabel, stationURL, playing }) {
      const player = this.players.find(p => p.title === name);
      if (!player) return;
      player.stationName = stationName;
      player.stationLabel = stationLabel;
      player.stationURL = stationURL;
      player.playing = playing;
    }
  },
  getters: {
    activePlayer: (state) => {
      return state.players.find(player => player.title === state.playerName) || null;
    }
  }
})

