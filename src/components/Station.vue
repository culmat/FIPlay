<template>
  <v-container>
    <v-responsive class="align-centerfill-height mx-auto" max-width="900">
      <v-list>
        <template v-for="station in stationStore.stations" :key="station.stationName">

          <v-list-item v-if="station.stationName === stationName">
            <StationItem :stationName="station.stationName"
              :stationLabel="stationStore.stations[stationName].stationLabel"
              :songTitle="stationStore.stations[stationName].now.firstLine.title"
              :artist="stationStore.stations[stationName].now.secondLine.title"
              :image="stationStore.stations[stationName].now.visuals.card.webpSrc" route="/" routeIcon="mdi-view-list"
              :label="stationStore.stations[stationName].now.song.release.label"
              :albumTitle="stationStore.stations[stationName].now.song.release.title"
              :albumYear="stationStore.stations[stationName].now.song.year">
              <br />
              <v-progress-linear :key="componentKey" :model-value="progress.percentage">
              </v-progress-linear>
                <div class="text-right" style="font-size: 12px;">{{ progress.elapsedTime }}/{{ progress.totalTime }}</div>
            </StationItem>
          </v-list-item>
        </template>
      </v-list>
    </v-responsive>
  </v-container>
</template>


<script setup>
import { useStationStore } from '@/stores/stationStore';
import { ref } from 'vue';
const componentKey = ref(0);
const stationStore = useStationStore();

const props = defineProps({
  stationName: {
    type: String,
    required: true
  }
});

const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.round(time % 60);
  return  `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const calculateProgress = () => {
  const now = stationStore.stations[props.stationName].now
  const nowTime = new Date().getTime();
  const totalTime = now.endTime  - now.startTime ;

  const elapsedTime = (nowTime - now.startTime * 1000) / 1000
  
  return {
    percentage: (elapsedTime / totalTime) * 100,
    elapsedTime: formatTime(elapsedTime),
    totalTime: formatTime(totalTime),
  }
};
var progress = calculateProgress();

import { onBeforeUnmount } from 'vue';

const handleVisibilityChange = () => {
  if (document.hidden) {
    clearInterval(progressInterval);
  } else {
    progressInterval = setInterval(() => {
      progress = calculateProgress();
      componentKey.value += 1;
    }, 1000);
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  clearInterval(progressInterval);
});

let progressInterval = setInterval(() => {
  progress = calculateProgress();
  componentKey.value += 1;
}, 1000);

</script>
