<template>
  <div
    class="eq"
    :class="{ 'eq--paused': !playing }"
    aria-hidden="true"
  >
    <i /><i /><i />
  </div>
</template>

<script setup>
defineProps({
  playing: { type: Boolean, default: true },
})
</script>

<style scoped>
/* Three bars dancing: the one wordless way to say "this is the one playing". */
.eq {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}

.eq i {
  width: 3px;
  height: 100%;
  border-radius: 1px;
  background: currentColor;
  transform-origin: bottom;
  animation: eq 900ms ease-in-out infinite alternate;
}

.eq i:nth-child(2) {
  animation-duration: 620ms;
}

.eq i:nth-child(3) {
  animation-duration: 1100ms;
}

.eq--paused i {
  animation-play-state: paused;
  transform: scaleY(0.35);
}

@keyframes eq {
  from {
    transform: scaleY(0.25);
  }
  to {
    transform: scaleY(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .eq i {
    animation: none;
    transform: scaleY(0.55);
  }
}
</style>
