<template>
  <v-container>
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
        :stationName="station.stationName" 
        :stationLabel="station.stationLabel" 
        :songTitle="station.now.firstLine.title" 
        :artist="station.now.secondLine.title" 
        :image="station.now.visuals.card.src"
        :route="'/station/'+station.stationName"
        routeIcon="mdi-play" 
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
