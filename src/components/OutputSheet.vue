<template>
  <dialog
    ref="el"
    class="sheet sheet--bottom sheet--anchored"
    aria-label="Playback outputs"
    @close="ui.outputOpen = false"
    @click.self="close"
  >
    <div
      class="sheet__panel chrome"
      tabindex="-1"
      autofocus
    >
      <div class="sheet__grip" />

      <h2 class="out__heading">
        Play on
      </h2>

      <ul class="out__list">
        <li
          v-for="player in uiStore.players"
          :key="player.title"
        >
          <button
            class="out__item"
            role="switch"
            :aria-checked="player.enabled"
            @click="uiStore.setEnabled(player.title, !player.enabled)"
          >
            <Icon
              class="out__kind"
              :class="{ 'out__kind--on': player.enabled }"
              :path="player.kind === 'speaker' ? mdiSpeaker : mdiLaptop"
              :size="22"
            />
            <span class="out__text">
              <span class="out__name truncate">{{ player.title }}</span>
              <span class="out__state truncate">{{ stateOf(player) }}</span>
            </span>
            <span
              class="switch"
              :class="{ 'switch--on': player.enabled }"
            ><span class="switch__knob" /></span>
          </button>

          <!-- Each output keeps its own volume, so each gets its own slider. -->
          <div
            v-if="player.enabled && !volumeLocked(player)"
            class="out__volume"
          >
            <VolumeSlider
              :model-value="player.volume"
              @update:model-value="value => player.volume = value"
            />
          </div>
        </li>
      </ul>

      <p
        v-if="!uiStore.players.length"
        class="out__empty"
      >
        Looking for players…
      </p>

      <div class="out__footer">
        <button
          class="btn btn--text"
          @click="openAbout"
        >
          About FIPlay
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup>
import { mdiLaptop, mdiSpeaker } from '@mdi/js'

import { isIOS } from '@/platform'
import { useUIStore } from '@/stores/uiStore'
import { ui } from '@/ui'

const uiStore = useUIStore()
const el = ref(null)

// iOS gives the hardware buttons sole control of an <audio> element's volume,
// so a slider for the browser player there would move and do nothing.
const volumeLocked = player => player.kind === 'browser' && isIOS

// Sync rather than toggle: the flag and the element can drift apart (a hot
// reload swaps the element, a browser closes a dialog on its own), and a
// toggle would then do nothing because the flag never changes value.
function sync () {
  if (!el.value) return
  if (ui.outputOpen && !el.value.open) el.value.showModal()
  if (!ui.outputOpen && el.value.open) el.value.close()
}

watch(() => ui.outputOpen, sync)
onMounted(sync)

function close () {
  ui.outputOpen = false
}

function stateOf (player) {
  if (!player.enabled) return 'Off'
  if (player.playing) return player.stationLabel ? `Playing ${player.stationLabel}` : 'Playing'
  return player.stationLabel ? `Paused ${player.stationLabel}` : 'Ready'
}

function openAbout () {
  close()
  ui.aboutOpen = true
}
</script>

<style scoped>
.out__heading {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
  padding: 10px 20px 6px;
}

.out__list {
  list-style: none;
  margin: 0;
  padding: 0 8px;
}

.out__item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 52px;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  text-align: left;
  transition: background var(--dur) var(--ease);
}

.out__item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.out__item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.sheet__panel:focus {
  outline: none;
}

.out__kind {
  flex: 0 0 auto;
  color: var(--text-3);
  transition: color var(--dur) var(--ease);
}

.out__kind--on {
  color: var(--accent);
}

.out__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
}

.out__name {
  font-size: 0.9375rem;
  font-weight: 600;
}

.out__state {
  font-size: 0.8125rem;
  color: var(--text-3);
}

.out__volume {
  padding: 2px 16px 12px 46px;
}

.out__empty {
  padding: 4px 20px 12px;
  color: var(--text-3);
  font-size: 0.875rem;
}

.out__footer {
  display: flex;
  justify-content: center;
  padding: 4px 8px 0;
  border-top: 1px solid var(--glass-border);
  margin-top: 4px;
}
</style>
