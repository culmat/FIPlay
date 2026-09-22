<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="path" />
  </svg>
</template>

<script setup>
// Material Design Icons as single SVG paths from @mdi/js. The whole app needs
// about a dozen, which inline like this cost a few hundred bytes; the icon font
// they replace was 400 KB of woff2 plus three more copies in other formats.
defineProps({
  path: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
})
</script>
