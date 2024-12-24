<template>
  <Station 
    :stationName="$route.params.stationName" 

  />
  
</template>

<script setup>
import Station from '@/components/Station.vue';
</script>