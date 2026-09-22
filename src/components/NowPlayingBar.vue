<template>
  <footer class="bar chrome">
    <button
      class="bar__now"
      :disabled="!stationName"
      @click="openStation"
    >
      <span class="bar__thumb">
        <img
          v-if="art"
          :src="`${art}/200x200`"
          alt=""
          draggable="false"
        >
        <Icon
          v-else
          :path="mdiRadio"
          :size="20"
        />
      </span>
      <span class="bar__text">
        <span class="bar__title truncate">{{ title || 'Pick a station' }}</span>
        <span class="bar__sub truncate">{{ subtitle }}</span>
      </span>
    </button>

    <button
      class="btn btn--icon btn--primary"
      :disabled="!stationName"
      :aria-label="playing ? 'Pause' : 'Play'"
      @click="toggle"
    >
      <Icon
        :path="playing ? mdiPause : mdiPlay"
        :size="22"
      />
    </button>

    <div
      v-if="showVolume"
      class="bar__volume"
    >
      <VolumeSlider
        :model-value="solo.volume"
        @update:model-value="setVolume"
      />
    </div>

    <button
      class="btn btn--icon bar__output"
      aria-label="Choose outputs"
      @click="ui.outputOpen = true"
    >
      <Icon
        :path="isSpeaker ? mdiSpeaker : mdiLaptop"
        :size="22"
      />
      <span
        v-if="outputCount > 1"
        class="bar__count"
      >{{ outputCount }}</span>
    </button>
  </footer>
</template>

<script setup>
import { mdiLaptop, mdiPause, mdiPlay, mdiRadio, mdiSpeaker } from '@mdi/js'

import { isIOS } from '@/platform'
import { useStationStore } from '@/stores/stationStore'
import { useUIStore } from '@/stores/uiStore'
import { ui } from '@/ui'

const router = useRouter()
const uiStore = useUIStore()
const stationStore = useStationStore()

const stationName = computed(() => uiStore.station?.name || '')
const station = computed(() => (stationName.value ? stationStore.stations[stationName.value] : null))
const art = computed(() => station.value?.now?.visuals?.card?.src || '')
const title = computed(() => station.value?.now?.firstLine?.title || uiStore.station?.label || '')
const playing = computed(() => uiStore.anyPlaying)
const isSpeaker = computed(() => uiStore.onSpeaker)

// How many outputs are on, so the button can say "and one more room".
const outputCount = computed(() => uiStore.enabledPlayers.length)

const subtitle = computed(() => {
  if (!stationName.value) return 'Nothing playing'
  const artist = station.value?.now?.secondLine?.title
  const label = uiStore.station?.label || ''
  return artist ? `${artist} · ${label}` : label
})

// With two outputs on there is no single volume to show; the sheet has one
// slider per output for that case.
const solo = computed(() => uiStore.soloPlayer)
const showVolume = computed(() => solo.value && !(solo.value.kind === 'browser' && isIOS))

function toggle () {
  uiStore.setPlaying(!uiStore.anyPlaying)
}

function setVolume (value) {
  if (solo.value) solo.value.volume = value
}

// play=false: opening the page of something already playing must not be read
// as a request to start it again from the top.
function openStation () {
  if (stationName.value) router.push({ path: `/station/${stationName.value}`, query: { play: 'false' } })
}
</script>

<style scoped>
.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  height: calc(var(--bar-h) + var(--safe-bottom));
  padding: 0 max(10px, var(--safe-right)) var(--safe-bottom) max(10px, var(--safe-left));
  background: var(--glass);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border-top: 1px solid var(--glass-border);
}

.bar__now {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px;
  border-radius: var(--radius-sm);
  text-align: left;
  transition: background var(--dur) var(--ease);
}

.bar__now:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
}

.bar__now:disabled {
  cursor: default;
}

.bar__thumb {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--surface-2);
  display: grid;
  place-items: center;
  color: var(--text-3);
}

.bar__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bar__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.bar__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.bar__sub {
  font-size: 0.75rem;
  color: var(--text-3);
}

.bar__output {
  position: relative;
}

/* Two rooms on at once is worth saying out loud on the button itself. */
.bar__count {
  position: absolute;
  right: 2px;
  bottom: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: #fff;
  font-size: 0.625rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

/* Wide windows have room for the volume in the bar; phones reach it through
   the output sheet, where it is a full-width target. */
.bar__volume {
  display: none;
}

@media (min-width: 768px) {
  .bar__volume {
    display: block;
    width: 160px;
    flex: 0 0 auto;
  }
}
</style>
