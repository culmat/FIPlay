<template>
  <Station 
    :station-name="$route.params.stationName"
  />
</template>

<script setup>
import Station from '@/components/Station.vue';
</script>