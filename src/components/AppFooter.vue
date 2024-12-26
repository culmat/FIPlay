<template>
  <v-footer height="40" app style="position: fixed; bottom: 0; width: 100%; z-index: 1000;">
    FIPlay &nbsp;
    <v-btn :prepend-icon="appStore.playing ? 'mdi-pause' : 'mdi-play'" size="x-small" @click="togglePlay" :disabled="!appStore.stationLabel">{{ appStore.stationLabel }}</v-btn>
    <v-btn size="x-small" :disabled="!appStore.stationLabel" @click="adjustVolume(false)"><b>-</b></v-btn>
    <v-btn size="x-small" :disabled="!appStore.stationLabel" @click="adjustVolume(true)"><b>+</b></v-btn>
    <v-btn :prepend-icon="appStore.clientSound ? 'mdi-volume-off' : 'mdi-volume-high'" size="x-small" 
        @click="toggleClientSound">
    </v-btn>

    <div
    class="text-caption text-disabled"
    style="position: absolute; right: 16px;"
    >
    <a
    v-for="item in items"
    :key="item.title"
      :href="item.href"
      :title="item.title"
      class="d-inline-block mx-2 social-link"
      rel="noopener noreferrer"
      target="_blank"
    >
      <v-icon
        :icon="item.icon"
        :size="item.icon === '$vuetify' ? 24 : 16"
        />
      </a>
      
      <v-icon v-if="appStore.backend" size="x-small" 
      :icon="appStore.connected ? 'mdi-antenna' : 'mdi-alert'"
      :color="appStore.connected ? 'success' : 'warning'"
      ></v-icon> 
      &nbsp;
      
      <a
        class="text-decoration-none on-surface"
        href="https://github.com/culmat/FIPlay/blob/main/LICENSE"
        rel="noopener noreferrer"
        target="_blank"
      >
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
  import { useAppStore } from '@/stores/appStore';
  import { togglePlay,adjustVolume,toggleClientSound } from '../main';
  const appStore = useAppStore();
</script>

<style scoped lang="sass">
  .social-link :deep(.v-icon)
    color: rgba(var(--v-theme-on-background), var(--v-disabled-opacity))
    text-decoration: none
    transition: .2s ease-in-out

    &:hover
      color: rgba(25, 118, 210, 1)
</style>
