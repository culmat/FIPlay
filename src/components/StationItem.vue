
<template>
<v-card color="#952175">
                <div class="d-flex flex-no-wrap justify-space-between">
                  <div>
                    <v-card-title class="text-h5">
                        {{ stationLabel }}
                    </v-card-title>

                    <v-card-subtitle>{{ songTitle }}</v-card-subtitle>
                    <v-card-subtitle>{{ artist }}</v-card-subtitle>

                    <v-card-actions>
                      <v-btn
                        class="ms-2"
                        icon="mdi-play"
                        variant="text"
                      ></v-btn>
                    </v-card-actions>
                  </div>

                  <v-avatar
                    class="ma-3"
                    rounded="0"
                    size="125"
                  >
                    <v-img :src="image"></v-img>
                  </v-avatar>
                </div>
              </v-card>
</template>
<script setup>
defineProps({
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
    }
});
</script>