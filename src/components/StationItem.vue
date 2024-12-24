
<template>
<v-card color="#333">
                <div class="d-flex flex-no-wrap justify-space-between">
                  <div>
                    <v-card-title class="text-h5">
                        {{ stationLabel }}
                    </v-card-title>

                    <v-card-subtitle>{{ songTitle }}</v-card-subtitle>
                    <v-card-subtitle>{{ artist }}</v-card-subtitle>
                    <v-card-subtitle v-if="label">{{ albumTitle }} ({{ albumYear }}) {{ label }}</v-card-subtitle>

                    <v-card-actions>
                      <v-btn
                        @click="() => $router.push(`${route}`)"
                        class="ms-2"
                        :icon="routeIcon"
                        variant="text"
                      ></v-btn>
                    </v-card-actions>
                  </div>

                  <v-avatar
                    class="ma-3"
                    rounded="0"
                    size="200"
                  >
                    <v-img :src="image"></v-img>
                  </v-avatar>
                </div>
              </v-card>
</template>
<script setup>
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