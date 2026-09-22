<template>
  <div class="view">
    <!-- The artwork is the backdrop: blurred hard, dimmed, and cross-faded when
         the track changes, so the page takes its colour from what is playing. -->
    <div class="view__bg">
      <Transition name="xfade">
        <img
          v-if="art"
          :key="art"
          class="view__bg-img"
          :src="`${art}/200x200`"
          alt=""
          draggable="false"
        >
      </Transition>
      <div class="view__scrim" />
    </div>

    <button
      class="btn btn--icon btn--glass view__back chrome"
      aria-label="Back to stations"
      @click="router.push('/')"
    >
      <Icon
        :path="mdiArrowLeft"
        :size="22"
      />
    </button>

    <div
      v-if="!station"
      class="view__missing"
    >
      <p>Unknown station.</p>
    </div>

    <div
      v-else
      class="view__body"
    >
      <div class="view__art chrome">
        <img
          v-if="art"
          class="view__art-img"
          :class="{ 'view__art-img--in': loaded }"
          :src="`${art}/600x600`"
          :srcset="`${art}/400x400 400w, ${art}/600x600 600w, ${art}/800x800 800w`"
          sizes="min(78vw, 420px)"
          :alt="`Cover art for ${title || station.stationLabel}`"
          fetchpriority="high"
          decoding="async"
          draggable="false"
          @load="loaded = true"
        >
        <div
          v-else
          class="view__art-fallback"
        >
          <span>{{ emoji }}</span>
        </div>
      </div>

      <span class="pill view__station chrome">{{ station.stationLabel }}</span>

      <h1 class="view__title clamp-2">
        {{ title || 'Live' }}
      </h1>
      <p class="view__artist truncate">
        {{ artist }}
      </p>
      <p
        v-if="release"
        class="view__release truncate"
      >
        {{ release }}
      </p>

      <div class="view__progress chrome">
        <div class="view__track">
          <div
            class="view__fill"
            :style="{ width: progress.percentage + '%' }"
          />
        </div>
        <div class="view__times">
          <span>{{ progress.elapsedTime }}</span>
          <span>{{ progress.totalTime }}</span>
        </div>
      </div>

      <div class="view__controls chrome">
        <button
          class="btn btn--play"
          :aria-label="playing ? 'Pause' : 'Play'"
          @click="toggle"
        >
          <Icon
            :path="playing ? mdiPause : mdiPlay"
            :size="34"
          />
        </button>

        <button
          class="btn btn--icon btn--glass view__output"
          aria-label="Choose output"
          @click="ui.outputOpen = true"
        >
          <Icon
            :path="isSpeaker ? mdiSpeaker : mdiLaptop"
            :size="22"
          />
        </button>
      </div>

      <div
        v-if="showVolume"
        class="view__volume chrome"
      >
        <VolumeSlider
          tone="art"
          :model-value="uiStore.activePlayer.volume"
          @update:model-value="setVolume"
        />
      </div>

      <p
        v-if="upNext"
        class="view__next"
      >
        <span class="view__next-label">Up next</span>
        {{ upNext }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { mdiArrowLeft, mdiLaptop, mdiPause, mdiPlay, mdiSpeaker } from '@mdi/js'

import { isIOS } from '@/platform'
import { useStationStore } from '@/stores/stationStore'
import { useUIStore } from '@/stores/uiStore'
import { ui } from '@/ui'

const props = defineProps({
  stationName: { type: String, required: true },
})

const router = useRouter()
const stationStore = useStationStore()
const uiStore = useUIStore()
const playStation = inject('playStation')

const loaded = ref(false)

const station = computed(() => stationStore.stations[props.stationName] || null)
const now = computed(() => station.value?.now || null)
const art = computed(() => now.value?.visuals?.card?.src || '')
const title = computed(() => now.value?.firstLine?.title || '')
const artist = computed(() => now.value?.secondLine?.title || '')
const emoji = computed(() => station.value?.stationLabel?.trim().split(' ')[0] || '📻')

const release = computed(() => {
  const song = now.value?.song
  if (!song?.release?.title) return ''
  const year = song.year ? ` (${song.year})` : ''
  return `${song.release.title}${year}${song.release.label ? ' · ' + song.release.label : ''}`
})

const upNext = computed(() => {
  const next = station.value?.next
  const nextTitle = next?.firstLine?.title
  if (!nextTitle || nextTitle === title.value) return ''
  const nextArtist = next.secondLine?.title
  return nextArtist ? `${nextTitle} · ${nextArtist}` : nextTitle
})

const isCurrent = computed(() => uiStore.activePlayer?.stationName === props.stationName)
const playing = computed(() => isCurrent.value && !!uiStore.activePlayer?.playing)
const isSpeaker = computed(() => uiStore.activePlayer?.kind === 'speaker')
const showVolume = computed(() => uiStore.activePlayer && !(uiStore.activePlayer.kind === 'browser' && isIOS))

watch(art, () => { loaded.value = false })

/**
 * Play this station, or pause what is already this station.
 *
 * Arriving here does not always start playback: a reload, or following the
 * now-playing bar, deliberately does not. So the button has to be able to start
 * a station that is merely on screen, as well as toggle the one that is live.
 */
function toggle () {
  if (!isCurrent.value) {
    playStation(props.stationName)
    return
  }
  uiStore.activePlayer.playing = !uiStore.activePlayer.playing
}

function setVolume (value) {
  if (uiStore.activePlayer) uiStore.activePlayer.volume = value
}

// --- progress ---------------------------------------------------------------

const formatTime = time => {
  // Flooring both parts: rounding the seconds turns 119.6 into "1:60".
  const safe = Math.max(0, Math.floor(time))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
}

const calculateProgress = (track, nowMs) => {
  const empty = { percentage: 0, elapsedTime: formatTime(0), totalTime: formatTime(0) }
  if (!track) return empty

  const totalTime = track.endTime - track.startTime
  const elapsedTime = (nowMs - track.startTime * 1000) / 1000

  if (!(totalTime > 0) || !Number.isFinite(elapsedTime)) return empty

  // A track can outlive the data describing it, because the service reports
  // the next one a little late. Hold at the end rather than counting past it.
  const played = Math.min(Math.max(elapsedTime, 0), totalTime)

  return {
    percentage: (played / totalTime) * 100,
    elapsedTime: formatTime(played),
    totalTime: formatTime(totalTime),
  }
}

// One reactive clock feeding a computed, rather than forcing a re-render.
const tick = ref(Date.now())
const progress = computed(() => calculateProgress(now.value, tick.value))

let timer = null

function startClock () {
  stopClock()
  tick.value = Date.now()
  timer = setInterval(() => { tick.value = Date.now() }, 1000)
}

function stopClock () {
  if (timer) clearInterval(timer)
  timer = null
}

// A hidden tab does not need a clock; it also does not get timers on time.
const onVisibility = () => (document.hidden ? stopClock() : startClock())

onMounted(() => {
  startClock()
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  stopClock()
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
.view {
  position: relative;
  min-height: 100dvh;
}

.view__bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: var(--bg);
}

/* Oversized so the blur has pixels to sample at the edges instead of fading
   to transparent. The 200px source is already cached by the list. */
.view__bg-img {
  position: absolute;
  inset: -15%;
  width: 130%;
  height: 130%;
  object-fit: cover;
  filter: blur(56px) saturate(1.7) brightness(0.68);
  transform: translateZ(0);
}

.view__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(11, 11, 15, 0.1), rgba(11, 11, 15, 0.5) 42%, rgba(11, 11, 15, 0.86) 76%, var(--bg));
}

/* Both layers sit still while their opacity swaps, so the colour of the page
   drifts from one track to the next instead of cutting. */
.xfade-enter-active,
.xfade-leave-active {
  transition: opacity 800ms var(--ease);
}

.xfade-enter-from,
.xfade-leave-to {
  opacity: 0;
}

.view__back {
  position: fixed;
  top: calc(var(--safe-top) + 10px);
  left: max(10px, var(--safe-left));
  z-index: 2;
}

.view__missing {
  position: relative;
  z-index: 1;
  padding: 120px 24px;
  text-align: center;
  color: var(--text-2);
}

.view__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 480px;
  margin: 0 auto;
  padding: calc(var(--safe-top) + 68px) max(24px, var(--safe-right)) 24px max(24px, var(--safe-left));
}

.view__art {
  width: min(78vw, 420px);
  aspect-ratio: 1;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-2);
  box-shadow: var(--shadow-art);
}

.view__art-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 400ms var(--ease);
}

.view__art-img--in {
  opacity: 1;
}

.view__art-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 3.5rem;
  opacity: 0.6;
  background: linear-gradient(145deg, var(--surface-2), var(--surface));
}

.view__station {
  margin-top: 22px;
  background: var(--on-art-fill);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--on-art);
}

.view__title {
  margin-top: 14px;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--on-art);
}

.view__artist {
  margin-top: 6px;
  max-width: 100%;
  font-size: 1rem;
  color: var(--on-art-2);
}

.view__release {
  margin-top: 4px;
  max-width: 100%;
  font-size: 0.8125rem;
  color: var(--text-3);
}

.view__progress {
  width: 100%;
  margin-top: 24px;
}

.view__track {
  height: 3px;
  border-radius: 2px;
  background: var(--on-art-fill);
  overflow: hidden;
}

.view__fill {
  height: 100%;
  border-radius: 2px;
  background: var(--on-art);
  transition: width 1s linear;
}

.view__times {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: var(--on-art-2);
}

.view__controls {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 26px;
}

/* The output button rides beside the play button without pushing it off
   centre, so the one big control stays where the thumb expects it. */
.view__output {
  position: absolute;
  transform: translateX(84px);
}

.view__volume {
  width: min(100%, 280px);
  margin-top: 28px;
}

.view__next {
  margin-top: 28px;
  font-size: 0.8125rem;
  color: var(--on-art-2);
}

.view__next-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .view__fill {
    transition: none;
  }
}
</style>
