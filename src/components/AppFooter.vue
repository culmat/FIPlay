<template>
  <v-footer app style="position: fixed; bottom: 0; width: 100%; z-index: 1000;" class="d-flex flex-wrap">
    <v-btn size="x-small" @click="() => $router.push('/')">
      FIPlay </v-btn>
    &nbsp;

    <v-btn size="x-small" v-if="uiStore.activePlayer.stationLabel"
      @click="() => $router.push({ path: '/station/' + uiStore.activePlayer.stationName, query: { play: false, backend: $route.query.backend } })">
      {{ uiStore.activePlayer.stationLabel}}</v-btn>

    <v-btn-toggle v-model="uiStore.activePlayer.playing">
      <v-btn size="x-small" value="false" v-if="uiStore.activePlayer.stationLabel">
        <v-icon>mdi-pause</v-icon>
      </v-btn>

      <v-btn size="x-small" value="true" v-if="uiStore.activePlayer.stationLabel">
        <v-icon>mdi-play</v-icon>
      </v-btn>
    </v-btn-toggle>
    <v-form>
      <v-slider v-model="uiStore.activePlayer.volume" max="100" :min="0" class="align-center" hide-details
        style="width: 150px" show-ticks="always" step="10">
      </v-slider>
    </v-form>
    &nbsp;
    <v-form v-if="uiStore.players.length > 1">
      <v-select :items="uiStore.players" v-model="uiStore.playerName" variant="underlined" density="compact"></v-select>
    </v-form>

    <div class="text-caption text-disabled ms-auto">
      <a v-for="item in items" :key="item.title" :href="item.href" :title="item.title"
        class="d-inline-block mx-2 social-link" rel="noopener noreferrer" target="_blank">
        <v-icon :icon="item.icon" size="16" />
      </a>

      <a class="text-decoration-none on-surface" href="https://github.com/culmat/FIPlay/blob/main/LICENSE"
        rel="noopener noreferrer" target="_blank">
        APACHE License
      </a>
    </div>
  </v-footer>
</template>

<script setup>
  const items = [
    {
      title: 'GitHub',
      icon: `mdi-github`,
      href: 'https://github.com/culmat/FIPlay',
    },
  ]
import { useUIStore } from '@/stores/uiStore';
const uiStore = useUIStore();
</script>

<style scoped lang="sass">
  .social-link :deep(.v-icon)
    color: rgba(var(--v-theme-on-background), var(--v-disabled-opacity))
    text-decoration: none
    transition: .2s ease-in-out

    &:hover
      color: rgba(25, 118, 210, 1)
</style>
