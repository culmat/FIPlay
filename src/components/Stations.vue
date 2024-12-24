<template>
  <v-container class="fill-height">
    <v-responsive
      class="align-centerfill-height mx-auto"
      max-width="900"
    >
  <v-list>
    <v-list-item
      v-for="station in stationStore.stations"
      :key="station.stationName"
    >
      <StationItem 
        :stationLabel="station.stationLabel" 
        :songTitle="station.now.firstLine.title" 
        :artist="station.now.secondLine.title" 
        :image="station.now.visuals.card.webpSrc" 
      />
    </v-list-item>
  </v-list>
  </v-responsive>
  </v-container>
</template>

<script setup>
  import StationItem from './StationItem.vue'
  import { useStationStore } from '@/stores/stationStore';
  const stationStore = useStationStore();

</script>
