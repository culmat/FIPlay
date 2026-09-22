<template>
  <router-link
    :to="`/station/${station.stationName}`"
    class="card chrome"
    :class="{ 'card--active': active }"
  >
    <div class="card__art">
      <img
        v-if="art"
        class="card__img"
        :class="{ 'card__img--in': loaded }"
        :src="`${art}/400x400`"
        :srcset="`${art}/200x200 200w, ${art}/400x400 400w, ${art}/600x600 600w`"
        sizes="(max-width: 599px) calc(50vw - 22px), 240px"
        :alt="`Cover art for ${title || station.stationLabel}`"
        loading="lazy"
        decoding="async"
        draggable="false"
        @load="loaded = true"
      >
      <div
        v-else
        class="card__fallback"
        :class="{ shimmer: !station.unavailable }"
      >
        <span
          v-if="station.unavailable"
          class="card__emoji"
        >{{ emoji }}</span>
      </div>

      <span class="card__label pill">{{ station.stationLabel }}</span>

      <span
        v-if="active"
        class="card__eq"
      >
        <EqualizerBars :playing="playing" />
      </span>

      <span class="card__hover">
        <Icon
          :path="mdiPlay"
          :size="28"
        />
      </span>
    </div>

    <p
      v-if="title"
      class="card__title truncate"
    >
      {{ title }}
    </p>
    <p
      v-else-if="station.unavailable"
      class="card__title card__title--muted truncate"
    >
      No track info
    </p>
    <div
      v-else
      class="card__ghost shimmer"
    />

    <p
      v-if="artist"
      class="card__artist truncate"
    >
      {{ artist }}
    </p>
    <div
      v-else-if="!station.unavailable"
      class="card__ghost card__ghost--short shimmer"
    />
  </router-link>
</template>

<script setup>
import { mdiPlay } from '@mdi/js'

const props = defineProps({
  station: { type: Object, required: true },
  active: { type: Boolean, default: false },
  playing: { type: Boolean, default: false },
})

const loaded = ref(false)

const art = computed(() => props.station.now?.visuals?.card?.src || '')
const title = computed(() => props.station.now?.firstLine?.title || '')
const artist = computed(() => props.station.now?.secondLine?.title || '')

// The labels are "📻 FIP", "🎷 Jazz" and so on: the emoji is the station's only
// visual identity, and it is what a tile without artwork can fall back on.
const emoji = computed(() => props.station.stationLabel?.trim().split(' ')[0] || '📻')

// A new track means a new image; fade that one in too, not just the first.
watch(art, () => { loaded.value = false })
</script>

<style scoped>
.card {
  display: block;
  min-width: 0;
}

.card__art {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-2);
  box-shadow: var(--shadow-card);
  transition: transform var(--dur) var(--ease), outline-color var(--dur) var(--ease);
  outline: 2px solid transparent;
  outline-offset: 3px;
}

.card--active .card__art {
  outline-color: var(--accent);
}

.card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 300ms var(--ease);
}

.card__img--in {
  opacity: 1;
}

.card__fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, var(--surface-2), var(--surface));
}

.card__emoji {
  font-size: 2.5rem;
  opacity: 0.7;
}

.card__label {
  position: absolute;
  left: 8px;
  bottom: 8px;
  max-width: calc(100% - 16px);
  overflow: hidden;
  text-overflow: ellipsis;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--on-art);
}

.card__eq {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  place-items: center;
  padding: 6px;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--accent);
}

/* A pointer gets a hint that the tile plays; a finger gets the tap itself. */
.card__hover {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  opacity: 0;
  color: #fff;
  background: rgba(0, 0, 0, 0.3);
  transition: opacity var(--dur) var(--ease);
}

@media (hover: hover) {
  .card:hover .card__art {
    transform: translateY(-3px);
  }

  .card:hover .card__hover {
    opacity: 1;
  }
}

.card:focus-visible {
  outline: none;
}

.card:focus-visible .card__art {
  outline-color: var(--accent);
}

.card:active .card__art {
  transform: scale(0.98);
}

.card__title {
  margin-top: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
}

.card__title--muted {
  color: var(--text-3);
  font-weight: 500;
}

.card__artist {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: var(--text-2);
  line-height: 1.3;
}

/* Placeholders that keep the tile the same height while the text is unknown. */
.card__ghost {
  height: 10px;
  border-radius: 5px;
  margin-top: 12px;
}

.card__ghost--short {
  width: 60%;
  margin-top: 8px;
}
</style>
