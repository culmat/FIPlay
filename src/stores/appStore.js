// Utilities
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    /*
    backend: {
      url: null,
      connected: false,
      playing: false,
    },
    frontend: {
      playing: false,
    },
    controlBackEnd: false,
    */
    backEndURL: null,
    backEndConnected: false,
    backendPlaying: false,
    clientPlaying: false,
  }),
})

