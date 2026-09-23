<template>
  <div
    class="app"
    :class="{ 'app--bar': showBar }"
  >
    <main class="app__main">
      <router-view v-slot="{ Component, route: current }">
        <Transition
          name="page"
          mode="out-in"
        >
          <component
            :is="Component"
            :key="current.path"
          />
        </Transition>
      </router-view>
    </main>

    <Transition name="bar">
      <NowPlayingBar v-if="showBar" />
    </Transition>

    <OutputSheet />
    <AboutDialog />
    <UpdateToast />
  </div>
</template>

<script setup>
import { useStationStore } from '@/stores/stationStore'
import { useUIStore } from '@/stores/uiStore'

const route = useRoute()
const uiStore = useUIStore()
const stationStore = useStationStore()

/**
 * The bar is a remote control for something that is out of sight.
 *
 * On a station's own page the page itself carries the controls, so the bar is
 * redundant and would only cover the artwork. It stays, though, when a
 * different station is playing elsewhere: that is exactly when you need to know
 * what the speakers are doing while you browse.
 */
const showBar = computed(() => {
  const open = route.params.stationName
  const playing = uiStore.station?.name
  return !open || (!!playing && playing !== open)
})

watchEffect(() => {
  const name = uiStore.station?.name
  const now = name ? stationStore.stations[name]?.now : null
  const title = now?.firstLine?.title
  const artist = now?.secondLine?.title
  document.title = title ? `${title}${artist ? ' – ' + artist : ''} · FIPlay` : 'FIPlay'
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  min-height: 100dvh;
}

.app__main {
  padding-bottom: calc(var(--safe-bottom) + 16px);
  transition: padding-bottom 200ms var(--ease);
}

/* Keep the last row of content clear of the bar. */
.app--bar .app__main {
  padding-bottom: calc(var(--bar-h) + var(--safe-bottom) + 16px);
}

.page-enter-active,
.page-leave-active {
  transition: opacity 180ms var(--ease), transform 180ms var(--ease);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
}

.bar-enter-active,
.bar-leave-active {
  transition: transform 220ms var(--ease), opacity 220ms var(--ease);
}

.bar-enter-from,
.bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
