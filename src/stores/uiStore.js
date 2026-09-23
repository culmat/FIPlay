import { defineStore } from 'pinia'

/**
 * Which station the app is on, and which outputs are playing it.
 *
 * Outputs are independent switches rather than one selection: the laptop and
 * any number of Raumfeld zones can be on at the same time, and the transport
 * applies to all of them together. `enabled` is what the user asked for,
 * `playing` is what is actually making sound, so pausing keeps the group.
 *
 * Note that two outputs fed separately are two independent connections to a
 * live stream, so they start a second or two apart and stay that way. Raumfeld
 * zones are the synchronised option: the backend groups rooms into one.
 */
export const useUIStore = defineStore('UI', {
  state: () => ({
    // { title, kind, enabled, playing, volume, stationLabel, stationURL, stationName }
    players: [],

    // The station the app is on: { name, label, url }
    station: null,

    // Where playback goes when something is started and no output is on.
    defaultTarget: null,
  }),

  getters: {
    enabledPlayers: state => state.players.filter(p => p.enabled),

    /** Anything actually making sound. */
    anyPlaying: state => state.players.some(p => p.enabled && p.playing),

    /**
     * The one output that is on, when exactly one is.
     *
     * With several outputs there is no single volume to show, so the inline
     * sliders stand down and the sheet offers one slider per output instead.
     */
    soloPlayer (state) {
      const on = state.players.filter(p => p.enabled)
      return on.length === 1 ? on[0] : null
    },

    /** True once any speaker is in the group, for the output button's icon. */
    onSpeaker: state => state.players.some(p => p.enabled && p.kind === 'speaker'),
  },

  actions: {
    // kind is 'speaker' for a Raumfeld zone or room, 'browser' for the local
    // <audio> fallback. Speakers win the default: the browser player exists so
    // there is always something to play on, not as the preference.
    addPlayer (name, volume = 100, kind = 'browser') {
      if (this.players.find(p => p.title === name)) return

      this.players.push({
        title: name,
        kind,
        enabled: false,
        playing: false,
        volume,
        stationLabel: null,
        stationURL: null,
        stationName: null,
      })

      // Speakers are discovered asynchronously and therefore arrive after the
      // browser player. Take over as the default when the first one shows up,
      // but never hand it back, so later arrivals do not keep reshuffling it.
      const current = this.players.find(p => p.title === this.defaultTarget)
      if (!current || (kind === 'speaker' && current.kind === 'browser')) {
        this.defaultTarget = name
      }
    },

    /** Put a station on every output that is on, switching one on if none is. */
    playStation ({ name, label, url }) {
      this.station = { name, label, url }

      let targets = this.players.filter(p => p.enabled)
      if (targets.length === 0) {
        const fallback = this.players.find(p => p.title === this.defaultTarget) || this.players[0]
        if (!fallback) return
        fallback.enabled = true
        targets = [fallback]
      }

      for (const player of targets) {
        player.stationName = name
        player.stationLabel = label
        player.stationURL = url
        player.playing = true
      }
    },

    /**
     * Switch an output on or off.
     *
     * Switching one on joins it to whatever the others are doing, which is the
     * point of the toggle: you add the kitchen without interrupting the living
     * room. Switching one off silences that output alone.
     */
    setEnabled (title, on) {
      const player = this.players.find(p => p.title === title)
      if (!player) return

      player.enabled = on

      if (!on) {
        player.playing = false
        return
      }

      if (!this.station) return
      player.stationName = this.station.name
      player.stationLabel = this.station.label
      player.stationURL = this.station.url

      // Join the group as it is: start with the others if they are playing,
      // stay quiet if everything is paused. Switching a room on should never
      // be what breaks a silence nobody asked to end.
      player.playing = this.players.some(p => p !== player && p.enabled && p.playing)
    },

    /** Transport for the whole group. */
    setPlaying (on) {
      for (const player of this.players) {
        if (!player.enabled) continue
        if (on && !player.stationURL) continue
        player.playing = on
      }
    },

    // Reflect what a speaker is already playing. This describes the world
    // rather than requesting a change, so callers must resync the state
    // snapshot afterwards to keep it from being sent back as a command.
    adoptPlayback (name, { stationName, stationLabel, stationURL, playing }) {
      const player = this.players.find(p => p.title === name)
      if (!player) return

      player.stationName = stationName
      player.stationLabel = stationLabel
      player.stationURL = stationURL
      player.playing = playing
      player.enabled = true

      if (!this.station) this.station = { name: stationName, label: stationLabel, url: stationURL }
    },

    /**
     * Take what a speaker reports as the truth about it.
     *
     * Another phone, the Raumfeld app or a button on the device can change
     * what a speaker does; the speaker is the only place that knows. When an
     * output that is on moves to another station, the app follows, so every
     * open copy of FIPlay ends up showing the same thing. Returns whether
     * anything changed, so the caller can resync its snapshot and not send the
     * observation back to the device as a command.
     */
    syncFromDevice (name, { stationName, stationLabel, stationURL, playing, volume }) {
      const player = this.players.find(p => p.title === name)
      if (!player) return false
      let changed = false

      if (stationName && player.stationName !== stationName) {
        player.stationName = stationName
        player.stationLabel = stationLabel
        player.stationURL = stationURL
        changed = true
      }
      if (player.playing !== playing) {
        player.playing = playing
        changed = true
      }
      if (typeof volume === 'number' && player.volume !== volume) {
        player.volume = volume
        changed = true
      }
      // A speaker someone started is part of the picture, whoever started it.
      if (playing && !player.enabled) {
        player.enabled = true
        changed = true
      }
      if (player.enabled && stationName && this.station?.name !== stationName) {
        this.station = { name: stationName, label: stationLabel, url: stationURL }
        changed = true
      }
      return changed
    },
  },
})
