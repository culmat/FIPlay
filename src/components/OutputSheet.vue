<template>
  <dialog
    ref="el"
    class="sheet sheet--bottom sheet--anchored"
    aria-label="Playback output"
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
            :class="{ 'out__item--on': player.title === uiStore.playerName }"
            @click="select(player)"
          >
            <Icon
              class="out__kind"
              :path="player.kind === 'speaker' ? mdiSpeaker : mdiLaptop"
              :size="22"
            />
            <span class="out__text">
              <span class="out__name truncate">{{ player.title }}</span>
              <span class="out__state truncate">{{ stateOf(player) }}</span>
            </span>
            <Icon
              v-if="player.title === uiStore.playerName"
              class="out__check"
              :path="mdiCheck"
              :size="20"
            />
          </button>
        </li>
      </ul>

      <p
        v-if="!uiStore.players.length"
        class="out__empty"
      >
        Looking for players…
      </p>

      <div
        v-if="showVolume"
        class="out__volume"
      >
        <VolumeSlider
          :model-value="uiStore.activePlayer.volume"
          @update:model-value="setVolume"
        />
      </div>

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
import { mdiCheck, mdiLaptop, mdiSpeaker } from '@mdi/js'

import { isIOS } from '@/platform'
import { useUIStore } from '@/stores/uiStore'
import { ui } from '@/ui'

const uiStore = useUIStore()
const el = ref(null)

// iOS gives the hardware buttons sole control of an <audio> element's volume,
// so a slider for the browser player there would move and do nothing.
const showVolume = computed(() => uiStore.activePlayer && !(uiStore.activePlayer.kind === 'browser' && isIOS))

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

function select (player) {
  uiStore.playerName = player.title
  close()
}

function setVolume (value) {
  if (uiStore.activePlayer) uiStore.activePlayer.volume = value
}

function stateOf (player) {
  if (!player.stationLabel) return 'Idle'
  return `${player.playing ? 'Playing' : 'Paused'} ${player.stationLabel}`
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

.out__item--on {
  background: var(--accent-soft);
}

.out__item--on .out__kind,
.out__check {
  color: var(--accent);
}

.out__kind {
  flex: 0 0 auto;
  color: var(--text-3);
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

.out__empty {
  padding: 4px 20px 12px;
  color: var(--text-3);
  font-size: 0.875rem;
}

.out__volume {
  padding: 12px 20px 4px;
  margin-top: 4px;
  border-top: 1px solid var(--glass-border);
}

.out__footer {
  display: flex;
  justify-content: center;
  padding: 4px 8px 0;
}
</style>
