<template>
  <div class="stations">
    <header class="stations__header chrome">
      <h1 class="stations__brand">
        <Icon
          :path="mdiRadio"
          :size="22"
        />
        FIPlay
      </h1>
      <button
        class="btn btn--icon"
        aria-label="About FIPlay"
        @click="ui.aboutOpen = true"
      >
        <Icon
          :path="mdiInformationOutline"
          :size="22"
        />
      </button>
    </header>

    <div class="stations__grid">
      <StationCard
        v-for="station in stationStore.stations"
        :key="station.stationName"
        :station="station"
        :active="station.stationName === activeName"
        :playing="station.stationName === activeName && uiStore.anyPlaying"
      />
    </div>
  </div>
</template>

<script setup>
import { mdiInformationOutline, mdiRadio } from '@mdi/js'

import { useStationStore } from '@/stores/stationStore'
import { useUIStore } from '@/stores/uiStore'
import { ui } from '@/ui'

const stationStore = useStationStore()
const uiStore = useUIStore()

const activeName = computed(() => uiStore.station?.name || null)
</script>

<style scoped>
.stations__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 1000px;
  margin: 0 auto;
  padding: calc(var(--safe-top) + 12px) max(12px, var(--safe-right)) 8px max(16px, var(--safe-left));
}

.stations__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.stations__brand svg {
  color: var(--accent);
}

/* auto-fill keeps the tiles a sensible size instead of stretching four of them
   across a wide window; the 600px rule pins phones to exactly two columns. */
.stations__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px 16px;
  max-width: 1000px;
  margin: 0 auto;
  padding: 8px max(16px, var(--safe-right)) 0 max(16px, var(--safe-left));
}

@media (max-width: 599px) {
  .stations__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 12px;
  }
}
</style>
