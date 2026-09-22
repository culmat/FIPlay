<template>
  <div
    class="vol chrome"
    :class="`vol--${tone}`"
  >
    <Icon
      class="vol__icon"
      :path="icon"
      :size="18"
    />
    <input
      class="vol__input"
      type="range"
      min="0"
      max="100"
      step="1"
      aria-label="Volume"
      :value="shown"
      :style="{ '--pct': shown + '%' }"
      @input="onInput"
      @change="onChange"
    >
  </div>
</template>

<script setup>
import { mdiVolumeHigh, mdiVolumeLow, mdiVolumeOff } from '@mdi/js'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  // 'art' is the white treatment used over cover art on the detail view.
  tone: { type: String, default: 'default' },
})

const emit = defineEmits(['update:modelValue'])

const dragging = ref(false)
const local = ref(props.modelValue)

// While a finger is down the slider follows the finger, not the store: a
// speaker confirms a volume change a beat later, and letting that echo back
// mid-drag makes the thumb jump about.
const shown = computed(() => (dragging.value ? local.value : props.modelValue))

const icon = computed(() => {
  if (shown.value === 0) return mdiVolumeOff
  return shown.value < 50 ? mdiVolumeLow : mdiVolumeHigh
})

/**
 * Every write to the store is a request to the speaker, and a drag across the
 * track produces one input event per pixel. Send at most one every 150ms, and
 * always send the value the drag ended on.
 */
const INTERVAL = 150
let last = 0
let trailing = null

function commit (value) {
  emit('update:modelValue', value)
}

function onInput (event) {
  const value = Number(event.target.value)
  dragging.value = true
  local.value = value

  const now = Date.now()
  clearTimeout(trailing)
  if (now - last >= INTERVAL) {
    last = now
    commit(value)
  } else {
    trailing = setTimeout(() => {
      last = Date.now()
      commit(local.value)
    }, INTERVAL - (now - last))
  }
}

function onChange (event) {
  clearTimeout(trailing)
  last = Date.now()
  commit(Number(event.target.value))
  dragging.value = false
}

onBeforeUnmount(() => clearTimeout(trailing))
</script>

<style scoped>
.vol {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.vol__icon {
  flex: 0 0 auto;
  color: var(--text-3);
  transition: color var(--dur) var(--ease);
}

.vol--art .vol__icon {
  color: var(--on-art-2);
}

.vol__input {
  flex: 1 1 auto;
  min-width: 0;
  height: 24px;
  margin: 0;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

/* The filled portion is painted into the track, so there is one element to
   style and nothing to keep in sync with the thumb. */
.vol__input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, var(--fill) var(--pct), var(--track) var(--pct));
}

.vol__input::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(to right, var(--fill) var(--pct), var(--track) var(--pct));
}

.vol__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5px;
  border: 0;
  border-radius: 50%;
  background: var(--thumb);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  transition: transform var(--dur) var(--ease);
}

.vol__input::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--thumb);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  transition: transform var(--dur) var(--ease);
}

.vol__input:active::-webkit-slider-thumb {
  transform: scale(1.35);
}

.vol__input:active::-moz-range-thumb {
  transform: scale(1.35);
}

.vol__input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
  border-radius: var(--radius-pill);
}

.vol--default {
  --fill: var(--accent);
  --track: var(--surface-3);
  --thumb: #fff;
}

.vol--art {
  --fill: var(--on-art);
  --track: var(--on-art-fill);
  --thumb: #fff;
}
</style>
