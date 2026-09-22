
<template>
  <v-card color="#333">
    <div class="d-flex flex-wrap justify-space-between align-start">
      <!-- flex-basis 0 so the text does not claim the whole row and push the
           artwork onto a line of its own, which it did whenever a station name
           or track title happened to be long. min-width 0 lets it wrap. -->
      <div class="station-text">
        <v-card-title class="text-h5">
          {{ stationLabel }}
        </v-card-title>

        <v-card-subtitle>{{ songTitle }}</v-card-subtitle>
        <v-card-subtitle>{{ artist }}</v-card-subtitle>
        <v-card-subtitle v-if="label">{{ albumTitle }} ({{ albumYear }}) {{ label }}</v-card-subtitle>
        <v-card-subtitle>
          <slot></slot>
        </v-card-subtitle>
        <v-card-actions>
          <v-btn @click="() => $router.push(`${route}`)" class="ms-2" :icon="routeIcon" variant="text"
            size="x-large"></v-btn>
        </v-card-actions>
      </div>

      <v-avatar class="ma-3 flex-shrink-0" rounded="0" :size="avatarSize">
        <v-img :src="image ? image + '/200x200' : undefined"></v-img>
      </v-avatar>
    </div>
  </v-card>
</template>
<script setup>
import { useDisplay } from 'vuetify'

// Keep the artwork beside the text on a phone as well: 200px next to a column
// of text does not fit on a narrow screen.
const { smAndDown } = useDisplay()
const avatarSize = computed(() => (smAndDown.value ? 120 : 200))

defineProps({
    stationName: {
        type: String,
        required: true
    },
    stationLabel: {
        type: String,
        required: true
    },
    songTitle: {
        type: String,
        required: true
    },
    artist: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    route: {
        type: String,
        required: true
    },
    routeIcon: {
        type: String,
        required: true
    },
    albumTitle: {
        type: String,
    },
    albumYear: {
        type: Number,
    }, 
    label: {
        type: String,
    }

});
</script>

<style scoped>
.station-text {
  flex: 1 1 0;
  min-width: 0;
}
</style>