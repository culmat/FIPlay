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
              :image="stationStore.stations[stationName].now.visuals.card.src" route="/" routeIcon="mdi-view-list"
              :label="stationStore.stations[stationName].now.song?.release?.label"
              :albumTitle="stationStore.stations[stationName].now.song?.release?.title"
              :albumYear="stationStore.stations[stationName].now.song?.year">
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
  // Flooring both parts: rounding the seconds turns 119.6 into "1:60".
  const safe = Math.max(0, Math.floor(time));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return  `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const calculateProgress = () => {
  const now = stationStore.stations[props.stationName].now
  const nowTime = new Date().getTime();
  const totalTime = now.endTime  - now.startTime ;

  const elapsedTime = (nowTime - now.startTime * 1000) / 1000

  if (!(totalTime > 0) || !Number.isFinite(elapsedTime)) {
    return { percentage: 0, elapsedTime: formatTime(0), totalTime: formatTime(0) };
  }

  // A track can outlive the data describing it, because the service reports
  // the next one a little late. Hold at the end rather than counting past it.
  const played = Math.min(Math.max(elapsedTime, 0), totalTime);

  return {
    percentage: (played / totalTime) * 100,
    elapsedTime: formatTime(played),
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
