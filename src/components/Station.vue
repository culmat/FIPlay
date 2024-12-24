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
        <StationItem v-if="station.stationName === stationName"
          :stationName="station.stationName" 
          :stationLabel="stationStore.stations[stationName].stationLabel" 
          :songTitle="stationStore.stations[stationName].now.firstLine.title" 
          :artist="stationStore.stations[stationName].now.secondLine.title" 
          :image="stationStore.stations[stationName].now.visuals.card.webpSrc"
          route="/"
          routeIcon="mdi-view-list"
          :label="stationStore.stations[stationName].now.song.release.label" 
          :albumTitle="stationStore.stations[stationName].now.song.release.title"
          :albumYear="stationStore.stations[stationName].now.song.year" 
        />
      </v-list-item>
    </v-list>
    </v-responsive>
    </v-container>
  </template>


<script setup>
  import { useStationStore } from '@/stores/stationStore';
  const stationStore = useStationStore();

defineProps({
    stationName: {
        type: String,
        required: true
    }
});

</script>
